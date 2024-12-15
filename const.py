"""Constants for the Aurora Sound to Light integration."""

DOMAIN = "aurora_sound_to_light"

# Configuration keys
CONF_AUDIO_INPUT = "audio_input_selection"
CONF_LIGHT_GROUPS = "light_group_setup"
CONF_EFFECT_PREFERENCES = "effect_preferences"
CONF_LATENCY_THRESHOLD = "latency_threshold"
CONF_BUFFER_SIZE = "buffer_size"
CONF_FREQUENCY_BANDS = "frequency_bands"
CONF_COLOR_PREFERENCES = "color_preferences"
CONF_TRANSITION_SPEED = "transition_speed"

# Defaults
DEFAULT_BUFFER_SIZE = 100  # ms
DEFAULT_LATENCY_THRESHOLD = 50  # ms
DEFAULT_FREQUENCY_BANDS = 32
DEFAULT_TRANSITION_SPEED = 100  # ms

# Effect names
EFFECT_BASS_PULSE = "bass_pulse"
EFFECT_FREQ_SWEEP = "frequency_sweep"
EFFECT_COLOR_WAVE = "color_wave"
EFFECT_STROBE_SYNC = "strobe_sync"
EFFECT_RAINBOW_FLOW = "rainbow_flow"
EFFECT_CUSTOM = "custom"

# Audio input types
AUDIO_INPUT_MIC = "microphone"
AUDIO_INPUT_MEDIA = "media_player" 