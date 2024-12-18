"""Test module for Aurora Sound to Light effects."""
import pytest
from unittest.mock import MagicMock, patch
import numpy as np

from homeassistant.core import HomeAssistant
from homeassistant.components.light import ATTR_BRIGHTNESS, ATTR_RGB_COLOR

from custom_components.aurora_sound_to_light.effects_impl import (
    BassPulseEffect,
    ColorWaveEffect,
)

@pytest.fixture
def hass():
    """Home Assistant fixture."""
    mock_hass = MagicMock(spec=HomeAssistant)
    mock_hass.services = MagicMock()
    mock_hass.services.call = MagicMock(return_value=None)
    mock_hass.states = MagicMock()
    return mock_hass


@pytest.mark.asyncio
class TestBassPulseEffect:
    """Test cases for BassPulseEffect."""

    async def test_initialization(self, hass):
        """Test bass pulse effect initialization."""
        lights = ["light.test1", "light.test2"]
        params = {
            "min_brightness": 50,
            "max_brightness": 255,
            "color": [255, 0, 0],
            "sensitivity": 1.2
        }
        effect = BassPulseEffect(hass, lights, params)

        assert effect.lights == lights
        assert effect.params == params
        assert not effect.is_running

    async def test_update_with_beat(self, hass):
        """Test update behavior when beat is detected."""
        lights = ["light.test1"]
        effect = BassPulseEffect(hass, lights)
        await effect.start()

        # Simulate a strong bass frequency
        audio_data = np.zeros(1024)
        audio_data[0:10] = 0.8  # Strong bass frequencies
        
        await effect.update(audio_data.tolist(), True, 120)

        # Verify light service was called with max brightness
        hass.services.call.assert_called_with(
            "light", "turn_on",
            {"entity_id": lights[0], "brightness": 255, "rgb_color": [255, 0, 0]}
        )

    async def test_update_without_beat(self, hass):
        """Test update behavior when no beat is detected."""
        lights = ["light.test1"]
        effect = BassPulseEffect(hass, lights)
        await effect.start()

        # Simulate weak bass frequencies
        audio_data = np.zeros(1024)
        audio_data[0:10] = 0.1  # Weak bass frequencies
        
        await effect.update(audio_data.tolist(), False, 120)

        # Verify light service was called with min brightness
        hass.services.call.assert_called_with(
            "light", "turn_on",
            {"entity_id": lights[0], "brightness": 50, "rgb_color": [255, 0, 0]}
        )


@pytest.mark.asyncio
class TestColorWaveEffect:
    """Test cases for ColorWaveEffect."""

    async def test_initialization(self, hass):
        """Test color wave effect initialization."""
        lights = ["light.test1", "light.test2"]
        params = {
            "speed": 1.0,
            "colors": [[255, 0, 0], [0, 255, 0], [0, 0, 255]],
            "transition_time": 1.0
        }
        effect = ColorWaveEffect(hass, lights, params)

        assert effect.lights == lights
        assert effect.params == params
        assert not effect.is_running

    async def test_color_transition(self, hass):
        """Test color transition behavior."""
        lights = ["light.test1"]
        params = {
            "colors": [[255, 0, 0], [0, 255, 0]],
            "speed": 1.0,
            "transition_time": 0.1
        }
        effect = ColorWaveEffect(hass, lights, params)
        await effect.start()

        # Update multiple times to test color transition
        for _ in range(5):
            await effect.update(None, False, 120)
            # Verify light service was called with changing colors
            assert hass.services.call.called
            call_args = hass.services.call.call_args[0]
            assert call_args[0] == "light"
            assert call_args[1] == "turn_on"
            assert "entity_id" in call_args[2]
            assert "rgb_color" in call_args[2]

    async def test_beat_sync(self, hass):
        """Test beat synchronization."""
        lights = ["light.test1"]
        effect = ColorWaveEffect(hass, lights, {"beat_sync": True})
        await effect.start()

        # Test with beat
        await effect.update(None, True, 120)
        assert hass.services.call.called

        # Test without beat
        hass.services.call.reset_mock()
        await effect.update(None, False, 120)
        assert hass.services.call.called 