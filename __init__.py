"""The Aurora Sound to Light integration."""
from __future__ import annotations

import logging
import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.const import Platform
from homeassistant.helpers import entity_registry
import homeassistant.helpers.config_validation as cv

from .const import (
    DOMAIN,
    CONF_AUDIO_INPUT,
    CONF_BUFFER_SIZE,
    CONF_LATENCY_THRESHOLD,
    DEFAULT_BUFFER_SIZE,
    DEFAULT_LATENCY_THRESHOLD,
)
from .audio_processor import AudioProcessor
from .light_controller import LightController

_LOGGER = logging.getLogger(__name__)

PLATFORMS = [Platform.LIGHT, Platform.SENSOR]

# Service schemas
CREATE_EFFECT_SCHEMA = vol.Schema({
    vol.Required("name"): cv.string,
    vol.Required("code"): cv.string,
    vol.Required("parameters"): dict,
    vol.Optional("description"): cv.string,
})

UPDATE_EFFECT_SCHEMA = vol.Schema({
    vol.Required("effect_id"): cv.string,
    vol.Optional("code"): cv.string,
    vol.Optional("parameters"): dict,
    vol.Optional("description"): cv.string,
})

DELETE_EFFECT_SCHEMA = vol.Schema({
    vol.Required("effect_id"): cv.string,
})

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Aurora Sound to Light from a config entry."""
    hass.data.setdefault(DOMAIN, {})
    
    # Get configuration
    config = entry.data
    audio_input = config[CONF_AUDIO_INPUT]
    buffer_size = config.get(CONF_BUFFER_SIZE, DEFAULT_BUFFER_SIZE)
    latency_threshold = config.get(CONF_LATENCY_THRESHOLD, DEFAULT_LATENCY_THRESHOLD)
    
    # Create light controller
    light_controller = LightController(hass, [], latency_threshold)
    
    # Create audio processor with callback to light controller
    audio_processor = AudioProcessor(
        hass,
        audio_input,
        buffer_size=buffer_size,
        callback=light_controller.process_audio_data
    )
    
    # Store instances
    hass.data[DOMAIN][entry.entry_id] = {
        "audio_processor": audio_processor,
        "light_controller": light_controller,
    }
    
    # Initialize components
    await light_controller.async_setup()
    await audio_processor.start()
    
    # Register services
    async def create_effect(call: ServiceCall) -> None:
        """Handle create effect service call."""
        light_controller = next(iter(hass.data[DOMAIN].values()))["light_controller"]
        effect_id = await light_controller.add_custom_effect(
            name=call.data["name"],
            code=call.data["code"],
            parameters=call.data["parameters"],
            description=call.data.get("description"),
        )
        if effect_id:
            _LOGGER.info("Created custom effect: %s", effect_id)
        else:
            _LOGGER.error("Failed to create custom effect")

    async def update_effect(call: ServiceCall) -> None:
        """Handle update effect service call."""
        light_controller = next(iter(hass.data[DOMAIN].values()))["light_controller"]
        success = await light_controller.update_custom_effect(
            effect_id=call.data["effect_id"],
            code=call.data.get("code"),
            parameters=call.data.get("parameters"),
            description=call.data.get("description"),
        )
        if success:
            _LOGGER.info("Updated custom effect: %s", call.data["effect_id"])
        else:
            _LOGGER.error("Failed to update custom effect: %s", call.data["effect_id"])

    async def delete_effect(call: ServiceCall) -> None:
        """Handle delete effect service call."""
        light_controller = next(iter(hass.data[DOMAIN].values()))["light_controller"]
        success = await light_controller.delete_custom_effect(call.data["effect_id"])
        if success:
            _LOGGER.info("Deleted custom effect: %s", call.data["effect_id"])
        else:
            _LOGGER.error("Failed to delete custom effect: %s", call.data["effect_id"])

    async def list_effects(call: ServiceCall) -> None:
        """Handle list effects service call."""
        light_controller = next(iter(hass.data[DOMAIN].values()))["light_controller"]
        return {"effects": light_controller.available_effects}

    hass.services.async_register(
        DOMAIN, "create_effect", create_effect, schema=CREATE_EFFECT_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, "update_effect", update_effect, schema=UPDATE_EFFECT_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, "delete_effect", delete_effect, schema=DELETE_EFFECT_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, "list_effects", list_effects
    )
    
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    # Stop audio processing
    if DOMAIN in hass.data and entry.entry_id in hass.data[DOMAIN]:
        audio_processor = hass.data[DOMAIN][entry.entry_id]["audio_processor"]
        light_controller = hass.data[DOMAIN][entry.entry_id]["light_controller"]
        
        await audio_processor.stop()
        await light_controller.stop()
    
    # Unload platforms
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)

    return unload_ok