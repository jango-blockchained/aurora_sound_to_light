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
            narrow: { type: Boolean },
            panel: { type: Object },
            route: { type: Object },
            _config: { type: Object, state: true },
            _error: { type: String, state: true },
            _connected: { type: Boolean, state: true },
            _systemCapabilities: { type: Object, state: true }
        };
    }

    constructor() {
        super();
        this._config = {};
        this._error = null;
        this._connected = false;
        this._systemCapabilities = {
            hasAudio: false,
            hasMediaPlayer: false,
            hasSpotify: false
        };
    }

    async firstUpdated() {
        try {
            // Get panel configuration
            const result = await this.hass.callWS({
                type: 'aurora_sound_to_light/get_panel_config'
            });

            this._config = result;
            this._systemCapabilities = {
                hasAudio: result.system_info?.has_audio || false,
                hasMediaPlayer: result.system_info?.has_media_player || false,
                hasSpotify: result.system_info?.has_spotify || false
            };
            this._connected = true;
        } catch (err) {
            this._error = `Failed to load panel configuration: ${err.message}`;
            console.error('Failed to load panel configuration:', err);
        }
    }

    async _updatePanelConfig(config) {
        try {
            await this.hass.callWS({
                type: 'aurora_sound_to_light/update_panel_config',
                config
            });
            this._config = { ...this._config, ...config };
        } catch (err) {
            this._error = `Failed to update panel configuration: ${err.message}`;
            console.error('Failed to update panel configuration:', err);
        }
    }

    render() {
        if (!this.hass) {
            return html`<div>Loading...</div>`;
        }

        if (this._error) {
            return html`
                <div class="error-container">
                    <div class="error-message">
                        <span class="material-symbols-rounded">error</span>
                        ${this._error}
                    </div>
                    <button @click=${() => this.firstUpdated()}>
                        <span class="material-symbols-rounded">refresh</span>
                        Retry
                    </button>
                </div>
            `;
        }

        return html`
            <div class="dashboard-container">
                <div class="dashboard-header">
                    <div class="dashboard-title">
                        <span class="material-symbols-rounded">music_note</span>
                        Aurora Sound to Light
                    </div>
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
                    <!-- Audio Visualizer -->
                    <div class="dashboard-card visualizer-card">
                        <div class="card-header">
                            <span class="material-symbols-rounded">equalizer</span>
                            <span>Audio Visualization</span>
                        </div>
                        <div class="card-content">
                            ${this._systemCapabilities.hasAudio ? html`
                                <aurora-visualizer
                                    .hass=${this.hass}
                                    mode="frequency"
                                    ?isActive=${this._connected}
                                ></aurora-visualizer>
                            ` : html`
                                <div class="feature-unavailable">
                                    <span class="material-symbols-rounded">mic_off</span>
                                    <span>Audio input not available</span>
                                </div>
                            `}
                        </div>
                    </div>

                    <!-- Media Controls -->
                    <div class="dashboard-card">
                        <div class="card-header">
                            <span class="material-symbols-rounded">play_circle</span>
                            <span>Media Controls</span>
                        </div>
                        <div class="card-content">
                            ${this._systemCapabilities.hasMediaPlayer ? html`
                                <aurora-media-controls
                                    .hass=${this.hass}
                                    .config=${this._config}
                                    ?hasSpotify=${this._systemCapabilities.hasSpotify}
                                ></aurora-media-controls>
                            ` : html`
                                <div class="feature-unavailable">
                                    <span class="material-symbols-rounded">music_off</span>
                                    <span>Media player not available</span>
                                </div>
                            `}
                        </div>
                    </div>

                    <!-- Effect Selector -->
                    <div class="dashboard-card">
                        <div class="card-header">
                            <span class="material-symbols-rounded">auto_fix</span>
                            <span>Light Effects</span>
                        </div>
                        <div class="card-content">
                            <aurora-effect-selector
                                .hass=${this.hass}
                                .config=${this._config}
                            ></aurora-effect-selector>
                        </div>
                    </div>

                    <!-- Light Groups -->
                    <div class="dashboard-card">
                        <div class="card-header">
                            <span class="material-symbols-rounded">lightbulb</span>
                            <span>Light Groups</span>
                        </div>
                        <div class="card-content">
                            <aurora-group-manager
                                .hass=${this.hass}
                                .config=${this._config}
                            ></aurora-group-manager>
                        </div>
                    </div>

                    <!-- Performance Monitor -->
                    ${this._config.show_metrics ? html`
                        <div class="dashboard-card">
                            <div class="card-header">
                                <span class="material-symbols-rounded">monitoring</span>
                                <span>Performance</span>
                            </div>
                            <div class="card-content">
                                <aurora-performance-monitor
                                    .hass=${this.hass}
                                ></aurora-performance-monitor>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    static get styles() {
        return css`
            :host {
                display: block;
                --primary-color: var(--ha-primary-color, #03a9f4);
                --secondary-color: var(--ha-accent-color, #ff9800);
                --text-primary-color: var(--primary-text-color, #212121);
                --text-secondary-color: var(--secondary-text-color, #727272);
                --divider-color: var(--divider-color, #bdbdbd);
                --error-color: var(--error-color, #db4437);
                --warning-color: var(--warning-color, #ffa600);
                --success-color: var(--success-color, #43a047);
                --card-background-color: var(--card-background-color, #ffffff);
            }

            .dashboard-container {
                padding: 16px;
                max-width: 1800px;
                margin: 0 auto;
            }

            .dashboard-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 24px;
            }

            .dashboard-title {
                font-size: 24px;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .dashboard-status {
                display: flex;
                align-items: center;
            }

            .connection-status {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 14px;
            }

            .connection-status.connected {
                background-color: var(--success-color);
                color: white;
            }

            .connection-status.disconnected {
                background-color: var(--error-color);
                color: white;
            }

            .dashboard-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                gap: 16px;
            }

            .dashboard-card {
                background-color: var(--card-background-color);
                border-radius: 8px;
                box-shadow: var(--ha-card-box-shadow, 0 2px 2px rgba(0, 0, 0, 0.14));
                overflow: hidden;
            }

            .visualizer-card {
                grid-column: 1 / -1;
            }

            .card-header {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 16px;
                border-bottom: 1px solid var(--divider-color);
                font-size: 16px;
                font-weight: 500;
            }

            .card-content {
                padding: 16px;
            }

            .error-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 16px;
                padding: 32px;
            }

            .error-message {
                display: flex;
                align-items: center;
                gap: 8px;
                color: var(--error-color);
                font-size: 16px;
            }

            .feature-unavailable {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                padding: 32px;
                color: var(--text-secondary-color);
                text-align: center;
            }

            button {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                background-color: var(--primary-color);
                color: white;
                cursor: pointer;
                font-size: 14px;
                transition: background-color 0.2s;
            }

            button:hover {
                background-color: var(--primary-color);
                opacity: 0.9;
            }

            @media (max-width: 768px) {
                .dashboard-container {
                    padding: 8px;
                }

                .dashboard-grid {
                    grid-template-columns: 1fr;
                }

                .dashboard-header {
                    flex-direction: column;
                    gap: 16px;
                    text-align: center;
                }
            }
        `;
    }
}

customElements.define('aurora-dashboard', AuroraDashboard); 