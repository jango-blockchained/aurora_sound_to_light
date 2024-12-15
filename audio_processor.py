"""Audio processing module for Aurora Sound to Light."""
import asyncio
import logging
import numpy as np
import pyaudio
import subprocess
import tempfile
import os
from typing import Optional, Callable, Dict, Any
from collections import deque
from datetime import datetime, timedelta

from homeassistant.core import HomeAssistant, callback
from homeassistant.components import media_player
from homeassistant.components.media_player import (
    ATTR_MEDIA_POSITION,
    ATTR_MEDIA_DURATION,
    DOMAIN as MEDIA_PLAYER_DOMAIN,
)
from homeassistant.const import (
    STATE_PLAYING,
    STATE_PAUSED,
)
from homeassistant.helpers.event import async_track_state_change

from .const import (
    AUDIO_INPUT_MIC,
    AUDIO_INPUT_MEDIA,
    DEFAULT_BUFFER_SIZE,
    DEFAULT_FREQUENCY_BANDS,
)

_LOGGER = logging.getLogger(__name__)

# Beat detection constants
BEAT_MIN_INTERVAL = 0.2  # Minimum time between beats (200ms)
BEAT_HISTORY_SIZE = 44100 * 2  # 2 seconds of history at 44.1kHz
BEAT_THRESHOLD_FACTOR = 1.5  # Energy must be this times the average to be a beat
TEMPO_WINDOW = 5  # Number of seconds to analyze for tempo

# AGC constants
AGC_TARGET_RMS = 0.2  # Target RMS level (0.0 to 1.0)
AGC_ATTACK_RATE = 0.001  # How quickly gain increases
AGC_DECAY_RATE = 0.0005  # How quickly gain decreases
AGC_MIN_GAIN = 0.1
AGC_MAX_GAIN = 10.0
AGC_WINDOW_SIZE = 1024  # Samples to analyze for AGC
AGC_NOISE_FLOOR = 0.001  # Minimum RMS to consider as signal

