"""Effects package for Aurora Sound to Light."""
import logging
from typing import Dict, Type
from homeassistant.core import HomeAssistant

from .base_effect import BaseEffect
from .bass_pulse import BassPulseEffect
from .color_wave import ColorWaveEffect

_LOGGER = logging.getLogger(__name__)

__all__ = [
    "BaseEffect",
    "BassPulseEffect",
    "ColorWaveEffect",
]

class EffectEngine:
    """Engine for managing and running effects."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the effect engine."""
        self.hass = hass
        self._effects: Dict[str, Type[BaseEffect]] = {
            "bass_pulse": BassPulseEffect,
            "color_wave": ColorWaveEffect,
        }

    async def create_effect(self, effect_name: str, lights: list[str], params: dict | None = None) -> BaseEffect:
        """Create an effect instance."""
        if effect_name not in self._effects:
            raise ValueError(f"Unknown effect: {effect_name}")
        
        effect_class = self._effects[effect_name]
        return effect_class(self.hass, lights, params or {})

    def get_available_effects(self) -> list[str]:
        """Get list of available effects."""
        return list(self._effects.keys())

async def get_effect_engine(hass: HomeAssistant) -> EffectEngine:
    """Get or create an effect engine instance."""
    return EffectEngine(hass) 