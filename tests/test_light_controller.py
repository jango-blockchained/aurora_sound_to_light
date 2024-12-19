"""Tests for the light controller component."""
import pytest
from unittest.mock import Mock, patch
from typing import Dict, Any

from homeassistant.core import HomeAssistant
from homeassistant.components.light import (
    ATTR_BRIGHTNESS,
    ATTR_RGB_COLOR,
    ATTR_TRANSITION,
)

from custom_components.aurora_sound_to_light.core.light_controller import LightController


@pytest.fixture
def light_controller(hass: HomeAssistant) -> LightController:
    """Create a light controller instance for testing."""
    return LightController(hass)


@pytest.fixture
def mock_effect_engine() -> Mock:
    """Create a mock effect engine."""
    mock_engine = Mock()
    mock_effect = Mock()
    mock_engine.create_effect.return_value = mock_effect
    return mock_engine


async def test_init(light_controller: LightController) -> None:
    """Test initialization."""
    assert light_controller.hass is not None
    assert light_controller._lights == {}
    assert light_controller._effect_engine is None
    assert light_controller._current_effect is None


async def test_get_lights(light_controller: LightController) -> None:
    """Test getting available lights."""
    lights = light_controller.get_lights()
    assert isinstance(lights, list)
    assert "test_light" in lights


async def test_update_light(light_controller: LightController, hass: HomeAssistant) -> None:
    """Test updating light state."""
    light_id = "test_light"
    brightness = 255
    rgb_color = (255, 0, 0)
    transition = 1.0

    # Mock the service call
    async_call = Mock()
    hass.services.async_call = async_call

    await light_controller.update_light(
        light_id,
        is_on=True,
        brightness=brightness,
        rgb_color=rgb_color,
        transition=transition
    )

    # Verify service call
    async_call.assert_called_once_with(
        "light",
        "turn_on",
        {
            "entity_id": f"light.{light_id}",
            ATTR_BRIGHTNESS: brightness,
            ATTR_RGB_COLOR: rgb_color,
            ATTR_TRANSITION: transition
        },
        blocking=True
    )

    # Verify state storage
    state = light_controller._lights[light_id]
    assert state["is_on"] is True
    assert state["brightness"] == brightness
    assert state["rgb_color"] == rgb_color


async def test_update_light_turn_off(light_controller: LightController, hass: HomeAssistant) -> None:
    """Test turning off a light."""
    light_id = "test_light"
    async_call = Mock()
    hass.services.async_call = async_call

    await light_controller.update_light(light_id, is_on=False)

    async_call.assert_called_once_with(
        "light",
        "turn_off",
        {"entity_id": f"light.{light_id}"},
        blocking=True
    )


async def test_update_light_error(light_controller: LightController, hass: HomeAssistant) -> None:
    """Test error handling during light update."""
    light_id = "test_light"
    async_call = Mock(side_effect=Exception("Test error"))
    hass.services.async_call = async_call

    # Should not raise exception
    await light_controller.update_light(light_id, is_on=True)
    assert light_id not in light_controller._lights


async def test_start_effect(light_controller: LightController, mock_effect_engine: Mock) -> None:
    """Test starting an effect."""
    with patch(
        "custom_components.aurora_sound_to_light.core.light_controller.get_effect_engine",
        return_value=mock_effect_engine
    ):
        effect_name = "test_effect"
        lights = ["test_light"]
        params = {"param1": "value1"}

        await light_controller.start_effect(effect_name, lights, params)

        # Verify effect engine interaction
        mock_effect_engine.create_effect.assert_called_once_with(
            effect_name,
            lights,
            params
        )
        mock_effect = mock_effect_engine.create_effect.return_value
        mock_effect.start.assert_called_once()


async def test_stop_effect(light_controller: LightController) -> None:
    """Test stopping an effect."""
    mock_effect = Mock()
    light_controller._current_effect = mock_effect

    await light_controller.stop_effect()

    mock_effect.stop.assert_called_once()
    assert light_controller._current_effect is None


async def test_stop_effect_error(light_controller: LightController) -> None:
    """Test error handling when stopping an effect."""
    mock_effect = Mock()
    mock_effect.stop.side_effect = Exception("Test error")
    light_controller._current_effect = mock_effect

    # Should not raise exception
    await light_controller.stop_effect()
    assert light_controller._current_effect is None


async def test_get_light_state(light_controller: LightController) -> None:
    """Test getting light state."""
    light_id = "test_light"
    test_state = {
        "is_on": True,
        "brightness": 255,
        "rgb_color": (255, 0, 0)
    }
    light_controller._lights[light_id] = test_state

    state = await light_controller.get_light_state(light_id)
    assert state == test_state

    # Test non-existent light
    state = await light_controller.get_light_state("non_existent")
    assert state is None


async def test_multiple_effects(light_controller: LightController, mock_effect_engine: Mock) -> None:
    """Test starting multiple effects in sequence."""
    with patch(
        "custom_components.aurora_sound_to_light.core.light_controller.get_effect_engine",
        return_value=mock_effect_engine
    ):
        # Start first effect
        await light_controller.start_effect("effect1", ["light1"])
        first_effect = light_controller._current_effect

        # Start second effect
        await light_controller.start_effect("effect2", ["light2"])
        
        # Verify first effect was stopped
        first_effect.stop.assert_called_once()
        assert light_controller._current_effect != first_effect