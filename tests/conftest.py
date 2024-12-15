"""Test configuration for Aurora Sound to Light."""
import pytest
from unittest.mock import Mock, patch
from homeassistant.core import HomeAssistant
from homeassistant.const import Platform
from homeassistant.setup import async_setup_component
from homeassistant.loader import async_get_integration

pytest_plugins = "pytest_homeassistant_custom_component"

@pytest.fixture(autouse=True)
async def auto_enable_custom_integrations(hass: HomeAssistant):
    """Enable custom integrations for testing."""
    hass.data.setdefault("custom_components", {})
    integration = await async_get_integration(hass, "aurora_sound_to_light")
    hass.data["custom_components"]["aurora_sound_to_light"] = integration
    yield

@pytest.fixture(name="skip_notifications", autouse=True)
def skip_notifications_fixture():
    """Skip notification calls."""
    with patch("homeassistant.components.persistent_notification.async_create"), \
         patch("homeassistant.components.persistent_notification.async_dismiss"):
        yield

@pytest.fixture
async def mock_ffmpeg(hass):
    """Mock FFmpeg for testing."""
    with patch("shutil.which", return_value="/usr/bin/ffmpeg"), \
         patch("homeassistant.components.ffmpeg.FFmpegManager") as mock:
        mock_manager = Mock()
        mock.return_value = mock_manager
        await async_setup_component(hass, Platform.FFMPEG, {})
        yield mock_manager

@pytest.fixture
def mock_spotify():
    """Mock Spotify integration for testing."""
    mock_spotify = Mock()
    mock_spotify.async_get_track = Mock(
        return_value={"preview_url": "http://test.url"}
    )
    return mock_spotify

@pytest.fixture
def mock_media_player():
    """Mock media player for testing."""
    mock_player = Mock()
    mock_player.state = "playing"
    mock_player.attributes = {
        "media_content_id": "http://test.url",
        "media_content_type": "music",
        "entity_id": "media_player.test"
    }
    return mock_player

@pytest.fixture
def mock_numpy_audio():
    """Mock numpy audio processing for testing."""
    with patch("numpy.fft.rfft") as mock_fft, \
         patch("numpy.abs") as mock_abs:
        mock_fft.return_value = [1.0] * 1024
        mock_abs.return_value = [1.0] * 1024
        yield

@pytest.fixture(autouse=True)
async def setup_comp(hass):
    """Set up test environment."""
    await async_setup_component(hass, Platform.MEDIA_PLAYER, {})
    await async_setup_component(hass, Platform.FFMPEG, {})