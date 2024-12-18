"""Test fixtures for Aurora Sound to Light."""
import pytest
import os
import sys
from pathlib import Path

# Get the root directory of the project
root_dir = Path(__file__).parent.parent

# Add the root directory to Python path so we can import custom_components
sys.path.insert(0, str(root_dir))

# Create custom_components directory if it doesn't exist
custom_components_dir = root_dir / "custom_components"
if not custom_components_dir.exists():
    os.makedirs(custom_components_dir)

# Create a symbolic link to the current directory in custom_components
aurora_dir = custom_components_dir / "aurora_sound_to_light"
if not aurora_dir.exists():
    os.symlink(root_dir, aurora_dir)

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component


@pytest.fixture
def hass(event_loop, tmp_path):
    """Create a Home Assistant instance for testing."""
    hass = HomeAssistant()
    hass.config.config_dir = tmp_path
    return hass


@pytest.fixture
async def mock_setup_entry(hass):
    """Mock setting up a config entry."""
    return True


@pytest.fixture
def mock_config_entry():
    """Mock a config entry."""
    return {
        "domain": "aurora_sound_to_light",
        "data": {
            "name": "Test Aurora",
            "media_player": "media_player.test",
            "lights": ["light.test1", "light.test2"],
        },
    }


@pytest.fixture
async def mock_media_player(hass):
    """Mock a media player entity."""
    await async_setup_component(hass, "media_player", {
        "media_player": {
            "platform": "demo",
        }
    })
    await hass.async_block_till_done()
    return "media_player.demo"


@pytest.fixture
async def mock_light(hass):
    """Mock a light entity."""
    await async_setup_component(hass, "light", {
        "light": {
            "platform": "demo",
        }
    })
    await hass.async_block_till_done()
    return "light.demo"


@pytest.fixture
async def mock_ffmpeg(hass):
    """Mock FFmpeg."""
    return True
