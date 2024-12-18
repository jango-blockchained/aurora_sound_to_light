"""Effect Engine for Aurora Sound to Light."""
import logging
from typing import Dict, List, Optional

from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

class EffectEngine:
    """Manages light effects for Aurora Sound to Light."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the effect engine."""
        self.hass = hass
        self._effects: Dict[str, dict] = {}
        self._active_effects: Dict[str, dict] = {}

    async def register_effect(self, effect_id: str, effect_config: dict) -> bool:
        """Register a new effect."""
        try:
            self._effects[effect_id] = effect_config
            _LOGGER.debug("Registered effect: %s", effect_id)
            return True
        except Exception as err:
            _LOGGER.error("Failed to register effect %s: %s", effect_id, err)
            return False

    async def start_effect(self, effect_id: str, target_lights: List[str]) -> bool:
        """Start an effect on specified lights."""
        try:
            if effect_id not in self._effects:
                _LOGGER.error("Effect %s not found", effect_id)
                return False

            effect_config = self._effects[effect_id].copy()
            effect_config["target_lights"] = target_lights
            self._active_effects[effect_id] = effect_config
            _LOGGER.debug("Started effect %s on lights %s", effect_id, target_lights)
            return True
        except Exception as err:
            _LOGGER.error("Failed to start effect %s: %s", effect_id, err)
            return False

    async def stop_effect(self, effect_id: str) -> bool:
        """Stop a running effect."""
        try:
            if effect_id in self._active_effects:
                del self._active_effects[effect_id]
                _LOGGER.debug("Stopped effect: %s", effect_id)
                return True
            return False
        except Exception as err:
            _LOGGER.error("Failed to stop effect %s: %s", effect_id, err)
            return False

    async def cleanup(self) -> None:
        """Clean up all active effects."""
        try:
            for effect_id in list(self._active_effects.keys()):
                await self.stop_effect(effect_id)
            self._effects.clear()
            _LOGGER.debug("Cleaned up all effects")
        except Exception as err:
            _LOGGER.error("Error during cleanup: %s", err)

    def get_active_effects(self) -> Dict[str, dict]:
        """Get all currently active effects."""
        return self._active_effects.copy()

    def get_available_effects(self) -> Dict[str, dict]:
        """Get all registered effects."""
        return self._effects.copy()

    async def update_effect(self, effect_id: str, effect_config: dict) -> bool:
        """Update an existing effect configuration."""
        try:
            if effect_id not in self._effects:
                _LOGGER.error("Effect %s not found for update", effect_id)
                return False

            self._effects[effect_id].update(effect_config)
            
            # If the effect is active, update the active configuration
            if effect_id in self._active_effects:
                active_config = self._active_effects[effect_id]
                target_lights = active_config.get("target_lights", [])
                await self.stop_effect(effect_id)
                await self.start_effect(effect_id, target_lights)
            
            _LOGGER.debug("Updated effect: %s", effect_id)
            return True
        except Exception as err:
            _LOGGER.error("Failed to update effect %s: %s", effect_id, err)
            return False 