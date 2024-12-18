"""Cache implementation for Aurora Sound to Light."""
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, TypeVar, Generic

from homeassistant.core import HomeAssistant
from homeassistant.helpers import storage
from homeassistant.util import dt as dt_util

_LOGGER = logging.getLogger(__name__)

T = TypeVar('T')

class CacheEntry(Generic[T]):
    """Represents a cached item with metadata."""
    def __init__(self, value: T, ttl: int) -> None:
        """Initialize a cache entry.
        
        Args:
            value: The value to cache
            ttl: Time to live in seconds
        """
        self.value = value
        self.created_at = dt_util.utcnow()
        self.expires_at = self.created_at + timedelta(seconds=ttl)
        self.access_count = 0
        self.last_accessed = self.created_at

    def is_expired(self) -> bool:
        """Check if the cache entry has expired."""
        return dt_util.utcnow() > self.expires_at

    def access(self) -> None:
        """Record an access to this cache entry."""
        self.access_count += 1
        self.last_accessed = dt_util.utcnow()

class AuroraCache:
    """Cache manager for Aurora Sound to Light."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the cache manager."""
        self.hass = hass
        self._memory_cache: Dict[str, CacheEntry] = {}
        self._persistent_store = storage.Store(
            hass,
            1,  # Version
            "aurora_sound_to_light_cache",
            private=True,
            atomic_writes=True
        )
        self._cleanup_lock = asyncio.Lock()
        self._cleanup_task = None
        self._max_memory_entries = 1000
        self._default_ttl = 3600  # 1 hour

    async def async_setup(self) -> None:
        """Set up the cache manager."""
        try:
            # Load persistent cache
            stored_data = await self._persistent_store.async_load()
            if stored_data:
                # Convert stored data back to cache entries
                for key, entry_data in stored_data.items():
                    if not self._is_entry_expired(entry_data):
                        self._memory_cache[key] = CacheEntry(
                            entry_data["value"],
                            entry_data["ttl"]
                        )
            
            # Start cleanup task
            self._cleanup_task = self.hass.async_create_task(self._cleanup_loop())
            _LOGGER.debug("Cache manager initialized successfully")
        except Exception as err:
            _LOGGER.error("Failed to initialize cache manager: %s", err)

    async def async_get(self, key: str, default: Optional[T] = None) -> Optional[T]:
        """Get a value from the cache."""
        try:
            entry = self._memory_cache.get(key)
            if entry and not entry.is_expired():
                entry.access()
                return entry.value
            if entry:
                # Entry exists but is expired
                await self.async_delete(key)
            return default
        except Exception as err:
            _LOGGER.error("Error retrieving from cache: %s", err)
            return default

    async def async_set(
        self,
        key: str,
        value: T,
        ttl: Optional[int] = None,
        persist: bool = False
    ) -> None:
        """Set a value in the cache.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds (optional)
            persist: Whether to persist to storage
        """
        try:
            # Ensure we don't exceed memory limits
            if len(self._memory_cache) >= self._max_memory_entries:
                await self._evict_entries()

            # Create new cache entry
            entry = CacheEntry(value, ttl or self._default_ttl)
            self._memory_cache[key] = entry

            if persist:
                await self._persistent_store.async_save({
                    key: {
                        "value": value,
                        "ttl": ttl or self._default_ttl,
                        "created_at": entry.created_at.isoformat(),
                        "expires_at": entry.expires_at.isoformat()
                    }
                })
        except Exception as err:
            _LOGGER.error("Error setting cache value: %s", err)

    async def async_delete(self, key: str) -> None:
        """Delete a value from the cache."""
        try:
            self._memory_cache.pop(key, None)
            stored_data = await self._persistent_store.async_load()
            if stored_data and key in stored_data:
                stored_data.pop(key)
                await self._persistent_store.async_save(stored_data)
        except Exception as err:
            _LOGGER.error("Error deleting cache entry: %s", err)

    async def async_clear(self) -> None:
        """Clear all cache entries."""
        try:
            self._memory_cache.clear()
            await self._persistent_store.async_save({})
        except Exception as err:
            _LOGGER.error("Error clearing cache: %s", err)

    async def _cleanup_loop(self) -> None:
        """Periodically clean up expired entries."""
        while True:
            try:
                async with self._cleanup_lock:
                    await self._cleanup_expired()
                await asyncio.sleep(300)  # Run every 5 minutes
            except asyncio.CancelledError:
                break
            except Exception as err:
                _LOGGER.error("Error in cache cleanup loop: %s", err)
                await asyncio.sleep(60)  # Wait a minute before retrying

    async def _cleanup_expired(self) -> None:
        """Remove expired entries from cache."""
        # Clean memory cache
        expired_keys = [
            key for key, entry in self._memory_cache.items()
            if entry.is_expired()
        ]
        for key in expired_keys:
            await self.async_delete(key)

        # Clean persistent storage
        stored_data = await self._persistent_store.async_load()
        if stored_data:
            modified = False
            for key, entry_data in list(stored_data.items()):
                if self._is_entry_expired(entry_data):
                    stored_data.pop(key)
                    modified = True
            if modified:
                await self._persistent_store.async_save(stored_data)

    def _is_entry_expired(self, entry_data: Dict[str, Any]) -> bool:
        """Check if a stored entry is expired."""
        try:
            expires_at = datetime.fromisoformat(entry_data["expires_at"])
            return dt_util.utcnow() > expires_at
        except (KeyError, ValueError):
            return True

    async def _evict_entries(self) -> None:
        """Evict entries when cache is full."""
        # Sort entries by last accessed time and access count
        sorted_entries = sorted(
            self._memory_cache.items(),
            key=lambda x: (x[1].last_accessed, x[1].access_count)
        )
        
        # Remove 10% of least recently used entries
        entries_to_remove = max(1, len(sorted_entries) // 10)
        for key, _ in sorted_entries[:entries_to_remove]:
            await self.async_delete(key)

    async def async_stop(self) -> None:
        """Stop the cache manager."""
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass