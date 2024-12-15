"""Audio processing module for Aurora Sound to Light."""
import asyncio
import logging
import numpy as np
import pyaudio
import subprocess
import threading
import time
from typing import Optional, Callable

from homeassistant.core import HomeAssistant
from homeassistant.components.media_player import (
    DOMAIN as MEDIA_PLAYER_DOMAIN,
    MediaPlayerState,
)

from .const import (
    DOMAIN,
    CONF_AUDIO_INPUT,
    CONF_BUFFER_SIZE,
    AUDIO_INPUT_MIC,
    AUDIO_INPUT_MEDIA_PLAYER,
)

_LOGGER = logging.getLogger(__name__)

class AudioProcessor:
    """Class to handle audio processing."""

    def __init__(
        self,
        hass: HomeAssistant,
        config: dict,
        callback: Optional[Callable] = None,
    ) -> None:
        """Initialize the audio processor."""
        self.hass = hass
        self.config = config
        self.callback = callback
        self.audio_input = config.get(CONF_AUDIO_INPUT, AUDIO_INPUT_MIC)
        self.buffer_size = config.get(CONF_BUFFER_SIZE, 1024)
        
        self._stream = None
        self._pyaudio = None
        self._ffmpeg_process = None
        self._running = False
        self._thread = None
        self._lock = threading.Lock()

    async def start(self) -> None:
        """Start audio processing."""
        if self._running:
            return

        try:
            if self.audio_input == AUDIO_INPUT_MIC:
                await self._start_microphone()
            elif self.audio_input == AUDIO_INPUT_MEDIA_PLAYER:
                await self._start_media_player()
            else:
                raise ValueError(f"Invalid audio input: {self.audio_input}")

            self._running = True
            self._thread = threading.Thread(target=self._process_audio)
            self._thread.daemon = True
            self._thread.start()

        except Exception as err:
            _LOGGER.error("Failed to start audio processing: %s", err)
            await self.stop()
            raise

    async def stop(self) -> None:
        """Stop audio processing."""
        self._running = False
        
        if self._thread:
            self._thread.join()
            self._thread = None

        if self._stream:
            with self._lock:
                self._stream.stop_stream()
                self._stream.close()
                self._stream = None

        if self._pyaudio:
            self._pyaudio.terminate()
            self._pyaudio = None

        if self._ffmpeg_process:
            self._ffmpeg_process.terminate()
            self._ffmpeg_process = None

    async def _start_microphone(self) -> None:
        """Initialize microphone input."""
        try:
            self._pyaudio = pyaudio.PyAudio()
            self._stream = self._pyaudio.open(
                format=pyaudio.paFloat32,
                channels=1,
                rate=44100,
                input=True,
                frames_per_buffer=self.buffer_size,
            )
        except Exception as err:
            _LOGGER.error("Failed to initialize microphone: %s", err)
            raise

    async def _start_media_player(self) -> None:
        """Initialize media player input."""
        try:
            media_player = self.config.get("media_player")
            if not media_player:
                raise ValueError("No media player specified")

            state = self.hass.states.get(media_player)
            if not state or state.state != MediaPlayerState.PLAYING:
                raise ValueError(f"Media player {media_player} not available or not playing")

            # Start FFmpeg process
            command = [
                "ffmpeg",
                "-i", "pipe:0",
                "-f", "f32le",
                "-acodec", "pcm_f32le",
                "-ac", "1",
                "-ar", "44100",
                "pipe:1",
            ]

            self._ffmpeg_process = subprocess.Popen(
                command,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )

        except Exception as err:
            _LOGGER.error("Failed to initialize media player input: %s", err)
            raise

    def _process_audio(self) -> None:
        """Process audio data."""
        while self._running:
            try:
                with self._lock:
                    if self.audio_input == AUDIO_INPUT_MIC:
                        data = np.frombuffer(
                            self._stream.read(self.buffer_size),
                            dtype=np.float32,
                        )
                    else:
                        data = np.frombuffer(
                            self._ffmpeg_process.stdout.read(
                                self.buffer_size * 4
                            ),
                            dtype=np.float32,
                        )

                if self.callback:
                    self.callback(data)

            except Exception as err:
                _LOGGER.error("Error processing audio: %s", err)
                time.sleep(0.1)  # Prevent tight loop on error