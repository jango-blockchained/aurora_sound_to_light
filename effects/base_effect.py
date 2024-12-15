"""Base effect class for Aurora Sound to Light."""
import logging
from typing import Any, Dict, List, Optional

from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)


class BaseEffect:
    """Base class for light effects."""

    def __init__(
        self,
        hass: HomeAssistant,
        lights: List[str],
        params: Optional[Dict[str, Any]] = None
    ) -> None:
        """Initialize the effect.
        
        Args:
            hass: Home Assistant instance
            lights: List of light entity IDs
            params: Optional parameters for the effect
        """
        self.hass = hass
        self.lights = lights
        self.params = params or {}
        self._running = False

    async def start(self) -> None:
        """Start the effect."""
        self._running = True

    async def stop(self) -> None:
        """Stop the effect."""
        self._running = False

    async def update(
        self,
        audio_data: Optional[List[float]] = None,
        beat_detected: bool = False,
        bpm: int = 0
    ) -> None:
        """Update the effect with new audio data.
        
        Args:
            audio_data: FFT data from audio processing
            beat_detected: Whether a beat was detected
            bpm: Current beats per minute
        """
        raise NotImplementedError(
            "Effect classes must implement update method"
        )

    @property
    def is_running(self) -> bool:
        """Get the running state of the effect."""
        return self._running
