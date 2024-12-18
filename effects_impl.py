"""Implementation of Aurora Sound to Light effects."""
from typing import List, Optional
import numpy as np
from homeassistant.core import HomeAssistant
from homeassistant.components.light import ATTR_BRIGHTNESS, ATTR_RGB_COLOR

from .effects import BaseEffect


class BassPulseEffect(BaseEffect):
    """Effect that pulses lights based on bass frequencies."""

    def __init__(
        self,
        hass: HomeAssistant,
        lights: List[str],
        params: Optional[dict] = None
    ) -> None:
        """Initialize bass pulse effect."""
        super().__init__(hass, lights, params)
        self._min_brightness = self.params.get("min_brightness", 50)
        self._max_brightness = self.params.get("max_brightness", 255)
        self._color = self.params.get("color", [255, 0, 0])
        self._sensitivity = self.params.get("sensitivity", 1.0)

    async def update(
        self,
        audio_data: Optional[List[float]] = None,
        beat_detected: bool = False,
        bpm: int = 0
    ) -> None:
        """Update effect based on audio data."""
        if not self.is_running or not audio_data:
            return

        # Calculate bass energy (first few frequency bins)
        bass_energy = np.mean(audio_data[:10]) if audio_data else 0
        brightness = int(
            self._min_brightness +
            (self._max_brightness - self._min_brightness) *
            min(1.0, bass_energy * self._sensitivity)
        )

        # Update each light
        for light in self.lights:
            await self.hass.services.call(
                "light",
                "turn_on",
                {
                    "entity_id": light,
                    ATTR_BRIGHTNESS: brightness,
                    ATTR_RGB_COLOR: self._color
                }
            )


class ColorWaveEffect(BaseEffect):
    """Effect that creates a wave of colors across lights."""

    def __init__(
        self,
        hass: HomeAssistant,
        lights: List[str],
        params: Optional[dict] = None
    ) -> None:
        """Initialize color wave effect."""
        super().__init__(hass, lights, params)
        self._colors = self.params.get("colors", [
            [255, 0, 0],
            [0, 255, 0],
            [0, 0, 255]
        ])
        self._speed = self.params.get("speed", 1.0)
        self._transition_time = self.params.get("transition_time", 1.0)
        self._phase = 0.0
        self._beat_sync = self.params.get("beat_sync", False)

    async def update(
        self,
        audio_data: Optional[List[float]] = None,
        beat_detected: bool = False,
        bpm: int = 0
    ) -> None:
        """Update effect based on audio data and beats."""
        if not self.is_running:
            return

        # Update phase
        if self._beat_sync and beat_detected:
            self._phase += 1.0
        else:
            self._phase += 0.1 * self._speed

        # Calculate color for each light
        for i, light in enumerate(self.lights):
            phase = (self._phase + i / len(self.lights)) % len(self._colors)
            color_idx = int(phase)
            next_idx = (color_idx + 1) % len(self._colors)
            fraction = phase - color_idx

            # Interpolate between colors
            color = [
                int(self._colors[color_idx][j] * (1 - fraction) +
                    self._colors[next_idx][j] * fraction)
                for j in range(3)
            ]

            await self.hass.services.call(
                "light",
                "turn_on",
                {
                    "entity_id": light,
                    ATTR_RGB_COLOR: color,
                    "transition": self._transition_time
                }
            ) 


class StrobeEffect(BaseEffect):
    """Effect that creates a strobe light effect, optionally synchronized with beats."""

    def __init__(
        self,
        hass: HomeAssistant,
        lights: List[str],
        params: Optional[dict] = None
    ) -> None:
        """Initialize strobe effect."""
        super().__init__(hass, lights, params)
        self._color = self.params.get("color", [255, 255, 255])
        self._frequency = self.params.get("frequency", 2.0)  # Hz
        self._duty_cycle = self.params.get("duty_cycle", 0.5)  # 0.0 to 1.0
        self._beat_sync = self.params.get("beat_sync", False)
        self._brightness = self.params.get("brightness", 255)
        self._state = False
        self._counter = 0.0

    async def update(
        self,
        audio_data: Optional[List[float]] = None,
        beat_detected: bool = False,
        bpm: int = 0
    ) -> None:
        """Update effect based on timing or beats."""
        if not self.is_running:
            return

        # Update state based on beat sync or frequency
        if self._beat_sync:
            if beat_detected:
                self._state = True
            else:
                self._state = False
        else:
            self._counter += 0.1  # Assuming 100ms update interval
            period = 1.0 / self._frequency
            self._state = (self._counter % period) < (period * self._duty_cycle)

        # Update lights
        for light in self.lights:
            if self._state:
                await self.hass.services.call(
                    "light",
                    "turn_on",
                    {
                        "entity_id": light,
                        ATTR_BRIGHTNESS: self._brightness,
                        ATTR_RGB_COLOR: self._color
                    }
                )
            else:
                await self.hass.services.call(
                    "light",
                    "turn_off",
                    {
                        "entity_id": light
                    }
                )


class MultiColorEffect(BaseEffect):
    """Effect that assigns different colors to multiple lights with various patterns."""

    def __init__(
        self,
        hass: HomeAssistant,
        lights: List[str],
        params: Optional[dict] = None
    ) -> None:
        """Initialize multi color effect."""
        super().__init__(hass, lights, params)
        self._colors = self.params.get("colors", [
            [255, 0, 0],
            [0, 255, 0],
            [0, 0, 255],
            [255, 255, 0],
            [255, 0, 255],
            [0, 255, 255]
        ])
        self._pattern = self.params.get("pattern", "alternate")  # alternate, random, sequence
        self._transition_time = self.params.get("transition_time", 1.0)
        self._change_on_beat = self.params.get("change_on_beat", False)
        self._brightness = self.params.get("brightness", 255)
        self._current_colors = {}
        self._initialize_colors()

    def _initialize_colors(self) -> None:
        """Initialize colors for each light based on the selected pattern."""
        if self._pattern == "alternate":
            for i, light in enumerate(self.lights):
                self._current_colors[light] = self._colors[i % len(self._colors)]
        elif self._pattern == "random":
            import random
            for light in self.lights:
                self._current_colors[light] = random.choice(self._colors)
        else:  # sequence
            color_idx = 0
            for light in self.lights:
                self._current_colors[light] = self._colors[color_idx]
                color_idx = (color_idx + 1) % len(self._colors)

    async def update(
        self,
        audio_data: Optional[List[float]] = None,
        beat_detected: bool = False,
        bpm: int = 0
    ) -> None:
        """Update effect based on pattern and beats."""
        if not self.is_running:
            return

        # Change colors if beat detected and change_on_beat is enabled
        if self._change_on_beat and beat_detected:
            self._initialize_colors()

        # Update each light with its color
        for light in self.lights:
            await self.hass.services.call(
                "light",
                "turn_on",
                {
                    "entity_id": light,
                    ATTR_BRIGHTNESS: self._brightness,
                    ATTR_RGB_COLOR: self._current_colors[light],
                    "transition": self._transition_time
                }
            )

