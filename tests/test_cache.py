"""Tests for the Aurora Sound to Light cache system."""
import asyncio
from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from homeassistant.core import HomeAssistant
from homeassistant.util import dt as dt_util

from custom_components.aurora_sound_to_light.cache import AuroraCache, CacheEntry


@pytest.fixture
def mock_hass():
    """Create a mock Home Assistant instance."""
    hass = MagicMock(spec=HomeAssistant)
    hass.async_create_task = asyncio.create_task
    return hass


@pytest.fixture
async def cache(mock_hass):
    """Create a cache instance for testing."""
    cache = AuroraCache(mock_hass)
    await cache.async_setup()
    yield cache
    await cache.async_stop()


async def test_cache_entry_expiration():
    """Test cache entry expiration logic."""
    # Create an entry with 1 second TTL
    entry = CacheEntry("test_value", 1)
    assert not entry.is_expired()
    
    # Wait for expiration
    await asyncio.sleep(1.1)
    assert entry.is_expired()


async def test_cache_entry_access():
    """Test cache entry access counting."""
    entry = CacheEntry("test_value", 60)
    assert entry.access_count == 0
    
    entry.access()
    assert entry.access_count == 1
    assert entry.last_accessed > entry.created_at


async def test_cache_set_get(cache):
    """Test setting and getting cache values."""
    await cache.async_set("test_key", "test_value")
    value = await cache.async_get("test_key")
    assert value == "test_value"


async def test_cache_default_value(cache):
    """Test getting default value for non-existent key."""
    value = await cache.async_get("non_existent", default="default")
    assert value == "default"


async def test_cache_delete(cache):
    """Test deleting cache entries."""
    await cache.async_set("test_key", "test_value")
    await cache.async_delete("test_key")
    value = await cache.async_get("test_key")
    assert value is None


async def test_cache_clear(cache):
    """Test clearing all cache entries."""
    await cache.async_set("key1", "value1")
    await cache.async_set("key2", "value2")
    await cache.async_clear()
    assert await cache.async_get("key1") is None
    assert await cache.async_get("key2") is None


async def test_cache_persistence(mock_hass):
    """Test cache persistence functionality."""
    store_data = {}
    
    # Mock the Store class
    with patch("homeassistant.helpers.storage.Store") as mock_store:
        mock_store_instance = MagicMock()
        mock_store_instance.async_load = MagicMock(return_value=store_data)
        mock_store_instance.async_save = MagicMock(side_effect=lambda data: store_data.update(data))
        mock_store.return_value = mock_store_instance

        cache = AuroraCache(mock_hass)
        await cache.async_setup()

        # Test persistent storage
        await cache.async_set("persist_key", "persist_value", persist=True)
        assert "persist_key" in store_data
        
        # Create new cache instance to test loading
        cache2 = AuroraCache(mock_hass)
        await cache2.async_setup()
        value = await cache2.async_get("persist_key")
        assert value == "persist_value"

        await cache.async_stop()
        await cache2.async_stop()


async def test_cache_cleanup(cache):
    """Test automatic cleanup of expired entries."""
    # Set entries with short TTL
    await cache.async_set("expire_soon", "value1", ttl=1)
    await cache.async_set("expire_later", "value2", ttl=60)

    # Wait for first entry to expire
    await asyncio.sleep(1.1)
    
    # Trigger cleanup
    await cache._cleanup_expired()

    # Check results
    assert await cache.async_get("expire_soon") is None
    assert await cache.async_get("expire_later") == "value2"


async def test_cache_eviction(cache):
    """Test cache eviction when maximum entries is reached."""
    # Temporarily set a low maximum
    cache._max_memory_entries = 2

    # Add entries
    await cache.async_set("key1", "value1")
    await cache.async_set("key2", "value2")
    await cache.async_set("key3", "value3")  # Should trigger eviction

    # At least one old entry should be evicted
    remaining_count = sum(
        1 for key in ["key1", "key2", "key3"]
        if await cache.async_get(key) is not None
    )
    assert remaining_count <= 2


async def test_cache_error_handling(cache):
    """Test error handling in cache operations."""
    # Test invalid entry data
    with patch.object(cache, "_is_entry_expired", side_effect=Exception("Test error")):
        # Should return default value on error
        value = await cache.async_get("error_key", default="default")
        assert value == "default"

    # Test storage error
    with patch.object(cache._persistent_store, "async_save", side_effect=Exception("Storage error")):
        # Should not raise exception but log error
        await cache.async_set("error_key", "value", persist=True)
        # Value should still be in memory cache
        assert await cache.async_get("error_key") == "value"


async def test_cache_concurrent_access(cache):
    """Test concurrent access to cache."""
    async def access_cache(key, value):
        await cache.async_set(key, value)
        await asyncio.sleep(0.1)
        return await cache.async_get(key)

    # Create multiple concurrent operations
    tasks = [
        access_cache(f"key{i}", f"value{i}")
        for i in range(5)
    ]
    
    # Run concurrently
    results = await asyncio.gather(*tasks)
    
    # Verify results
    assert all(results[i] == f"value{i}" for i in range(5))


async def test_cache_performance(cache):
    """Test cache performance with many entries."""
    # Add many entries
    for i in range(100):
        await cache.async_set(f"key{i}", f"value{i}")

    # Measure access time
    start_time = dt_util.utcnow()
    value = await cache.async_get("key50")
    access_time = dt_util.utcnow() - start_time

    assert value == "value50"
    assert access_time < timedelta(milliseconds=100)  # Should be very fast 