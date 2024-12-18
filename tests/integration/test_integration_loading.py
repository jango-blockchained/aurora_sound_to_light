"""Test the loading of the Aurora Sound to Light integration."""
import pytest
from unittest.mock import patch, MagicMock
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
from aurora_sound_to_light import (
    async_setup,
    async_setup_entry,
    DOMAIN,
)
from aurora_sound_to_light.const import (
    CONF_MEDIA_PLAYER,
    CONF_LIGHTS,
    CONF_NAME,
)


async def test_setup(hass: HomeAssistant):
    """Test the setup of the integration."""
    config = {
        DOMAIN: {
            CONF_NAME: "Test Aurora",
            CONF_MEDIA_PLAYER: "media_player.test",
            CONF_LIGHTS: ["light.test1", "light.test2"],
        }
    }
    
    with patch(
        "aurora_sound_to_light.audio_processor.AudioProcessor"
    ) as mock_audio:
        mock_audio.return_value.async_setup = MagicMock(return_value=True)
        assert await async_setup(hass, config) is True


async def test_setup_entry(hass: HomeAssistant, mock_config_entry, mock_media_player, mock_light):
    """Test setting up an entry from configuration."""
    # Mock the audio processor setup
    with patch(
        "aurora_sound_to_light.audio_processor.AudioProcessor"
    ) as mock_audio:
        mock_audio.return_value.async_setup = MagicMock(return_value=True)
        
        # Test the setup
        assert await async_setup_entry(hass, mock_config_entry) is True
        
        # Verify services are registered
        assert hass.services.has_service(DOMAIN, "start_effect")
        assert hass.services.has_service(DOMAIN, "stop_effect")
        assert hass.services.has_service(DOMAIN, "create_effect")


async def test_setup_entry_no_media_player(hass: HomeAssistant, mock_config_entry):
    """Test setup fails when media player is not available."""
    # Remove media player from config
    mock_config_entry["data"][CONF_MEDIA_PLAYER] = "media_player.nonexistent"
    
    with patch(
        "aurora_sound_to_light.audio_processor.AudioProcessor"
    ) as mock_audio:
        mock_audio.return_value.async_setup = MagicMock(return_value=True)
        
        # Setup should fail
        assert await async_setup_entry(hass, mock_config_entry) is False


async def test_setup_entry_no_lights(hass: HomeAssistant, mock_config_entry, mock_media_player):
    """Test setup fails when no lights are available."""
    # Set nonexistent lights
    mock_config_entry["data"][CONF_LIGHTS] = ["light.nonexistent1", "light.nonexistent2"]
    
    with patch(
        "aurora_sound_to_light.audio_processor.AudioProcessor"
    ) as mock_audio:
        mock_audio.return_value.async_setup = MagicMock(return_value=True)
        
        # Setup should fail
        assert await async_setup_entry(hass, mock_config_entry) is False


async def test_setup_entry_audio_processor_failure(hass: HomeAssistant, mock_config_entry, mock_media_player, mock_light):
    """Test setup fails when audio processor fails to initialize."""
    with patch(
        "aurora_sound_to_light.audio_processor.AudioProcessor"
    ) as mock_audio:
        mock_audio.return_value.async_setup = MagicMock(return_value=False)
        
        # Setup should fail
        assert await async_setup_entry(hass, mock_config_entry) is False


async def test_setup_entry_with_performance_monitor(hass: HomeAssistant, mock_config_entry, mock_media_player, mock_light):
    """Test setup with performance monitoring enabled."""
    mock_config_entry["data"]["enable_performance_monitoring"] = True
    
    with patch(
        "aurora_sound_to_light.audio_processor.AudioProcessor"
    ) as mock_audio:
        mock_audio.return_value.async_setup = MagicMock(return_value=True)
        
        # Test the setup
        assert await async_setup_entry(hass, mock_config_entry) is True
        
        # Verify performance monitoring service is registered
        assert hass.services.has_service(DOMAIN, "get_performance_metrics") 