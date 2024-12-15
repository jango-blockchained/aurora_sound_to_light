# Aurora Sound to Light - Project Structure

📦 aurora_sound_to_light
├── 📂 custom_components
│   └── 📂 aurora_sound_to_light
│       ├── 📄 __init__.py              # Main integration initialization
│       ├── 📄 manifest.json            # Integration manifest
│       ├── 📄 const.py                 # Constants and configuration
│       ├── 📄 config_flow.py           # Configuration flow handler
│       │
│       ├── 📂 translations             # Localization
│       │   └── 📄 en.json              # English translations
│       │
│       ├── 📂 core                     # Core functionality
│       │   ├── 📄 __init__.py
│       │   ├── 📄 audio_processor.py   # Audio processing logic
│       │   ├── 📄 beat_detector.py     # Beat detection algorithms
│       │   ├── 📄 effect_engine.py     # Effect processing engine
│       │   ├── 📄 light_controller.py  # Light control management
│       │   └── 📄 latency_monitor.py   # Performance monitoring
│       │
│       ├── 📂 effects                  # Light effects
│       │   ├── 📄 __init__.py
│       │   ├── 📄 base_effect.py       # Base effect class
│       │   ├── 📄 bass_pulse.py        # Bass-reactive effect
│       │   ├── 📄 color_wave.py        # Color wave effect
│       │   ├── 📄 frequency_sweep.py   # Frequency sweep effect
│       │   ├── 📄 rainbow_flow.py      # Rainbow flow effect
│       │   └── 📄 strobe_sync.py       # Strobe effect
│       │
│       ├── 📂 sensors                  # Sensor implementations
│       │   ├── 📄 __init__.py
│       │   ├── 📄 audio_sensor.py      # Audio metrics sensor
│       │   └── 📄 performance_sensor.py # Performance metrics
│       │
│       └── 📂 frontend                 # Frontend components
│           ├── 📄 index.js             # Frontend entry point
│           ├── 📄 index.html           # Frontend HTML template
│           ├── 📄 aurora-dashboard.js  # Main dashboard component
│           ├── 📄 aurora-media-controls.js # Media player controls
│           ├── 📄 aurora-visualizer.js # Audio visualization
│           ├── 📄 aurora-effect-selector.js # Effect selection
│           ├── 📄 aurora-group-manager.js # Light group management
│           └── 📄 aurora-performance-monitor.js # System performance monitoring
│
├── 📂 tests                            # Test suite
│   ├── 📄 __init__.py
│   ├── 📄 test_init.py                # Integration tests
│   ├── 📄 test_config_flow.py         # Config flow tests
│   └── 📂 test_core                    # Core component tests
│       ├── 📄 test_audio_processor.py
│       ├── 📄 test_beat_detector.py
│       └── 📄 test_effect_engine.py
│
├── 📂 .github                          # GitHub configuration
│   └── 📂 workflows                    # CI/CD workflows
│       ├── 📄 hassfest.yaml           # HA validation
│       ├── 📄 validate.yaml           # Code validation
│       └── 📄 release.yaml            # Release automation
│
├── 📄 README.md                        # Project documentation
├── 📄 CHANGELOG.md                     # Version history
├── 📄 LICENSE                          # License information
├── 📄 requirements.txt                 # Python dependencies
└── 📄 hacs.json                        # HACS configuration
