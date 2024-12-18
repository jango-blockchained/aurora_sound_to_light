"""Effect engine and base classes for Aurora Sound to Light."""
from typing import List, Optional, Dict, Type
from homeassistant.core import HomeAssistant

class BaseEffect:
    """Base class for all effects."""

    def __init__(
        self,
        hass: HomeAssistant,
        lights: List[str],
        params: Optional[dict] = None
    ) -> None:
        """Initialize the effect."""
        self.hass = hass
        self.lights = lights
        self.params = params or {}
        self.is_running = False

    async def start(self) -> None:
        """Start the effect."""
        self.is_running = True

    async def stop(self) -> None:
        """Stop the effect."""
        self.is_running = False

    async def update(
        self,
        audio_data: Optional[List[float]] = None,
        beat_detected: bool = False,
        bpm: int = 0
    ) -> None:
        """Update the effect with new audio data."""
        raise NotImplementedError


class EffectEngine:
    """Main effect engine class."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the effect engine."""
        self.hass = hass
        self._effects: Dict[str, Type[BaseEffect]] = {}
        self._register_builtin_effects()

    def _register_builtin_effects(self) -> None:
        """Register built-in effects."""
        from .effects_impl import BassPulseEffect, ColorWaveEffect
        self._effects["bass_pulse"] = BassPulseEffect
        self._effects["color_wave"] = ColorWaveEffect

    def get_available_effects(self) -> List[str]:
        """Get list of available effects."""
        return list(self._effects.keys())

    async def create_effect(
        self,
        effect_name: str,
        lights: List[str],
        params: Optional[dict] = None
    ) -> BaseEffect:
        """Create an effect instance."""
        if effect_name not in self._effects:
            raise ValueError(f"Unknown effect: {effect_name}")
        
        effect_class = self._effects[effect_name]
        return effect_class(self.hass, lights, params)


_EFFECT_ENGINE: Optional[EffectEngine] = None


async def get_effect_engine(hass: HomeAssistant) -> EffectEngine:
    """Get or create the effect engine instance."""
    global _EFFECT_ENGINE
    if _EFFECT_ENGINE is None:
        _EFFECT_ENGINE = EffectEngine(hass)
    return _EFFECT_ENGINE 