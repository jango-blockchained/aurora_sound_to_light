"""Panel registration for Aurora Sound to Light."""
import logging
from typing import Any

from homeassistant.components import frontend, websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import system_info

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

async def async_register_panel(hass: HomeAssistant) -> None:
    """Register the Aurora Sound to Light panel."""
    try:
        if DOMAIN not in hass.data:
            _LOGGER.warning("Aurora Sound to Light not initialized, skipping panel registration")
            return

        # Get system info for feature detection
        system = await system_info.async_get_system_info(hass)
        
        # Configure panel options
        panel_config = {
            "_panel_custom": {
                "name": "aurora-dashboard",
                "embed_iframe": False,
                "trust_external": False,
                "module_url": "/custom_components/aurora_sound_to_light/frontend/index.js",
            }
        }

        # Add system capabilities to panel config
        panel_config["system_info"] = {
            "has_audio": system.get("audio", {}).get("input", False),
            "has_media_player": "media_player" in hass.config.components,
            "has_spotify": "spotify" in hass.config.components,
        }

        # Register the panel
        frontend.async_register_built_in_panel(
            hass,
            component_name="custom",
            sidebar_title="Aurora",
            sidebar_icon="mdi:music-box-multiple",
            frontend_url_path="aurora-sound-to-light",
            require_admin=False,
            config=panel_config,
        )

        # Register WebSocket commands for panel configuration
        @callback
        @websocket_api.websocket_command({
            "type": "aurora_sound_to_light/get_panel_config",
        })
        @websocket_api.async_response
        async def websocket_get_panel_config(
            hass: HomeAssistant,
            connection: websocket_api.ActiveConnection,
            msg: dict[str, Any],
        ) -> None:
            """Handle get panel config command."""
            connection.send_result(msg["id"], panel_config)

        @callback
        @websocket_api.websocket_command({
            "type": "aurora_sound_to_light/update_panel_config",
            vol.Required("config"): dict,
        })
        @websocket_api.async_response
        async def websocket_update_panel_config(
            hass: HomeAssistant,
            connection: websocket_api.ActiveConnection,
            msg: dict[str, Any],
        ) -> None:
            """Handle update panel config command."""
            new_config = msg["config"]
            # Merge new config with existing, preserving required fields
            panel_config.update(new_config)
            connection.send_result(msg["id"], {"success": True})

        # Register WebSocket commands
        websocket_api.async_register_command(hass, websocket_get_panel_config)
        websocket_api.async_register_command(hass, websocket_update_panel_config)

        _LOGGER.info("Aurora Sound to Light panel registered successfully")
    except Exception as err:
        _LOGGER.error("Failed to register panel: %s", err)
        raise
