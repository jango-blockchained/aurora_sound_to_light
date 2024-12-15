"""The Aurora Sound to Light integration."""
import logging
import sys
from pathlib import Path

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.components import frontend

from .const import DOMAIN
from .audio_processor import AudioProcessor
from .light_controller import LightController

_LOGGER = logging.getLogger(__name__)

PLATFORMS = [Platform.LIGHT, Platform.SENSOR]
MODULE_URL = "/local/aurora_sound_to_light/aurora-dashboard.js"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the Aurora Sound to Light component."""
    hass.data.setdefault(DOMAIN, {})

    # Create local directory for frontend files
    local_dir = Path(hass.config.path("www", "aurora_sound_to_light"))
    local_dir.mkdir(parents=True, exist_ok=True)

    # Copy frontend files to local directory
    src_dir = Path(
        hass.config.path(
            "custom_components",
            "aurora_sound_to_light",
            "frontend"
        )
    )

    try:
        files = await hass.async_add_executor_job(
            lambda: [
                f for f in src_dir.iterdir()
                if f.suffix in ['.js', '.html']
            ]
        )

        for src_path in files:
            dst_path = local_dir / src_path.name
            try:
                content = await hass.async_add_executor_job(
                    lambda: src_path.read_bytes()
                )
                await hass.async_add_executor_job(
                    lambda: dst_path.write_bytes(content)
                )
                _LOGGER.debug("Copied frontend file: %s", src_path.name)
            except Exception as err:
                _LOGGER.error(
                    "Failed to copy frontend file %s: %s",
                    src_path.name,
                    err
                )
    except Exception as err:
        _LOGGER.error("Failed to process frontend files: %s", err)

    # Register the panel
    try:
        frontend.async_register_built_in_panel(
            hass,
            component_name="custom",
            sidebar_title="Aurora",
            sidebar_icon="mdi:lightbulb-multiple",
            frontend_url_path="aurora-sound-to-light",
            config={
                "_panel_custom": {
                    "name": "aurora-dashboard",
                    "embed_iframe": False,
                    "trust_external": True,
                    "module_url": MODULE_URL,
                }
            },
            require_admin=False
        )
        _LOGGER.info("Successfully registered Aurora panel")
    except Exception as err:
        _LOGGER.error("Failed to register panel: %s", err)

    return True


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

        # Initialize components
        audio_processor = AudioProcessor(hass, entry.data)
        light_controller = LightController(hass)

        # Store references
        hass.data.setdefault(DOMAIN, {})
        hass.data[DOMAIN][entry.entry_id] = {
            "audio_processor": audio_processor,
            "light_controller": light_controller,
        }

        await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
        return True

    except Exception as err:
        _LOGGER.error("Failed to set up integration: %s", err)
        return False


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    try:
        unload_ok = await hass.config_entries.async_unload_platforms(
            entry,
            PLATFORMS
        )

        if unload_ok:
            if DOMAIN in hass.data and entry.entry_id in hass.data[DOMAIN]:
                data = hass.data[DOMAIN].pop(entry.entry_id)
                if "audio_processor" in data:
                    await data["audio_processor"].stop()

        return unload_ok

    except Exception as err:
        _LOGGER.error("Error unloading entry: %s", err)
        return False
