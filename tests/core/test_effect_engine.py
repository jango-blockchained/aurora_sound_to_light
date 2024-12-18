"""Test module for Aurora Sound to Light effect engine."""
import pytest
from unittest.mock import MagicMock, patch
from typing import List, Optional
import asyncio

from homeassistant.core import HomeAssistant

from custom_components.aurora_sound_to_light.effects import (
    BaseEffect,
    EffectEngine,
    get_effect_engine,
)

class TestEffect(BaseEffect):
    """Test effect implementation."""
    
    def __init__(
        self,
        hass: HomeAssistant,
        lights: List[str],
        params: Optional[dict] = None
    ) -> None:
        """Initialize test effect."""
        super().__init__(hass, lights, params)
        self.update_called = False
        self.last_audio_data = None
        self.last_beat_detected = False
        self.last_bpm = 0

    async def update(
        self,
        audio_data: Optional[List[float]] = None,
        beat_detected: bool = False,
        bpm: int = 0
    ) -> None:
        """Test update implementation."""
        self.update_called = True
        self.last_audio_data = audio_data
        self.last_beat_detected = beat_detected
        self.last_bpm = bpm


@pytest.fixture
def hass():
    """Home Assistant fixture."""
    mock_hass = MagicMock(spec=HomeAssistant)
    mock_hass.services = MagicMock()
    
    async def async_call(*args, **kwargs):
        return None
    
    mock_hass.services.call = MagicMock(side_effect=async_call)
    return mock_hass


@pytest.fixture
def effect_engine(hass):
    """Effect engine fixture."""
    engine = EffectEngine(hass)
    engine._effects["test_effect"] = TestEffect
    return engine


@pytest.mark.asyncio
class TestBaseEffect:
    """Test cases for BaseEffect class."""

    async def test_initialization(self, hass):
        """Test effect initialization."""
        lights = ["light.test1", "light.test2"]
        params = {"param1": "value1"}
        effect = TestEffect(hass, lights, params)

        assert effect.hass == hass
        assert effect.lights == lights
        assert effect.params == params
        assert not effect.is_running

    async def test_start_stop(self, hass):
        """Test start and stop functionality."""
        effect = TestEffect(hass, ["light.test"])
        
        assert not effect.is_running
        await effect.start()
        assert effect.is_running
        await effect.stop()
        assert not effect.is_running

    async def test_update_method(self, hass):
        """Test update method functionality."""
        effect = TestEffect(hass, ["light.test"])
        audio_data = [0.1, 0.2, 0.3]
        
        await effect.update(audio_data, True, 120)
        
        assert effect.update_called
        assert effect.last_audio_data == audio_data
        assert effect.last_beat_detected
        assert effect.last_bpm == 120


@pytest.mark.asyncio
class TestEffectEngine:
    """Test cases for EffectEngine class."""

    async def test_get_available_effects(self, effect_engine):
        """Test retrieving available effects."""
        effects = effect_engine.get_available_effects()
        assert isinstance(effects, list)
        assert "test_effect" in effects
        assert "bass_pulse" in effects
        assert "color_wave" in effects

    async def test_create_effect(self, effect_engine):
        """Test effect creation."""
        lights = ["light.test1", "light.test2"]
        params = {"param1": "value1"}
        
        effect = await effect_engine.create_effect("test_effect", lights, params)
        
        assert isinstance(effect, TestEffect)
        assert effect.lights == lights
        assert effect.params == params

    async def test_create_unknown_effect(self, effect_engine):
        """Test creating an unknown effect raises error."""
        with pytest.raises(ValueError, match="Unknown effect: unknown_effect"):
            await effect_engine.create_effect("unknown_effect", ["light.test"])

    async def test_effect_registration(self, hass):
        """Test effect registration in engine."""
        engine = EffectEngine(hass)
        
        # Test initial effects
        assert "bass_pulse" in engine._effects
        assert "color_wave" in engine._effects
        
        # Test adding a new effect
        engine._effects["new_effect"] = TestEffect
        assert "new_effect" in engine.get_available_effects()


@pytest.mark.asyncio
async def test_get_effect_engine(hass):
    """Test get_effect_engine function."""
    engine1 = await get_effect_engine(hass)
    engine2 = await get_effect_engine(hass)
    
    assert isinstance(engine1, EffectEngine)
    assert isinstance(engine2, EffectEngine)
    assert engine1 is engine2  # Should return the same instance
  