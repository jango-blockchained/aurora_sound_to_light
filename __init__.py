"""The Aurora Sound to Light integration."""
import logging
import sys

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant

from .const import DOMAIN
from .core.audio_processor import AudioProcessor
from .core.light_controller import LightController
from .core.effect_engine import EffectEngine
from .services import async_register_services
from .cache import AuroraCache

_LOGGER = logging.getLogger(__name__)

PLATFORMS = [Platform.LIGHT, Platform.SENSOR]
MODULE_URL = "/local/aurora_sound_to_light/aurora-dashboard.js"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Aurora Sound to Light from a config entry."""
    try:
        # Log basic information
        _LOGGER.info("Setting up Aurora Sound to Light integration")
        _LOGGER.info("Python version: %s", sys.version)
        _LOGGER.info(
            "Home Assistant version: %s",
            getattr(hass, "version", "unknown")
        )

        # Initialize cache system
        cache = AuroraCache(hass)
        await cache.async_setup()

        # Initialize components
        audio_processor = AudioProcessor(hass, entry.data)
        light_controller = LightController(hass)
        effect_engine = EffectEngine(hass)

        # Store references
        hass.data.setdefault(DOMAIN, {})
        hass.data[DOMAIN][entry.entry_id] = {
            "audio_processor": audio_processor,
            "light_controller": light_controller,
            "effect_engine": effect_engine,
            "cache": cache,
        }

        # Register services
        await async_register_services(hass)

        # Forward entry setup to platforms
        await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
        return True

    except Exception as err:
        _LOGGER.error("Failed to set up integration: %s", err)
        return False


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    try:
        unload_ok: bool = await hass.config_entries.async_unload_platforms(
            entry,
            PLATFORMS
        )

        if unload_ok:
            if DOMAIN in hass.data and entry.entry_id in hass.data[DOMAIN]:
                data = hass.data[DOMAIN].pop(entry.entry_id)
                if "audio_processor" in data:
                    await data["audio_processor"].stop()
                if "effect_engine" in data:
                    await data["effect_engine"].cleanup()
                if "cache" in data:
                    await data["cache"].async_stop()

        return unload_ok

    except Exception as err:
        _LOGGER.error("Error unloading entry: %s", err)
        return False 