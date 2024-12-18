"""Panel registration for Aurora Sound to Light."""
import logging
from typing import Any

from homeassistant.components import frontend, websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import system_info

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

async def async_setup_panel(hass):
    """Set up the Aurora panel."""
    hass.http.register_static_path(
        "/aurora_sound_to_light",
        hass.config.path("frontend"),
        True
    )

    hass.components.frontend.async_register_built_in_panel(
        component_name="custom",
        sidebar_title="Aurora",
        sidebar_icon="mdi:music-note",
        frontend_url_path="aurora_sound_to_light",
        config={"_panel_custom": {
            "name": "aurora-dashboard",
            "embed_iframe": True,
            "trust_external": False,
            "module_url": "/aurora_sound_to_light/index.js",
        }},
        require_admin=False
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
