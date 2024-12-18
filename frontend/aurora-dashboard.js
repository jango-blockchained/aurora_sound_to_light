import {
    LitElement,
    html,
    css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

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
        this._state = this._loadPersistedState() || {
            connected: false,
            authenticated: false,
            error: null,
            activeEffects: [],
            audioState: {
                inputSource: null,
                volume: 1.0,
                isPlaying: false
            },
            selectedGroups: [],
            performanceMetrics: {
                latency: 0,
                cpuUsage: 0,
                memoryUsage: 0
            },
            layout: {
                mode: window.innerWidth < 768 ? 'mobile' : 'desktop',
                componentOrder: this._getDefaultComponentOrder()
            }
        };

        this._config = {};
        this._connected = false;
        this._error = null;
        this._eventBus = {
            listeners: new Map(),
            componentEvents: new Map(),
            history: [],
            maxHistoryLength: 50
        };

        // Bind methods
        this._handleResize = this._handleResize.bind(this);
        this._handleVisibilityChange = this._handleVisibilityChange.bind(this);
    }

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener('resize', this._handleResize);
        document.addEventListener('visibilitychange', this._handleVisibilityChange);
        this._initializeComponents();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('resize', this._handleResize);
        document.removeEventListener('visibilitychange', this._handleVisibilityChange);
        this._cleanupComponents();
    }

    firstUpdated() {
        this._setupWebSocket();
        this._loadConfiguration();
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('hass')) {
            this._handleHassUpdate();
        }
        if (changedProperties.has('_state')) {
            this._persistState();
            this._notifyComponents();
        }
    }

    render() {
        return html`
            <div class="dashboard ${this._state.layout.mode}">
                <div class="header">
                    <h1>Aurora Sound to Light</h1>
                    ${this._error ? html`
                        <div class="error-banner">
                            ${this._error}
                            <button @click=${this._dismissError}>Dismiss</button>
                        </div>
                    ` : ''}
                </div>
                
                <div class="main-content">
                    <aurora-visualizer
                        .hass=${this.hass}
                        .audioState=${this._state.audioState}
                        @audio-update=${this._handleAudioUpdate}>
                    </aurora-visualizer>

                    <div class="controls-section">
                        <aurora-media-controls
                            .hass=${this.hass}
                            .audioState=${this._state.audioState}
                            @media-control=${this._handleMediaControl}>
                        </aurora-media-controls>

                        <aurora-effect-selector
                            .hass=${this.hass}
                            .activeEffects=${this._state.activeEffects}
                            @effect-change=${this._handleEffectChange}>
                        </aurora-effect-selector>
                    </div>

                    <div class="management-section">
                        <aurora-group-manager
                            .hass=${this.hass}
                            .selectedGroups=${this._state.selectedGroups}
                            @group-update=${this._handleGroupUpdate}>
                        </aurora-group-manager>

                        <aurora-performance-monitor
                            .hass=${this.hass}
                            .metrics=${this._state.performanceMetrics}>
                        </aurora-performance-monitor>
                    </div>
                </div>
            </div>
        `;
    }

    static get styles() {
        return css`
            :host {
                display: block;
                --primary-color: var(--aurora-primary-color, #7289da);
                --secondary-color: var(--aurora-secondary-color, #99aab5);
                --background-color: var(--aurora-background-color, #1a1b1e);
                --surface-color: var(--aurora-surface-color, #2c2f33);
                --error-color: var(--aurora-error-color, #f04747);
                --text-primary: var(--aurora-text-primary, #ffffff);
                --text-secondary: var(--aurora-text-secondary, #b9bbbe);
            }

            .dashboard {
                background: var(--background-color);
                min-height: 100vh;
                padding: 1rem;
            }

            .header {
                margin-bottom: 2rem;
            }

            h1 {
                color: var(--text-primary);
                margin: 0;
                font-size: 2rem;
            }

            .error-banner {
                background: var(--error-color);
                color: white;
                padding: 1rem;
                margin-top: 1rem;
                border-radius: 4px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .main-content {
                display: grid;
                gap: 1rem;
                grid-template-columns: 1fr;
            }

            .controls-section,
            .management-section {
                display: grid;
                gap: 1rem;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            }

            /* Mobile layout */
            .mobile .main-content {
                grid-template-columns: 1fr;
            }

            /* Desktop layout */
            @media (min-width: 768px) {
                .desktop .main-content {
                    grid-template-columns: repeat(2, 1fr);
                }
            }
        `;
    }

    // Event Handlers
    _handleResize() {
        const mode = window.innerWidth < 768 ? 'mobile' : 'desktop';
        if (this._state.layout.mode !== mode) {
            this._state = {
                ...this._state,
                layout: {
                    ...this._state.layout,
                    mode
                }
            };
        }
    }

    _handleVisibilityChange() {
        if (document.hidden) {
            this._pauseComponents();
        } else {
            this._resumeComponents();
        }
    }

    _handleHassUpdate() {
        if (this.hass) {
            this._updatePerformanceMetrics();
        }
    }

    _handleAudioUpdate(e) {
        this._state = {
            ...this._state,
            audioState: {
                ...this._state.audioState,
                ...e.detail
            }
        };
    }

    _handleMediaControl(e) {
        const { action, value } = e.detail;
        switch (action) {
            case 'play':
                this._startAudio();
                break;
            case 'pause':
                this._pauseAudio();
                break;
            case 'volume':
                this._updateVolume(value);
                break;
            case 'source':
                this._changeAudioSource(value);
                break;
        }
    }

    _handleEffectChange(e) {
        const { effect, active } = e.detail;
        const activeEffects = active
            ? [...this._state.activeEffects, effect]
            : this._state.activeEffects.filter(e => e !== effect);

        this._state = {
            ...this._state,
            activeEffects
        };
    }

    _handleGroupUpdate(e) {
        this._state = {
            ...this._state,
            selectedGroups: e.detail.groups
        };
    }

    _dismissError() {
        this._error = null;
    }

    // Utility Methods
    _loadPersistedState() {
        try {
            const saved = localStorage.getItem('aurora-dashboard-state');
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            console.error('Failed to load persisted state:', e);
            return null;
        }
    }

    _persistState() {
        try {
            localStorage.setItem('aurora-dashboard-state', JSON.stringify(this._state));
        } catch (e) {
            console.error('Failed to persist state:', e);
        }
    }

    _getDefaultComponentOrder() {
        return [
            'visualizer',
            'media-controls',
            'effect-selector',
            'group-manager',
            'performance-monitor'
        ];
    }

    async _setupWebSocket() {
        try {
            await this._initializeWebSocket();
            this._connected = true;
        } catch (e) {
            this._error = 'Failed to connect to Home Assistant';
            console.error('WebSocket setup failed:', e);
        }
    }

    async _loadConfiguration() {
        try {
            const response = await this.hass.callWS({
                type: 'aurora_sound_to_light/get_config'
            });
            this._config = response.config;
        } catch (e) {
            this._error = 'Failed to load configuration';
            console.error('Configuration load failed:', e);
        }
    }

    async _updatePerformanceMetrics() {
        try {
            const response = await this.hass.callWS({
                type: 'aurora_sound_to_light/get_performance_metrics'
            });
            this._state = {
                ...this._state,
                performanceMetrics: response.metrics
            };
        } catch (e) {
            console.error('Failed to update performance metrics:', e);
        }
    }

    _initializeComponents() {
        // Initialize child components
        this._initializeVisualizer();
        this._initializeMediaControls();
        this._initializeEffectSelector();
        this._initializeGroupManager();
        this._initializePerformanceMonitor();
    }

    _cleanupComponents() {
        // Cleanup child components
        this._state.activeEffects.forEach(effect => {
            this.hass.callService('aurora_sound_to_light', 'stop_effect', {
                effect_id: effect
            });
        });
    }

    _pauseComponents() {
        if (this._state.audioState.isPlaying) {
            this._pauseAudio();
        }
    }

    _resumeComponents() {
        this._updatePerformanceMetrics();
    }

    _notifyComponents() {
        this.requestUpdate();
    }

    // Audio Control Methods
    async _startAudio() {
        try {
            await this.hass.callService('aurora_sound_to_light', 'start_audio', {
                source: this._state.audioState.inputSource
            });
            this._state = {
                ...this._state,
                audioState: {
                    ...this._state.audioState,
                    isPlaying: true
                }
            };
        } catch (e) {
            this._error = 'Failed to start audio';
            console.error('Audio start failed:', e);
        }
    }

    async _pauseAudio() {
        try {
            await this.hass.callService('aurora_sound_to_light', 'stop_audio', {});
            this._state = {
                ...this._state,
                audioState: {
                    ...this._state.audioState,
                    isPlaying: false
                }
            };
        } catch (e) {
            this._error = 'Failed to stop audio';
            console.error('Audio stop failed:', e);
        }
    }

    async _updateVolume(volume) {
        try {
            await this.hass.callService('aurora_sound_to_light', 'set_volume', {
                volume: volume
            });
            this._state = {
                ...this._state,
                audioState: {
                    ...this._state.audioState,
                    volume: volume
                }
            };
        } catch (e) {
            this._error = 'Failed to update volume';
            console.error('Volume update failed:', e);
        }
    }

    async _changeAudioSource(source) {
        try {
            await this.hass.callService('aurora_sound_to_light', 'set_audio_source', {
                source: source
            });
            this._state = {
                ...this._state,
                audioState: {
                    ...this._state.audioState,
                    inputSource: source
                }
            };
        } catch (e) {
            this._error = 'Failed to change audio source';
            console.error('Audio source change failed:', e);
        }
    }

    async _initializeWebSocket() {
        if (!this.hass) {
            throw new Error('Home Assistant connection not available');
        }

        try {
            // Subscribe to performance metrics updates
            await this.hass.callWS({
                type: 'aurora_sound_to_light/subscribe_metrics'
            });

            // Subscribe to state updates
            await this.hass.callWS({
                type: 'aurora_sound_to_light/subscribe_state'
            });

            // Handle incoming messages
            this.hass.connection.subscribeMessage(
                (message) => this._handleWebSocketMessage(message),
                {
                    type: 'aurora_sound_to_light/state_update'
                }
            );

            this.hass.connection.subscribeMessage(
                (message) => this._handleWebSocketMessage(message),
                {
                    type: 'aurora_sound_to_light/metrics_update'
                }
            );
        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
            throw error;
        }
    }

    _handleWebSocketMessage(message) {
        switch (message.type) {
            case 'aurora_sound_to_light/state_update':
                this._handleStateUpdate(message.data);
                break;
            case 'aurora_sound_to_light/metrics_update':
                this._handleMetricsUpdate(message.data);
                break;
            default:
                console.warn('Unknown message type:', message.type);
        }
    }

    _handleStateUpdate(data) {
        this._state = {
            ...this._state,
            ...data
        };
    }

    _handleMetricsUpdate(data) {
        this._state = {
            ...this._state,
            performanceMetrics: {
                ...this._state.performanceMetrics,
                ...data
            }
        };
    }

    // Component initialization methods
    _initializeVisualizer() {
        const visualizer = this.shadowRoot.querySelector('aurora-visualizer');
        if (visualizer) {
            visualizer.addEventListener('error', (e) => {
                this._error = e.detail.message;
            });
        }
    }

    _initializeMediaControls() {
        const controls = this.shadowRoot.querySelector('aurora-media-controls');
        if (controls) {
            controls.addEventListener('error', (e) => {
                this._error = e.detail.message;
            });
        }
    }

    _initializeEffectSelector() {
        const selector = this.shadowRoot.querySelector('aurora-effect-selector');
        if (selector) {
            selector.addEventListener('error', (e) => {
                this._error = e.detail.message;
            });
        }
    }

    _initializeGroupManager() {
        const manager = this.shadowRoot.querySelector('aurora-group-manager');
        if (manager) {
            manager.addEventListener('error', (e) => {
                this._error = e.detail.message;
            });
        }
    }

    _initializePerformanceMonitor() {
        const monitor = this.shadowRoot.querySelector('aurora-performance-monitor');
        if (monitor) {
            monitor.addEventListener('error', (e) => {
                this._error = e.detail.message;
            });
        }
    }
}

customElements.define('aurora-dashboard', AuroraDashboard); 