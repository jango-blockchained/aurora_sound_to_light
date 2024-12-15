"""Custom effect creator for Aurora Sound to Light."""
from __future__ import annotations

import logging
import json
import os
import colorsys
from typing import Any, Dict, List, Optional
import voluptuous as vol

from homeassistant.core import HomeAssistant
from homeassistant.helpers import storage
from homeassistant.util import slugify

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

STORAGE_KEY = f"{DOMAIN}.effects"
STORAGE_VERSION = 1

# Effect parameter schemas
PARAM_TYPES = {
    "number": vol.Schema({
        vol.Required("type"): "number",
        vol.Required("name"): str,
        vol.Required("min"): float,
        vol.Required("max"): float,
        vol.Required("step"): float,
        vol.Required("default"): float,
        vol.Optional("unit"): str,
    }),
    "color": vol.Schema({
        vol.Required("type"): "color",
        vol.Required("name"): str,
        vol.Required("default"): (int, int, int),
    }),
    "boolean": vol.Schema({
        vol.Required("type"): "boolean",
        vol.Required("name"): str,
        vol.Required("default"): bool,
    }),
    "select": vol.Schema({
        vol.Required("type"): "select",
        vol.Required("name"): str,
        vol.Required("options"): [str],
        vol.Required("default"): str,
    }),
}

class CustomEffect:
    """Represents a custom light effect."""

    def __init__(
        self,
        name: str,
        parameters: Dict[str, Any],
        code: str,
        description: Optional[str] = None,
    ) -> None:
        """Initialize the custom effect."""
        self.name = name
        self.id = slugify(name)
        self.parameters = parameters
        self.code = code
        self.description = description or ""
        self._compiled_code = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert effect to dictionary for storage."""
        return {
            "name": self.name,
            "id": self.id,
            "parameters": self.parameters,
            "code": self.code,
            "description": self.description,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> CustomEffect:
        """Create effect from dictionary."""
        return cls(
            name=data["name"],
            parameters=data["parameters"],
            code=data["code"],
            description=data.get("description", ""),
        )

    def compile(self) -> None:
        """Compile the effect code."""
        try:
            # Create a safe namespace for the effect code
            namespace = {
                'colorsys': colorsys,
                'min': min,
                'max': max,
                'abs': abs,
                'int': int,
                'float': float,
                'round': round,
                'sum': sum,
                'len': len,
            }
            # Compile the code
            self._compiled_code = compile(self.code, f"<effect_{self.id}>", "exec")
            return True
        except Exception as err:
            _LOGGER.error("Error compiling effect %s: %s", self.name, err)
            return False

    def execute(
        self,
        audio_data: Dict[str, Any],
        parameters: Dict[str, Any],
        num_lights: int,
    ) -> List[Dict[str, Any]]:
        """Execute the effect code with given parameters."""
        if self._compiled_code is None and not self.compile():
            return []

        try:
            # Create execution namespace
            namespace = {
                'audio_data': audio_data,
                'parameters': parameters,
                'num_lights': num_lights,
                'result': [],
                'colorsys': colorsys,
                'min': min,
                'max': max,
                'abs': abs,
                'int': int,
                'float': float,
                'round': round,
                'sum': sum,
                'len': len,
            }

            # Execute the code
            exec(self._compiled_code, namespace)

            # Get the result
            result = namespace.get('result', [])
            if not isinstance(result, list):
                raise ValueError("Effect must return a list of light states")

            # Validate result format
            for state in result:
                if not isinstance(state, dict):
                    raise ValueError("Each light state must be a dictionary")
                if 'brightness' in state and not isinstance(state['brightness'], (int, float)):
                    raise ValueError("Brightness must be a number")
                if 'rgb_color' in state and not isinstance(state['rgb_color'], (tuple, list)):
                    raise ValueError("RGB color must be a tuple or list")

            return result

        except Exception as err:
            _LOGGER.error("Error executing effect %s: %s", self.name, err)
            return []


class EffectManager:
    """Manages custom effects storage and execution."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the effect manager."""
        self.hass = hass
        self._store = storage.Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self._effects: Dict[str, CustomEffect] = {}

    async def async_load(self) -> None:
        """Load effects from storage."""
        data = await self._store.async_load()
        if data:
            for effect_data in data.get("effects", []):
                effect = CustomEffect.from_dict(effect_data)
                self._effects[effect.id] = effect

    async def async_save(self) -> None:
        """Save effects to storage."""
        data = {
            "effects": [effect.to_dict() for effect in self._effects.values()]
        }
        await self._store.async_save(data)

    def get_effect(self, effect_id: str) -> Optional[CustomEffect]:
        """Get effect by ID."""
        return self._effects.get(effect_id)

    def list_effects(self) -> List[Dict[str, Any]]:
        """List all available effects."""
        return [
            {
                "id": effect.id,
                "name": effect.name,
                "description": effect.description,
                "parameters": effect.parameters,
            }
            for effect in self._effects.values()
        ]

    async def async_add_effect(
        self,
        name: str,
        parameters: Dict[str, Any],
        code: str,
        description: Optional[str] = None,
    ) -> Optional[str]:
        """Add a new custom effect."""
        # Validate parameters schema
        try:
            for param_name, param_def in parameters.items():
                param_type = param_def["type"]
                if param_type not in PARAM_TYPES:
                    raise ValueError(f"Invalid parameter type: {param_type}")
                PARAM_TYPES[param_type](param_def)
        except Exception as err:
            _LOGGER.error("Invalid parameters for effect %s: %s", name, err)
            return None

        # Create and test compile the effect
        effect = CustomEffect(name, parameters, code, description)
        if not effect.compile():
            return None

        # Add to storage
        self._effects[effect.id] = effect
        await self.async_save()
        return effect.id

    async def async_update_effect(
        self,
        effect_id: str,
        parameters: Optional[Dict[str, Any]] = None,
        code: Optional[str] = None,
        description: Optional[str] = None,
    ) -> bool:
        """Update an existing effect."""
        effect = self.get_effect(effect_id)
        if not effect:
            return False

        if parameters is not None:
            # Validate new parameters
            try:
                for param_name, param_def in parameters.items():
                    param_type = param_def["type"]
                    if param_type not in PARAM_TYPES:
                        raise ValueError(f"Invalid parameter type: {param_type}")
                    PARAM_TYPES[param_type](param_def)
                effect.parameters = parameters
            except Exception as err:
                _LOGGER.error("Invalid parameters for effect %s: %s", effect.name, err)
                return False

        if code is not None:
            effect.code = code
            if not effect.compile():
                return False

        if description is not None:
            effect.description = description

        await self.async_save()
        return True

    async def async_delete_effect(self, effect_id: str) -> bool:
        """Delete an effect."""
        if effect_id in self._effects:
            del self._effects[effect_id]
            await self.async_save()
            return True
        return False

    def execute_effect(
        self,
        effect_id: str,
        audio_data: Dict[str, Any],
        parameters: Dict[str, Any],
        num_lights: int,
    ) -> List[Dict[str, Any]]:
        """Execute an effect with given parameters."""
        effect = self.get_effect(effect_id)
        if not effect:
            return []
        return effect.execute(audio_data, parameters, num_lights) 