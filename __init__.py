"""The Aurora Sound to Light integration."""
import logging
import sys
import asyncio

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant

from .const import DOMAIN
from .audio_processor import AudioProcessor
from .light_controller import LightController

_LOGGER = logging.getLogger(__name__)

PLATFORMS = [Platform.LIGHT, Platform.SENSOR]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Aurora Sound to Light from a config entry."""
    try:
        # Log basic information
        _LOGGER.info("Setting up Aurora Sound to Light integration")
        _LOGGER.info("Python version: %s", sys.version)
        _LOGGER.info("Home Assistant version: %s", getattr(hass, "version", "unknown"))

        # Initialize components
        audio_processor = AudioProcessor(hass, entry.data)
        light_controller = LightController(hass)

        # Store references
        hass.data.setdefault(DOMAIN, {})
        hass.data[DOMAIN][entry.entry_id] = {
            "audio_processor": audio_processor,
            "light_controller": light_controller,
        }

        # Set up platforms one by one to avoid blocking imports
        for platform in PLATFORMS:
            hass.async_create_task(
                hass.config_entries.async_forward_entry_setup(entry, platform)
            )

        return True

    except Exception as err:
        _LOGGER.error("Failed to set up integration: %s", err)
        return False


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    try:
        # Unload platforms one by one
        unload_ok = True
        for platform in PLATFORMS:
            try:
                await hass.config_entries.async_forward_entry_unload(entry, platform)
            except Exception as err:
                _LOGGER.error("Error unloading platform %s: %s", platform, err)
                unload_ok = False

        if unload_ok:
            # Clean up
            if DOMAIN in hass.data and entry.entry_id in hass.data[DOMAIN]:
                data = hass.data[DOMAIN].pop(entry.entry_id)
                if "audio_processor" in data:
                    await data["audio_processor"].stop()

        return unload_ok

    except Exception as err:
        _LOGGER.error("Error unloading entry: %s", err)
        return False