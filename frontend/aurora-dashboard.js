import {
    LitElement,
    html,
    css,
} from "https://cdn.jsdelivr.net/gh/lit/dist@2/core/lit-core.min.js";

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

    static get styles() {
        return css`
            :host {
                display: block;
                padding: 16px;
            }

            .dashboard-container {
                display: grid;
                gap: 16px;
            }

            .dashboard-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            }

            .dashboard-title {
                font-size: 1.5em;
                font-weight: 500;
                color: var(--primary-text-color);
            }

            .dashboard-status {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .dashboard-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 16px;
            }

            .dashboard-card {
                background: var(--card-background-color, #fff);
                border-radius: var(--ha-card-border-radius, 4px);
                box-shadow: var(--ha-card-box-shadow, 0 2px 2px rgba(0, 0, 0, 0.1));
                overflow: hidden;
            }

            .card-header {
                padding: 16px;
                border-bottom: 1px solid var(--divider-color);
                font-weight: 500;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .card-content {
                padding: 16px;
            }

            .metrics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 16px;
            }

            .metric-item {
                text-align: center;
                padding: 8px;
            }

            .metric-value {
                font-size: 1.5em;
                font-weight: 500;
                color: var(--primary-color);
            }

            .metric-label {
                font-size: 0.9em;
                color: var(--secondary-text-color);
            }

            .error-message {
                background: var(--error-color);
                color: white;
                padding: 16px;
                border-radius: 4px;
                margin-bottom: 16px;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .connection-status {
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 0.9em;
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .connection-status.connected {
                color: var(--success-color);
            }

            .connection-status.disconnected {
                color: var(--error-color);
            }

            @media (max-width: ${BREAKPOINT_MOBILE}px) {
                .dashboard-grid {
                    grid-template-columns: 1fr;
                }
            }
        `;
    }

    render() {
        if (!this.hass) return html`<div>Loading...</div>`;

        if (this._error) {
            return html`
                <div class="error-message">
                    <span class="material-symbols-rounded">error</span>
                    ${this._error}
                </div>
            `;
        }

        return html`
            <div class="dashboard-container">
                <div class="dashboard-header">
                    <div class="dashboard-title">Aurora Sound to Light</div>
                    <div class="dashboard-status">
                        ${this._connected ? html`
                            <div class="connection-status connected">
                                <span class="material-symbols-rounded">check_circle</span>
                                Connected
                            </div>
                        ` : html`
                            <div class="connection-status disconnected">
                                <span class="material-symbols-rounded">error</span>
                                Disconnected
                            </div>
                        `}
                    </div>
                </div>

                <div class="dashboard-grid">
                    <!-- Media Controls Card -->
                    <div class="dashboard-card">
                        <div class="card-header">
                            <span>Media Controls</span>
                        </div>
                        <div class="card-content">
                            <aurora-media-controls
                                .hass=${this.hass}
                                @audio-update=${this._handleAudioUpdate}
                                @media-control=${this._handleMediaControl}
                            ></aurora-media-controls>
                        </div>
                    </div>

                    <!-- Visualizer Card -->
                    <div class="dashboard-card">
                        <div class="card-header">
                            <span>Audio Visualization</span>
                        </div>
                        <div class="card-content">
                            <aurora-visualizer
                                .hass=${this.hass}
                                mode="frequency"
                                ?isActive=${this._state.audioState.isPlaying}
                            ></aurora-visualizer>
                        </div>
                    </div>

                    <!-- Effect Selector Card -->
                    <div class="dashboard-card">
                        <div class="card-header">
                            <span>Light Effects</span>
                        </div>
                        <div class="card-content">
                            <aurora-effect-selector
                                .hass=${this.hass}
                                @effect-change=${this._handleEffectChange}
                            ></aurora-effect-selector>
                        </div>
                    </div>

                    <!-- Group Manager Card -->
                    <div class="dashboard-card">
                        <div class="card-header">
                            <span>Light Groups</span>
                        </div>
                        <div class="card-content">
                            <aurora-group-manager
                                .hass=${this.hass}
                                @group-update=${this._handleGroupUpdate}
                            ></aurora-group-manager>
                        </div>
                    </div>

                    <!-- Performance Metrics Card -->
                    ${this._config?.show_metrics ? html`
                        <div class="dashboard-card">
                            <div class="card-header">
                                <span>Performance Metrics</span>
                            </div>
                            <div class="card-content">
                                <div class="metrics-grid">
                                    <div class="metric-item">
                                        <div class="metric-value">${this._state.metrics?.fps || 0}</div>
                                        <div class="metric-label">FPS</div>
                                    </div>
                                    <div class="metric-item">
                                        <div class="metric-value">${this._state.metrics?.latency || 0}ms</div>
                                        <div class="metric-label">Latency</div>
                                    </div>
                                    <div class="metric-item">
                                        <div class="metric-value">${this._state.metrics?.cpu_usage || 0}%</div>
                                        <div class="metric-label">CPU Usage</div>
                                    </div>
                                    <div class="metric-item">
                                        <div class="metric-value">${this._state.metrics?.memory_usage || 0}MB</div>
                                        <div class="metric-label">Memory Usage</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // WebSocket Event Handlers
    _handleStateUpdate(message) {
        this._updateState({
            audioState: message.audio_state || this._state.audioState,
            effectState: message.effect_state || this._state.effectState,
            groupState: message.group_state || this._state.groupState
        });
    }

    _handleMetricsUpdate(message) {
        this._updateState({
            metrics: message.metrics || {}
        });
    }

    // Cleanup
    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('resize', this._handleResize);
        document.removeEventListener('visibilitychange', this._handleVisibilityChange);
        this._persistState();
    }
}

customElements.define('aurora-dashboard', AuroraDashboard); 