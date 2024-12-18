"""Test module for advanced Aurora Sound to Light effect engine validation."""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
import numpy as np
from typing import List, Dict, Any, Optional
import asyncio
import json

from homeassistant.core import HomeAssistant
from homeassistant.const import STATE_ON, STATE_OFF

from custom_components.aurora_sound_to_light.effects import (
    BaseEffect,
    EffectEngine,
    get_effect_engine,
    EffectChain,
    EffectBlender,
)

class MockEffect(BaseEffect):
    """Mock effect for testing."""
    
    def __init__(
        self,
        hass: HomeAssistant,
        lights: List[str],
        params: Optional[dict] = None,
        name: str = "mock_effect"
    ) -> None:
        """Initialize mock effect."""
        super().__init__(hass, lights, params)
        self.name = name
        self.process_called = False
        self.blend_called = False
        self.last_audio_data = None
        self.last_light_states = {}
        self.output_states = {}

    async def process(
        self,
        audio_data: Optional[np.ndarray] = None,
        light_states: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Mock process implementation."""
        self.process_called = True
        self.last_audio_data = audio_data
        self.last_light_states = light_states or {}
        return self.output_states

    async def blend(self, other_effect: 'BaseEffect', ratio: float = 0.5) -> None:
        """Mock blend implementation."""
        self.blend_called = True
        self.blend_ratio = ratio
        self.blended_with = other_effect

@pytest.fixture
def mock_hass():
    """Mock Home Assistant instance."""
    hass = MagicMock(spec=HomeAssistant)
    hass.states = MagicMock()
    hass.states.get = MagicMock(return_value=MagicMock(state=STATE_ON))
    hass.services = AsyncMock()
    return hass

@pytest.fixture
def effect_engine(mock_hass):
    """Effect engine fixture with mock effects."""
    engine = EffectEngine(mock_hass)
    engine.register_effect("mock_effect", MockEffect)
    return engine

@pytest.mark.asyncio
class TestEffectChainProcessing:
    """Test cases for effect chain processing."""

    async def test_chain_creation(self, effect_engine):
        """Test creating and validating effect chains."""
        lights = ["light.test1", "light.test2"]
        chain = await effect_engine.create_effect_chain([
            ("mock_effect", {"intensity": 0.8}),
            ("mock_effect", {"intensity": 0.5})
        ], lights)

        assert len(chain.effects) == 2
        assert all(isinstance(effect, MockEffect) for effect in chain.effects)
        assert chain.effects[0].params["intensity"] == 0.8
        assert chain.effects[1].params["intensity"] == 0.5

    async def test_chain_processing(self, effect_engine):
        """Test processing audio through effect chain."""
        lights = ["light.test1"]
        chain = await effect_engine.create_effect_chain([
            ("mock_effect", {"output": {"light.test1": {"brightness": 100}}}),
            ("mock_effect", {"output": {"light.test1": {"brightness": 200}}})
        ], lights)

        audio_data = np.random.rand(1024)
        result = await chain.process(audio_data)

        assert result["light.test1"]["brightness"] == 200
        assert all(effect.process_called for effect in chain.effects)
        assert all(np.array_equal(effect.last_audio_data, audio_data) 
                  for effect in chain.effects)

    async def test_chain_error_handling(self, effect_engine):
        """Test error handling in effect chains."""
        lights = ["light.test1"]
        
        # Test with invalid effect
        with pytest.raises(ValueError):
            await effect_engine.create_effect_chain([
                ("invalid_effect", {})
            ], lights)

        # Test with invalid parameters
        with pytest.raises(ValueError):
            await effect_engine.create_effect_chain([
                ("mock_effect", {"invalid_param": 123})
            ], lights)

@pytest.mark.asyncio
class TestEffectBlending:
    """Test cases for effect blending."""

    async def test_basic_blending(self, effect_engine):
        """Test basic effect blending functionality."""
        lights = ["light.test1"]
        effect1 = await effect_engine.create_effect(
            "mock_effect",
            lights,
            {"output": {"light.test1": {"brightness": 100}}}
        )
        effect2 = await effect_engine.create_effect(
            "mock_effect",
            lights,
            {"output": {"light.test1": {"brightness": 200}}}
        )

        blender = EffectBlender([effect1, effect2])
        result = await blender.blend()

        assert effect1.blend_called
        assert effect2.blend_called
        assert effect1.blend_ratio == 0.5
        assert effect2.blend_ratio == 0.5

    async def test_weighted_blending(self, effect_engine):
        """Test blending with custom weights."""
        lights = ["light.test1"]
        effects = [
            await effect_engine.create_effect("mock_effect", lights, {}),
            await effect_engine.create_effect("mock_effect", lights, {}),
            await effect_engine.create_effect("mock_effect", lights, {})
        ]

        weights = [0.2, 0.3, 0.5]
        blender = EffectBlender(effects, weights=weights)
        result = await blender.blend()

        for effect, weight in zip(effects, weights):
            assert effect.blend_called
            assert effect.blend_ratio == weight

    async def test_blend_mode_validation(self, effect_engine):
        """Test validation of blend modes."""
        lights = ["light.test1"]
        effects = [
            await effect_engine.create_effect("mock_effect", lights, {}),
            await effect_engine.create_effect("mock_effect", lights, {})
        ]

        # Test invalid blend mode
        with pytest.raises(ValueError):
            EffectBlender(effects, mode="invalid_mode")

        # Test valid blend modes
        valid_modes = ["average", "multiply", "screen", "overlay"]
        for mode in valid_modes:
            blender = EffectBlender(effects, mode=mode)
            assert blender.mode == mode

@pytest.mark.asyncio
class TestPerformanceValidation:
    """Test cases for performance validation."""

    async def test_cpu_usage_monitoring(self, effect_engine):
        """Test CPU usage monitoring during effect processing."""
        lights = ["light.test1"]
        effect = await effect_engine.create_effect("mock_effect", lights, {})

        with patch('time.process_time', side_effect=[0, 0.1]):  # Simulate 10% CPU usage
            audio_data = np.random.rand(1024)
            await effect.process(audio_data)
            cpu_usage = effect_engine.get_cpu_usage()
            assert 0 <= cpu_usage <= 100

    async def test_memory_usage_monitoring(self, effect_engine):
        """Test memory usage monitoring."""
        initial_memory = effect_engine.get_memory_usage()
        
        # Create multiple effects and process data
        lights = ["light.test1"]
        effects = []
        for _ in range(10):
            effect = await effect_engine.create_effect("mock_effect", lights, {})
            effects.append(effect)

        final_memory = effect_engine.get_memory_usage()
        assert final_memory >= initial_memory

    async def test_latency_monitoring(self, effect_engine):
        """Test effect processing latency monitoring."""
        lights = ["light.test1"]
        effect = await effect_engine.create_effect("mock_effect", lights, {})

        audio_data = np.random.rand(1024)
        start_time = asyncio.get_event_loop().time()
        await effect.process(audio_data)
        end_time = asyncio.get_event_loop().time()

        latency = end_time - start_time
        assert latency >= 0
        assert effect_engine.get_average_latency() >= 0

@pytest.mark.asyncio
class TestStatePersistence:
    """Test cases for effect state persistence."""

    async def test_save_load_state(self, effect_engine, tmp_path):
        """Test saving and loading effect state."""
        lights = ["light.test1"]
        effect = await effect_engine.create_effect(
            "mock_effect",
            lights,
            {"param1": "value1"}
        )

        # Save state
        state_file = tmp_path / "effect_state.json"
        await effect_engine.save_state(str(state_file))

        # Modify state
        effect.params["param1"] = "value2"

        # Load state
        await effect_engine.load_state(str(state_file))
        loaded_effect = effect_engine.get_effect("mock_effect")
        assert loaded_effect.params["param1"] == "value1"

    async def test_state_validation(self, effect_engine, tmp_path):
        """Test validation of loaded state data."""
        state_file = tmp_path / "invalid_state.json"
        
        # Write invalid state
        with open(state_file, 'w') as f:
            json.dump({"invalid": "state"}, f)

        # Attempt to load invalid state
        with pytest.raises(ValueError):
            await effect_engine.load_state(str(state_file))

@pytest.mark.asyncio
class TestParameterValidation:
    """Test cases for effect parameter validation."""

    async def test_parameter_type_validation(self, effect_engine):
        """Test validation of parameter types."""
        lights = ["light.test1"]
        
        # Test with invalid parameter type
        with pytest.raises(ValueError):
            await effect_engine.create_effect(
                "mock_effect",
                lights,
                {"intensity": "not_a_number"}  # Should be float
            )

        # Test with valid parameters
        effect = await effect_engine.create_effect(
            "mock_effect",
            lights,
            {"intensity": 0.8}
        )
        assert effect.params["intensity"] == 0.8

    async def test_parameter_range_validation(self, effect_engine):
        """Test validation of parameter ranges."""
        lights = ["light.test1"]
        
        # Test with out-of-range parameter
        with pytest.raises(ValueError):
            await effect_engine.create_effect(
                "mock_effect",
                lights,
                {"intensity": 1.5}  # Should be between 0 and 1
            )

        # Test with valid range
        effect = await effect_engine.create_effect(
            "mock_effect",
            lights,
            {"intensity": 0.5}
        )
        assert effect.params["intensity"] == 0.5

    async def test_required_parameters(self, effect_engine):
        """Test validation of required parameters."""
        lights = ["light.test1"]
        
        # Test missing required parameter
        with pytest.raises(ValueError):
            await effect_engine.create_effect(
                "mock_effect",
                lights,
                {}  # Missing required parameters
            )

        # Test with all required parameters
        effect = await effect_engine.create_effect(
            "mock_effect",
            lights,
            {"intensity": 0.8, "color": "#FF0000"}
        )
        assert effect.params["intensity"] == 0.8
        assert effect.params["color"] == "#FF0000" 