class AudioProcessor:
    """Class to handle audio processing and analysis."""

    def __init__(
        self,
        hass: HomeAssistant,
        input_type: str,
        buffer_size: int = DEFAULT_BUFFER_SIZE,
        frequency_bands: int = DEFAULT_FREQUENCY_BANDS,
        callback: Optional[Callable] = None,
        media_player_entity_id: Optional[str] = None,
    ) -> None:
        """Initialize the audio processor."""
        self.hass = hass
        self.input_type = input_type
        self.buffer_size = buffer_size
        self.frequency_bands = frequency_bands
        self.callback = callback
        self.running = False
        
        # Audio processing parameters
        self.sample_rate = 44100
        self.chunk_size = 1024
        self.format = pyaudio.paFloat32
        self.channels = 1
        
        # Media player specific
        self.media_player_entity_id = media_player_entity_id
        self._ffmpeg_process = None
        self._temp_dir = None
        self._current_stream_url = None
        self._unsubscribe_media_player = None
        
        # Beat detection and tempo analysis
        self._energy_history = deque(maxlen=BEAT_HISTORY_SIZE)
        self._beat_history = deque(maxlen=50)  # Store last 50 beats
        self._last_beat_time = datetime.now()
        self._current_tempo = 0
        self._beat_energies = deque(maxlen=TEMPO_WINDOW * 10)  # Store 10 samples per second
        self._is_beat = False
        
        # AGC parameters
        self._current_gain = 1.0
        self._rms_history = deque(maxlen=50)  # Store RMS history for smoothing
        self._agc_enabled = True
        self._peak_hold = 0.0
        self._peak_decay = 0.9995  # Peak decay rate
        self._noise_gate_threshold = AGC_NOISE_FLOOR
        
        self._audio = None
        self._stream = None
        self._task = None

    def _apply_agc(self, data: np.ndarray) -> np.ndarray:
        """Apply automatic gain control to the audio data."""
        if not self._agc_enabled:
            return data

        # Calculate current RMS level
        rms = np.sqrt(np.mean(np.square(data)))
        self._rms_history.append(rms)
        
        # Update peak hold
        current_peak = np.max(np.abs(data))
        self._peak_hold = max(current_peak, self._peak_hold * self._peak_decay)
        
        # Skip AGC if signal is below noise gate
        if rms < self._noise_gate_threshold:
            return data

        # Calculate smoothed RMS using recent history
        smoothed_rms = np.mean(self._rms_history)
        
        # Calculate target gain
        target_gain = AGC_TARGET_RMS / (smoothed_rms + 1e-10)  # Avoid division by zero
        target_gain = np.clip(target_gain, AGC_MIN_GAIN, AGC_MAX_GAIN)
        
        # Smoothly adjust current gain
        if target_gain > self._current_gain:
            # Attack phase - gain needs to increase
            self._current_gain += AGC_ATTACK_RATE * (target_gain - self._current_gain)
        else:
            # Decay phase - gain needs to decrease
            self._current_gain -= AGC_DECAY_RATE * (self._current_gain - target_gain)
        
        # Apply gain with peak normalization
        if self._peak_hold > 0:
            # Ensure we don't clip
            max_gain = 1.0 / self._peak_hold
            applied_gain = min(self._current_gain, max_gain)
        else:
            applied_gain = self._current_gain
        
        return data * applied_gain

    def _audio_callback(self, in_data, frame_count, time_info, status):
        """Handle audio input callback."""
        if self.running:
            data = np.frombuffer(in_data, dtype=np.float32)
            
            # Apply AGC before processing
            data = self._apply_agc(data)
            
            self._process_frame(data)
        return (in_data, pyaudio.paContinue)

    def _process_frame(self, data: np.ndarray) -> None:
        """Process a frame of audio data."""
        # Perform FFT
        fft_data = np.fft.fft(data)
        # Get magnitude spectrum
        magnitude = np.abs(fft_data)[:len(data)//2]
        
        # Split into frequency bands
        bands = np.array_split(magnitude, self.frequency_bands)
        band_energies = [np.mean(band) for band in bands]
        
        # Process beat detection
        self._detect_beat(band_energies)
        
        # Update tempo if we have a beat
        if self._is_beat:
            self._update_tempo()
        
        # Include beat, tempo, and AGC information in the callback
        if self.callback:
            self.callback({
                'band_energies': band_energies,
                'is_beat': self._is_beat,
                'tempo': self._current_tempo,
                'bass_energy': band_energies[0],  # First band is typically bass
                'mid_energy': np.mean(band_energies[1:len(band_energies)//2]),
                'high_energy': np.mean(band_energies[len(band_energies)//2:]),
                'current_gain': self._current_gain,
                'rms_level': np.mean(self._rms_history) if self._rms_history else 0.0,
                'peak_level': self._peak_hold,
            })

    def _detect_beat(self, band_energies: list) -> None:
        """Detect beats in the audio signal."""
        # Focus on bass frequencies (first few bands) for beat detection
        bass_energy = np.mean(band_energies[:3])
        self._energy_history.append(bass_energy)
        
        # Calculate local energy average
        local_energy_avg = np.mean(list(self._energy_history)[-44100:])
        
        # Check if enough time has passed since last beat
        time_since_last_beat = (datetime.now() - self._last_beat_time).total_seconds()
        
        # Detect beat if energy is above threshold and minimum interval has passed
        self._is_beat = (
            bass_energy > local_energy_avg * BEAT_THRESHOLD_FACTOR
            and time_since_last_beat >= BEAT_MIN_INTERVAL
        )
        
        if self._is_beat:
            self._last_beat_time = datetime.now()
            self._beat_history.append(self._last_beat_time)
            self._beat_energies.append(bass_energy)

    def _update_tempo(self) -> None:
        """Calculate the current tempo based on beat history."""
        if len(self._beat_history) < 4:
            return

        # Calculate intervals between beats
        intervals = []
        for i in range(1, len(self._beat_history)):
            interval = (self._beat_history[i] - self._beat_history[i-1]).total_seconds()
            if 0.2 <= interval <= 2.0:  # Only consider reasonable intervals (30-300 BPM)
                intervals.append(interval)

        if not intervals:
            return

        # Calculate average interval and convert to BPM
        avg_interval = np.mean(intervals)
        self._current_tempo = int(60 / avg_interval)

        # Ensure tempo is in a reasonable range
        self._current_tempo = max(30, min(300, self._current_tempo))

    @property
    def current_tempo(self) -> int:
        """Get the current tempo in BPM."""
        return self._current_tempo

    @property
    def is_beat(self) -> bool:
        """Get the current beat state."""
        return self._is_beat

    def get_beat_intensity(self) -> float:
        """Get the intensity of the current beat (0.0 to 1.0)."""
        if not self._beat_energies:
            return 0.0
        
        current_energy = self._beat_energies[-1]
        max_energy = max(self._beat_energies)
        return min(1.0, current_energy / max_energy if max_energy > 0 else 0.0)

    async def _process_audio(self) -> None:
        """Main audio processing loop."""
        try:
            while self.running:
                if self.input_type == AUDIO_INPUT_MEDIA:
                    # Media player processing is handled by FFmpeg
                    pass
                await asyncio.sleep(0.01)
        except Exception as err:
            _LOGGER.error("Error in audio processing: %s", err)
            self.running = False

    @callback
    async def _media_player_state_changed(
        self, entity_id: str, old_state: str, new_state: str
    ) -> None:
        """Handle media player state changes."""
        if not new_state:
            return

        if new_state.state == STATE_PLAYING:
            await self._start_media_capture()
        elif new_state.state == STATE_PAUSED:
            await self._stop_media_capture()

    async def _start_media_capture(self) -> None:
        """Start capturing audio from media player."""
        if not self.media_player_entity_id:
            return

        try:
            # Create temporary directory for stream
            self._temp_dir = tempfile.mkdtemp()
            fifo_path = os.path.join(self._temp_dir, "stream.raw")
            os.mkfifo(fifo_path)

            # Get media player stream URL
            stream_url = await self._get_stream_url()
            if not stream_url:
                _LOGGER.error("Could not get stream URL for %s", 
                            self.media_player_entity_id)
                return

            # Start FFmpeg process
            command = [
                "ffmpeg",
                "-i", stream_url,
                "-f", "f32le",  # 32-bit float
                "-acodec", "pcm_f32le",
                "-ac", str(self.channels),
                "-ar", str(self.sample_rate),
                "-buffer_size", str(self.buffer_size * 1000),  # Convert to bytes
                fifo_path
            ]

            self._ffmpeg_process = await asyncio.create_subprocess_exec(
                *command,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )

            # Open stream for reading
            self._stream = self._audio.open(
                format=self.format,
                channels=self.channels,
                rate=self.sample_rate,
                input=True,
                stream_callback=self._audio_callback,
                frames_per_buffer=self.chunk_size
            )

        except Exception as err:
            _LOGGER.error("Error starting media capture: %s", err)
            await self._stop_media_capture()

    async def _stop_media_capture(self) -> None:
        """Stop capturing audio from media player."""
        if self._ffmpeg_process:
            self._ffmpeg_process.terminate()
            try:
                await self._ffmpeg_process.wait()
            except Exception as err:
                _LOGGER.error("Error stopping FFmpeg process: %s", err)
            self._ffmpeg_process = None

        if self._temp_dir and os.path.exists(self._temp_dir):
            try:
                for file in os.listdir(self._temp_dir):
                    os.unlink(os.path.join(self._temp_dir, file))
                os.rmdir(self._temp_dir)
            except Exception as err:
                _LOGGER.error("Error cleaning up temp files: %s", err)
            self._temp_dir = None

    async def _get_stream_url(self) -> Optional[str]:
        """Get the stream URL from the media player entity."""
        state = self.hass.states.get(self.media_player_entity_id)
        if not state:
            return None

        # Try to get the direct stream URL from the media player
        # This will depend on the media player implementation
        attributes = state.attributes
        if "media_content_id" in attributes:
            return attributes["media_content_id"]
        
        # If no direct URL, try to get it through the media player's API
        try:
            result = await self.hass.services.async_call(
                MEDIA_PLAYER_DOMAIN,
                "play_media",
                {
                    "entity_id": self.media_player_entity_id,
                    "media_content_id": "stream",
                    "media_content_type": "music",
                },
                blocking=True,
                return_response=True
            )
            if result and "url" in result:
                return result["url"]
        except Exception as err:
            _LOGGER.error("Error getting stream URL: %s", err)
        
        return None

    @property
    def current_gain(self) -> float:
        """Get the current AGC gain value."""
        return self._current_gain

    @property
    def agc_enabled(self) -> bool:
        """Get the AGC enabled state."""
        return self._agc_enabled

    @agc_enabled.setter
    def agc_enabled(self, value: bool) -> None:
        """Set the AGC enabled state."""
        self._agc_enabled = value
        if not value:
            self._current_gain = 1.0

    def set_agc_parameters(
        self,
        target_rms: Optional[float] = None,
        attack_rate: Optional[float] = None,
        decay_rate: Optional[float] = None,
        noise_gate: Optional[float] = None,
    ) -> None:
        """Update AGC parameters."""
        global AGC_TARGET_RMS, AGC_ATTACK_RATE, AGC_DECAY_RATE
        
        if target_rms is not None:
            AGC_TARGET_RMS = np.clip(target_rms, 0.01, 0.5)
        if attack_rate is not None:
            AGC_ATTACK_RATE = np.clip(attack_rate, 0.0001, 0.01)
        if decay_rate is not None:
            AGC_DECAY_RATE = np.clip(decay_rate, 0.0001, 0.01)
        if noise_gate is not None:
            self._noise_gate_threshold = np.clip(noise_gate, 0.0001, 0.1)

    async def start(self) -> None:
        """Start audio processing."""
        if self.running:
            return

        self.running = True
        self._audio = pyaudio.PyAudio()

        if self.input_type == AUDIO_INPUT_MIC:
            self._stream = self._audio.open(
                format=self.format,
                channels=self.channels,
                rate=self.sample_rate,
                input=True,
                frames_per_buffer=self.chunk_size,
                stream_callback=self._audio_callback
            )
        elif self.input_type == AUDIO_INPUT_MEDIA:
            if self.media_player_entity_id:
                self._unsubscribe_media_player = async_track_state_change(
                    self.hass,
                    self.media_player_entity_id,
                    self._media_player_state_changed
                )
                state = self.hass.states.get(self.media_player_entity_id)
                if state and state.state == STATE_PLAYING:
                    await self._start_media_capture()
        
        self._task = asyncio.create_task(self._process_audio())

    async def stop(self) -> None:
        """Stop audio processing."""
        self.running = False
        
        if self._stream is not None:
            self._stream.stop_stream()
            self._stream.close()
        
        if self._audio is not None:
            self._audio.terminate()
        
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        await self._stop_media_capture()
        
        if self._unsubscribe_media_player is not None:
            self._unsubscribe_media_player()
            
        self._stream = None
        self._audio = None
        self._task = None