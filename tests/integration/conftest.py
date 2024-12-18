"""Fixtures for Aurora Sound to Light integration tests."""
import os
import sys
from pathlib import Path

# Get the root directory of the project
root_dir = Path(__file__).parent.parent.parent

# Add the root directory to PYTHONPATH
sys.path.insert(0, str(root_dir))

# Add the parent directory of custom_components to PYTHONPATH
parent_dir = root_dir.parent
sys.path.insert(0, str(parent_dir))

pytest_plugins = "pytest_homeassistant_custom_component"

from unittest.mock import patch
import pytest

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component

from custom_components.aurora_sound_to_light.const import DOMAIN


@pytest.fixture
def hass(event_loop, tmpdir):
    """Create a Home Assistant instance for testing."""
    hass = HomeAssistant()
    hass.config.config_dir = tmpdir.mkdir("config")

    async def async_setup():
        await hass.async_start()
        return True

    event_loop.run_until_complete(async_setup())
    yield hass
    event_loop.run_until_complete(hass.async_stop())


@pytest.fixture
def mock_audio_processor():
    """Mock the audio processor component."""
    with patch(
        'custom_components.aurora_sound_to_light.core.audio_processor.'
        'AudioProcessor'
    ) as mock:
        mock.return_value.get_buffer_health.return_value = 95.0
        mock.return_value.get_frequency_data.return_value = [0.0] * 32
        mock.return_value.get_waveform_data.return_value = [0.0] * 32
        yield mock


@pytest.fixture
def mock_light_controller():
    """Mock the light controller component."""
    with patch(
        'custom_components.aurora_sound_to_light.core.light_controller.'
        'LightController'
    ) as mock:
        mock.return_value.get_latency.return_value = 45.5
        yield mock


@pytest.fixture
def mock_effect_engine():
    """Mock the effect engine component."""
    with patch(
        'custom_components.aurora_sound_to_light.core.effect_engine.'
        'EffectEngine'
    ) as mock:
        mock.return_value.get_active_effects.return_value = ["bass_pulse"]
        yield mock


@pytest.fixture
async def integration(
    hass,
    mock_audio_processor,
    mock_light_controller,
    mock_effect_engine
):
    """Set up the Aurora Sound to Light integration."""
    config = {
        DOMAIN: {
            "audio_input": "microphone",
            "light_groups": [{
                "name": "Test Group",
                "lights": ["light.test_light"]
            }]
        }
    }

    with patch(
        'custom_components.aurora_sound_to_light.core.latency_monitor.'
        'LatencyMonitor'
    ) as mock_latency_monitor:
        mock_latency_monitor.return_value.get_metrics.return_value = {
            "latency": 45.5,
            "cpuUsage": 65.0,
            "memoryUsage": 75.0,
            "audioBufferHealth": 95.0,
            "systemStatus": "good"
        }

        assert await async_setup_component(hass, DOMAIN, config)
        await hass.async_block_till_done()

        yield {
            "audio_processor": mock_audio_processor,
            "light_controller": mock_light_controller,
            "effect_engine": mock_effect_engine,
            "latency_monitor": mock_latency_monitor
        }


@pytest.fixture
def ws_client(hass, integration):
    """Create a websocket client."""
    return hass.loop.run_until_complete(hass.async_ws_client())
