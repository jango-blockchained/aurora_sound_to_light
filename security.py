"""Security module for Aurora Sound to Light integration."""
import asyncio
import logging
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple, Union

import voluptuous as vol
from homeassistant.const import CONF_NAME, CONF_TYPE
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv

_LOGGER = logging.getLogger(__name__)

# Rate limiting constants
DEFAULT_RATE_LIMIT = 100  # requests per minute
DEFAULT_BURST_LIMIT = 20  # maximum burst size
DEFAULT_COOLDOWN = 60  # seconds
MAX_FAILED_ATTEMPTS = 5  # maximum failed attempts before temporary ban
BAN_DURATION = 300  # temporary ban duration in seconds

# Input validation schemas
EFFECT_PARAMETER_SCHEMA = vol.Schema({
    vol.Required(CONF_TYPE): cv.string,
    vol.Required(CONF_NAME): cv.string,
    vol.Optional('intensity', default=1.0): vol.All(
        vol.Coerce(float), vol.Range(min=0, max=1)
    ),
    vol.Optional('speed', default=1.0): vol.All(
        vol.Coerce(float), vol.Range(min=0.1, max=5)
    ),
    vol.Optional('color'): cv.string,
    vol.Optional('sensitivity', default=0.5): vol.All(
        vol.Coerce(float), vol.Range(min=0, max=1)
    ),
})

LIGHT_GROUP_SCHEMA = vol.Schema({
    vol.Required(CONF_NAME): cv.string,
    vol.Required('lights'): vol.All(cv.ensure_list, [cv.string]),
    vol.Optional('transition_time', default=100): vol.All(
        vol.Coerce(int), vol.Range(min=0, max=1000)
    ),
})

@dataclass
class RateLimitEntry:
    """Rate limit tracking for a client."""
    requests: int = 0
    last_reset: float = time.time()
    failed_attempts: int = 0
    ban_until: Optional[float] = None

