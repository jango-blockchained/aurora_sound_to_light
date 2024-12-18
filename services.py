"""Service handlers for Aurora Sound to Light integration."""
import logging
from typing import Any, Dict, List, Optional

import voluptuous as vol
from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN
from .core.effect_engine import EffectEngine
from .core.light_controller import LightController
from .core.audio_processor import AudioProcessor

_LOGGER = logging.getLogger(__name__)

# Service schemas
EFFECT_PARAMETER_SCHEMA = vol.Schema({
    vol.Required("name"): cv.string,
    vol.Required("code"): cv.string,
    vol.Required("parameters"): dict,
    vol.Optional("description"): cv.string,
})

LIGHT_GROUP_SCHEMA = vol.Schema({
    vol.Required("id"): cv.string,
    vol.Required("name"): cv.string,
    vol.Required("lights"): [cv.string],
})

async def async_register_services(hass: HomeAssistant) -> None:
    """Register services for Aurora Sound to Light."""
    
    # Get component instances
    def get_components():
        """Get required component instances."""
        if DOMAIN not in hass.data:
            raise HomeAssistantError("Integration not initialized")
        
        data = hass.data[DOMAIN]
        entry_id = next(iter(data))  # Get first entry
        components = data[entry_id]
        
        return (
            components.get("effect_engine"),
            components.get("light_controller"),
            components.get("audio_processor")
        )

    # Effect Management Services
    async def create_effect(call: ServiceCall) -> None:
        """Handle create_effect service call."""
        effect_engine, _, _ = get_components()
        
        try:
            effect_data = EFFECT_PARAMETER_SCHEMA(call.data)
            await effect_engine.create_effect(
                name=effect_data["name"],
                code=effect_data["code"],
                parameters=effect_data["parameters"],
                description=effect_data.get("description")
            )
            _LOGGER.info("Created new effect: %s", effect_data["name"])
        except Exception as err:
            _LOGGER.error("Failed to create effect: %s", err)
            raise HomeAssistantError(f"Failed to create effect: {err}") from err

    async def update_effect(call: ServiceCall) -> None:
        """Handle update_effect service call."""
        effect_engine, _, _ = get_components()
        
        try:
            effect_id = call.data["effect_id"]
            updates = {k: v for k, v in call.data.items() if k != "effect_id"}
            await effect_engine.update_effect(effect_id, updates)
            _LOGGER.info("Updated effect: %s", effect_id)
        except Exception as err:
            _LOGGER.error("Failed to update effect: %s", err)
            raise HomeAssistantError(f"Failed to update effect: {err}") from err

    async def delete_effect(call: ServiceCall) -> None:
        """Handle delete_effect service call."""
        effect_engine, _, _ = get_components()
        
        try:
            effect_id = call.data["effect_id"]
            await effect_engine.delete_effect(effect_id)
            _LOGGER.info("Deleted effect: %s", effect_id)
        except Exception as err:
            _LOGGER.error("Failed to delete effect: %s", err)
            raise HomeAssistantError(f"Failed to delete effect: {err}") from err

    @callback
    def list_effects(call: ServiceCall) -> List[Dict[str, Any]]:
        """Handle list_effects service call."""
        effect_engine, _, _ = get_components()
        return effect_engine.get_effects()

    async def set_effect(call: ServiceCall) -> None:
        """Handle set_effect service call."""
        effect_engine, light_controller, _ = get_components()
        
        try:
            effect_id = call.data["effect_id"]
            await effect_engine.activate_effect(effect_id, light_controller)
            _LOGGER.info("Activated effect: %s", effect_id)
        except Exception as err:
            _LOGGER.error("Failed to set effect: %s", err)
            raise HomeAssistantError(f"Failed to set effect: {err}") from err

    # Media Control Services
    async def set_media_player(call: ServiceCall) -> None:
        """Handle set_media_player service call."""
        _, _, audio_processor = get_components()
        
        try:
            entity_id = call.data["entity_id"]
            await audio_processor.set_media_player(entity_id)
            _LOGGER.info("Set media player: %s", entity_id)
        except Exception as err:
            _LOGGER.error("Failed to set media player: %s", err)
            raise HomeAssistantError(f"Failed to set media player: {err}") from err

    # Light Group Management Services
    async def update_groups(call: ServiceCall) -> None:
        """Handle update_groups service call."""
        _, light_controller, _ = get_components()
        
        try:
            groups = call.data["groups"]
            for group in groups:
                LIGHT_GROUP_SCHEMA(group)
            await light_controller.update_groups(groups)
            _LOGGER.info("Updated light groups configuration")
        except Exception as err:
            _LOGGER.error("Failed to update groups: %s", err)
            raise HomeAssistantError(f"Failed to update groups: {err}") from err

    # Register all services
    hass.services.async_register(DOMAIN, "create_effect", create_effect)
    hass.services.async_register(DOMAIN, "update_effect", update_effect)
    hass.services.async_register(DOMAIN, "delete_effect", delete_effect)
    hass.services.async_register(DOMAIN, "list_effects", list_effects)
    hass.services.async_register(DOMAIN, "set_effect", set_effect)
    hass.services.async_register(DOMAIN, "set_media_player", set_media_player)
    hass.services.async_register(DOMAIN, "update_groups", update_groups)

    _LOGGER.info("Registered Aurora Sound to Light services") 