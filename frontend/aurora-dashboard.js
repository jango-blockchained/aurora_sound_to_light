import {
    LitElement,
    html,
    css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

// Constants
const BREAKPOINT_MOBILE = 768;
const LOCAL_STORAGE_KEY = 'aurora-dashboard-state';
const WEBSOCKET_TYPES = {
    METRICS: 'aurora_sound_to_light/metrics_update',
    STATE: 'aurora_sound_to_light/state_update',
    SUBSCRIBE_METRICS: 'aurora_sound_to_light/subscribe_metrics',
    SUBSCRIBE_STATE: 'aurora_sound_to_light/subscribe_state',
    GET_CONFIG: 'aurora_sound_to_light/get_config',
    GET_METRICS: 'aurora_sound_to_light/get_performance_metrics'
};

class AuroraDashboard extends LitElement {
    static get properties() {
        return {
            hass: { type: Object },
            _state: { type: Object, state: true },
            _config: { type: Object, state: true },
            _connected: { type: Boolean, state: true },
            _error: { type: String, state: true }
        };
    }

    constructor() {
        super();
        this._initializeState();
        this._bindEventHandlers();
    }

    _initializeState() {
        // Initialize state with default values
        this._state = {
            audioState: {
                isPlaying: false,
                volume: 50,
                inputSource: 'default'
            },
            effectState: {
                currentEffect: null,
                effectSettings: {}
            },
            groupState: {
                activeGroups: [],
                groupSettings: {}
            }
        };
        this._config = null;
        this._connected = false;
        this._error = null;

        // Try to load persisted state
        const savedState = this._loadPersistedState();
        if (savedState) {
            this._state = { ...this._state, ...savedState };
        }
    }

    _bindEventHandlers() {
        // Bind event handlers
        this._handleServiceCall = this._handleServiceCall.bind(this);
        this._handleResize = this._handleResize.bind(this);
        this._handleVisibilityChange = this._handleVisibilityChange.bind(this);
        this._handleAudioUpdate = this._handleAudioUpdate.bind(this);
        this._handleMediaControl = this._handleMediaControl.bind(this);
        this._handleEffectChange = this._handleEffectChange.bind(this);
        this._handleGroupUpdate = this._handleGroupUpdate.bind(this);
        this._dismissError = this._dismissError.bind(this);
    }

    async _handleServiceCall(service, data = {}) {
        if (!this.hass) {
            throw new Error('Home Assistant connection not available');
        }
        try {
            await this.hass.callService('aurora_sound_to_light', service, data);
        } catch (error) {
            this._handleError(`Failed to call service ${service}`, error);
            throw error;
        }
    }

    _handleResize() {
        // Handle window resize events
        this.requestUpdate();
    }

    _handleVisibilityChange() {
        // Handle visibility change events
        if (document.hidden) {
            // Pause or cleanup when tab is hidden
            this._pauseAudio();
        }
    }

    _handleAudioUpdate(event) {
        // Handle audio update events
        const { detail } = event;
        this._updateState('audioState', detail);
    }

    _handleMediaControl(event) {
        // Handle media control events
        const { detail } = event;
        if (detail.action === 'play') {
            this._startAudio();
        } else if (detail.action === 'pause') {
            this._pauseAudio();
        } else if (detail.action === 'volume') {
            this._updateVolume(detail.value);
        } else if (detail.action === 'source') {
            this._changeAudioSource(detail.value);
        }
    }

    _handleEffectChange(event) {
        // Handle effect change events
        const { detail } = event;
        this._updateState('effectState', detail);
    }

    _handleGroupUpdate(event) {
        // Handle group update events
        const { detail } = event;
        this._updateState('groupState', detail);
    }

    // State Management Methods
    _loadPersistedState() {
        try {
            const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            console.error('Failed to load persisted state:', e);
            return null;
        }
    }

    _persistState() {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this._state));
        } catch (e) {
            console.error('Failed to persist state:', e);
        }
    }

    _updateState(path, value) {
        if (typeof value === 'object') {
            this._state = {
                ...this._state,
                [path]: {
                    ...this._state[path],
                    ...value
                }
            };
        } else {
            this._state = {
                ...this._state,
                [path]: value
            };
        }
        this.requestUpdate('_state');
    }

    // Error Handling Methods
    _handleError(message, error = null) {
        this._error = message;
        if (error) {
            console.error(message, error);
        }
    }

    _dismissError() {
        this._error = null;
    }

    // WebSocket Methods
    async _initializeWebSocket() {
        if (!this.hass) {
            throw new Error('Home Assistant connection not available');
        }

        try {
            await Promise.all([
                this.hass.callWS({ type: WEBSOCKET_TYPES.SUBSCRIBE_METRICS }),
                this.hass.callWS({ type: WEBSOCKET_TYPES.SUBSCRIBE_STATE })
            ]);

            this._setupWebSocketSubscriptions();
            this._connected = true;
        } catch (error) {
            this._handleError('Failed to initialize WebSocket', error);
            throw error;
        }
    }

    _setupWebSocketSubscriptions() {
        this.hass.connection.subscribeMessage(
            (message) => this._handleStateUpdate(message),
            { type: WEBSOCKET_TYPES.STATE }
        );

        this.hass.connection.subscribeMessage(
            (message) => this._handleMetricsUpdate(message),
            { type: WEBSOCKET_TYPES.METRICS }
        );
    }

    // Audio Control Methods
    async _startAudio() {
        try {
            await this.hass.callService('aurora_sound_to_light', 'start_audio', {
                source: this._state.audioState.inputSource
            });
            this._updateState('audioState', { isPlaying: true });
        } catch (e) {
            this._handleError('Failed to start audio', e);
        }
    }

    async _pauseAudio() {
        try {
            await this.hass.callService('aurora_sound_to_light', 'stop_audio', {});
            this._updateState('audioState', { isPlaying: false });
        } catch (e) {
            this._handleError('Failed to stop audio', e);
        }
    }

    async _updateVolume(volume) {
        try {
            await this.hass.callService('aurora_sound_to_light', 'set_volume', { volume });
            this._updateState('audioState', { volume });
        } catch (e) {
            this._handleError('Failed to update volume', e);
        }
    }

    async _changeAudioSource(source) {
        try {
            await this.hass.callService('aurora_sound_to_light', 'set_audio_source', { source });
            this._updateState('audioState', { inputSource: source });
        } catch (e) {
            this._handleError('Failed to change audio source', e);
        }
    }

    // ... rest of the code stays the same ...
} 