class SecurityManager:
    """Manages security features for the integration."""

    def __init__(self, hass: HomeAssistant):
        """Initialize the security manager."""
        self.hass = hass
        self._rate_limits: Dict[str, RateLimitEntry] = defaultdict(RateLimitEntry)
        self._blocked_ips: Set[str] = set()
        self._audit_log: List[Dict[str, Any]] = []
        self._lock = asyncio.Lock()

    async def validate_request(
        self, 
        client_id: str, 
        request_type: str, 
        data: Dict[str, Any]
    ) -> Tuple[bool, Optional[str]]:
        """Validate an incoming request."""
        async with self._lock:
            # Check if client is banned
            if self._is_banned(client_id):
                return False, "Client is temporarily banned"

            # Check rate limits
            if not self._check_rate_limit(client_id):
                self._record_failed_attempt(client_id)
                return False, "Rate limit exceeded"

            # Validate input data based on request type
            try:
                if request_type == "effect":
                    vol.Schema(EFFECT_PARAMETER_SCHEMA)(data)
                elif request_type == "light_group":
                    vol.Schema(LIGHT_GROUP_SCHEMA)(data)
                else:
                    # Add more validation schemas as needed
                    pass
            except vol.Invalid as err:
                self._record_failed_attempt(client_id)
                return False, f"Invalid input data: {err}"

            # Log successful request
            self._audit_log_entry(client_id, request_type, data, success=True)
            return True, None

    def _check_rate_limit(self, client_id: str) -> bool:
        """Check if a client has exceeded their rate limit."""
        entry = self._rate_limits[client_id]
        current_time = time.time()

        # Reset counter if cooldown period has passed
        if current_time - entry.last_reset >= DEFAULT_COOLDOWN:
            entry.requests = 0
            entry.last_reset = current_time

        # Check if within limits
        if entry.requests >= DEFAULT_RATE_LIMIT:
            return False

        # Increment request counter
        entry.requests += 1
        return True

    def _is_banned(self, client_id: str) -> bool:
        """Check if a client is currently banned."""
        entry = self._rate_limits[client_id]
        if entry.ban_until is None:
            return False
        
        if time.time() >= entry.ban_until:
            entry.ban_until = None
            entry.failed_attempts = 0
            return False
        
        return True

    def _record_failed_attempt(self, client_id: str) -> None:
        """Record a failed attempt and possibly ban the client."""
        entry = self._rate_limits[client_id]
        entry.failed_attempts += 1

        if entry.failed_attempts >= MAX_FAILED_ATTEMPTS:
            entry.ban_until = time.time() + BAN_DURATION
            self._audit_log_entry(
                client_id, 
                "security", 
                {"action": "temporary_ban", "duration": BAN_DURATION},
                success=False
            )

    def _audit_log_entry(
        self, 
        client_id: str, 
        request_type: str, 
        data: Dict[str, Any], 
        success: bool
    ) -> None:
        """Add an entry to the audit log."""
        entry = {
            "timestamp": datetime.now().isoformat(),
            "client_id": client_id,
            "request_type": request_type,
            "data": data,
            "success": success
        }
        self._audit_log.append(entry)

        # Trim log if it gets too large
        if len(self._audit_log) > 1000:
            self._audit_log = self._audit_log[-1000:]

        # Log security events
        if not success or request_type == "security":
            _LOGGER.warning("Security event: %s", entry)

    async def get_audit_log(
        self, 
        start_time: Optional[datetime] = None, 
        end_time: Optional[datetime] = None,
        client_id: Optional[str] = None,
        request_type: Optional[str] = None,
        success: Optional[bool] = None
    ) -> List[Dict[str, Any]]:
        """Get filtered audit log entries."""
        filtered_log = self._audit_log

        if start_time:
            filtered_log = [
                entry for entry in filtered_log 
                if datetime.fromisoformat(entry["timestamp"]) >= start_time
            ]

        if end_time:
            filtered_log = [
                entry for entry in filtered_log 
                if datetime.fromisoformat(entry["timestamp"]) <= end_time
            ]

        if client_id:
            filtered_log = [
                entry for entry in filtered_log 
                if entry["client_id"] == client_id
            ]

        if request_type:
            filtered_log = [
                entry for entry in filtered_log 
                if entry["request_type"] == request_type
            ]

        if success is not None:
            filtered_log = [
                entry for entry in filtered_log 
                if entry["success"] == success
            ]

        return filtered_log

    async def security_audit(self) -> Dict[str, Any]:
        """Perform a security audit and return findings."""
        findings = {
            "timestamp": datetime.now().isoformat(),
            "rate_limits": {
                "banned_clients": len([
                    client for client, entry in self._rate_limits.items() 
                    if self._is_banned(client)
                ]),
                "high_rate_clients": len([
                    client for client, entry in self._rate_limits.items() 
                    if entry.requests > DEFAULT_RATE_LIMIT * 0.8
                ])
            },
            "failed_attempts": {
                client: entry.failed_attempts 
                for client, entry in self._rate_limits.items() 
                if entry.failed_attempts > 0
            },
            "audit_log_stats": {
                "total_entries": len(self._audit_log),
                "failed_requests": len([
                    entry for entry in self._audit_log 
                    if not entry["success"]
                ]),
                "security_events": len([
                    entry for entry in self._audit_log 
                    if entry["request_type"] == "security"
                ])
            }
        }

        # Log audit results
        _LOGGER.info("Security audit completed: %s", findings)
        return findings

    def reset_rate_limits(self, client_id: Optional[str] = None) -> None:
        """Reset rate limits for a specific client or all clients."""
        if client_id:
            if client_id in self._rate_limits:
                self._rate_limits[client_id] = RateLimitEntry()
        else:
            self._rate_limits.clear()

    def unban_client(self, client_id: str) -> bool:
        """Manually unban a client."""
        if client_id in self._rate_limits:
            entry = self._rate_limits[client_id]
            was_banned = bool(entry.ban_until)
            entry.ban_until = None
            entry.failed_attempts = 0
            if was_banned:
                self._audit_log_entry(
                    client_id,
                    "security",
                    {"action": "manual_unban"},
                    success=True
                )
            return was_banned
        return False 