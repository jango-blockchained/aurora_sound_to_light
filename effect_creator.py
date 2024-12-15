"""Effect creator for Aurora Sound to Light."""
from typing import Any, Dict, List, Optional
import logging
import colorsys
from homeassistant.core import HomeAssistant
from homeassistant.util import slugify
from homeassistant.helpers import storage

from .const import (
    DOMAIN,
    PARAM_COLOR,
    PARAM_SPEED,
    PARAM_BRIGHTNESS,
    PARAM_TRANSITION_TIME,
    DEFAULT_COLOR,
    DEFAULT_SPEED,
    DEFAULT_BRIGHTNESS,
    DEFAULT_TRANSITION_TIME,
)
from .effects.base_effect import BaseEffect

_LOGGER = logging.getLogger(__name__)

STORAGE_KEY = f"{DOMAIN}.effects"
STORAGE_VERSION = 1

# Effect parameter schemas
PARAM_TYPES = {
    "number": {
        "type": "number",
        "name": str,
        "min": float,
        "max": float,
        "step": float,
        "default": float,
        "unit": str,
    },
    "color": {
        "type": "color",
        "name": str,
        "default": (int, int, int),
    },
    "boolean": {
        "type": "boolean",
        "name": str,
        "default": bool,
    },
    "select": {
        "type": "select",
        "name": str,
        "options": [str],
        "default": str,
    },
}


class EffectCreator:
    """Create and manage custom effects."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the effect creator."""
        self.hass = hass
        self._store = storage.Store(
            hass,
            STORAGE_VERSION,
            STORAGE_KEY,
            private=True,
            atomic_writes=True
        )
        self._effects: Dict[str, BaseEffect] = {}

    async def async_load(self) -> None:
        """Load saved effects."""
        try:
            data = await self._store.async_load()
            if data:
                for effect_data in data.get("effects", []):
                    effect_id = slugify(effect_data["name"])
                    self._effects[effect_id] = self._create_effect(
                        effect_data["name"],
                        effect_data["config"]
                    )
        except Exception as err:
            _LOGGER.error("Failed to load effects: %s", err)

    async def async_save(self) -> None:
        """Save effects to storage."""
        data = {
            "effects": [
                {
                    "name": effect.name,
                    "config": effect.config,
                }
                for effect in self._effects.values()
            ]
        }
        await self._store.async_save(data)

    def _create_effect(
        self,
        name: str,
        config: Dict[str, Any]
    ) -> BaseEffect:
        """Create a new effect instance."""
        try:
            # Validate parameters
            for param_name, param_config in config.get("parameters", {}).items():
                param_type = param_config.get("type")
                if param_type not in PARAM_TYPES:
                    raise ValueError(
                        f"Invalid parameter type '{param_type}' "
                        f"for {param_name}"
                    )
                self._validate_param_config(param_type, param_config)

            effect_class = self._create_effect_class(name, config)
            return effect_class(self.hass, [], {})

        except Exception as err:
            _LOGGER.error("Failed to create effect: %s", err)
            raise

    def _validate_param_config(
        self,
        param_type: str,
        config: Dict[str, Any]
    ) -> None:
        """Validate parameter configuration."""
        schema = PARAM_TYPES[param_type]
        for key, value_type in schema.items():
            if key not in config:
                if key == "unit":  # unit is optional
                    continue
                raise ValueError(f"Missing required field '{key}'")
            if not isinstance(config[key], value_type):
                raise ValueError(
                    f"Invalid type for '{key}', expected {value_type}"
                )

    def _create_effect_class(
        self,
        effect_name: str,
        effect_config: Dict[str, Any]
    ) -> type:
        """Create a new effect class from configuration."""
        try:
            effect_class = type(
                effect_name,
                (BaseEffect,),
                {
                    "name": effect_name,
                    "config": effect_config,
                    "async_update": self._create_update_method(effect_config),
                }
            )
            return effect_class

        except Exception as err:
            _LOGGER.error("Failed to create effect class: %s", err)
            raise

    def _create_update_method(
        self,
        config: Dict[str, Any]
    ) -> Any:
        """Create the update method for the effect."""
        def update_method(self, audio_data, beat_detected, bpm):
            pass
        return update_method
