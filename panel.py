"""Panel registration for Aurora Sound to Light."""
import logging

from homeassistant.components import frontend
from homeassistant.core import HomeAssistant

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


async def async_register_panel(hass: HomeAssistant) -> None:
    """Register the Aurora Sound to Light panel."""
    try:
        if DOMAIN not in hass.data:
            return

        module_url = (
            "/custom_components/aurora_sound_to_light/"
            "frontend/aurora-dashboard.js"
        )

        frontend.async_register_built_in_panel(
            hass,
            component_name="custom",
            sidebar_title="Aurora",
            sidebar_icon="mdi:lightbulb-multiple",
            frontend_url_path="aurora-sound-to-light",
            require_admin=False,
            config={
                "_panel_custom": {
                    "name": "aurora-dashboard",
                    "module_url": module_url,
                    "embed_iframe": True,
                    "trust_external": False,
                }
            },
        )
        _LOGGER.info("Aurora Sound to Light panel registered successfully")
    except Exception as err:
        _LOGGER.error("Failed to register panel: %s", err) 