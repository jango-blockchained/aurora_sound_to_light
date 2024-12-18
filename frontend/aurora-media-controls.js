import {
    LitElement,
    html,
    css,
} from "https://cdn.jsdelivr.net/gh/lit/dist@2/core/lit-core.min.js";

class AuroraMediaControls extends LitElement {
    static get properties() {
        return {
            hass: { type: Object },
            _state: { type: Object, state: true },
            _sources: { type: Array, state: true },
            _loading: { type: Boolean, state: true }
        };
    }

    constructor() {
        super();
        this._state = {
            isPlaying: false,
            volume: 50,
            currentSource: null,
            connectionStatus: 'disconnected'
        };
        this._sources = [];
        this._loading = false;
        this._connectionError = null;
    }

    static get styles() {
        return css`
            :host {
                display: block;
                padding: 16px;
            }

            .controls-container {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .playback-controls {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 16px;
            }

            .volume-control {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .source-selector {
                width: 100%;
            }

            button {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                background: var(--primary-color);
                color: white;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: background-color 0.3s ease;
            }

            button:hover {
                background: var(--primary-color-light);
            }

            button:disabled {
                background: var(--disabled-color, #ccc);
                cursor: not-allowed;
            }

            .material-symbols-rounded {
                font-size: 24px;
            }

            input[type="range"] {
                flex: 1;
                height: 4px;
                border-radius: 2px;
                background: var(--primary-color-light);
            }

            select {
                width: 100%;
                padding: 8px;
                border-radius: 4px;
                border: 1px solid var(--divider-color, #ccc);
                background: var(--card-background-color, #fff);
                color: var(--primary-text-color);
            }

            .loading {
                opacity: 0.7;
                pointer-events: none;
            }

            .status-indicator {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 0.9em;
                color: var(--secondary-text-color);
            }

            .status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: var(--error-color);
            }

            .status-dot.active {
                background: var(--success-color);
            }

            .error-message {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 16px;
                background: var(--error-color);
                color: white;
                border-radius: 4px;
                margin-bottom: 16px;
            }

            .connection-status {
                display: flex;
                align-items: center;
                gap: 4px;
                font-size: 0.9em;
                margin-bottom: 8px;
                padding: 4px 8px;
                border-radius: 4px;
            }

            .connection-status.connected {
                color: var(--success-color);
            }

            .connection-status.disconnected {
                color: var(--error-color);
            }

            .material-symbols-rounded {
                font-size: 18px;
            }
        `;
    }

    async firstUpdated() {
        if (this.hass) {
            try {
                await this._initializeConnection();
                await this._fetchSources();
                await this._fetchState();
            } catch (error) {
                console.error('Failed to initialize:', error);
                this._connectionError = error.message;
                this._state.connectionStatus = 'error';
            }
        }
    }

    updated(changedProps) {
        if (changedProps.has('hass') && this.hass) {
            this._fetchSources();
            this._fetchState();
        }
    }

    async _fetchSources() {
        try {
            const response = await this.hass.callWS({
                type: 'aurora_sound_to_light/get_audio_sources'
            });
            this._sources = response.sources || [];
            if (this._sources.length > 0 && !this._state.currentSource) {
                this._state = {
                    ...this._state,
                    currentSource: this._sources[0]
                };
            }
        } catch (error) {
            console.error('Failed to fetch audio sources:', error);
        }
    }

    async _fetchState() {
        try {
            const response = await this.hass.callWS({
                type: 'aurora_sound_to_light/get_state'
            });
            this._state = {
                ...this._state,
                isPlaying: response.isPlaying || false,
                volume: response.volume || 50,
                currentSource: response.currentSource || this._state.currentSource
            };
        } catch (error) {
            console.error('Failed to fetch state:', error);
        }
    }

    async _handlePlayPause() {
        this._loading = true;
        try {
            await this.hass.callService('aurora_sound_to_light',
                this._state.isPlaying ? 'stop_audio' : 'start_audio',
                { source: this._state.currentSource }
            );
            this._state = {
                ...this._state,
                isPlaying: !this._state.isPlaying
            };
        } catch (error) {
            console.error('Failed to toggle playback:', error);
        } finally {
            this._loading = false;
        }
    }

    async _handleVolumeChange(e) {
        const volume = parseInt(e.target.value);
        try {
            await this.hass.callService('aurora_sound_to_light', 'set_volume', {
                volume
            });
            this._state = {
                ...this._state,
                volume
            };
        } catch (error) {
            console.error('Failed to update volume:', error);
        }
    }

    async _handleSourceChange(e) {
        const source = e.target.value;
        this._loading = true;
        try {
            await this.hass.callService('aurora_sound_to_light', 'set_audio_source', {
                source
            });
            this._state = {
                ...this._state,
                currentSource: source
            };
            if (this._state.isPlaying) {
                await this._handlePlayPause();
            }
        } catch (error) {
            console.error('Failed to change audio source:', error);
        } finally {
            this._loading = false;
        }
    }

    async _initializeConnection() {
        try {
            await this.hass.callWS({
                type: 'aurora_sound_to_light/ping'
            });
            this._state.connectionStatus = 'connected';
            this._connectionError = null;
        } catch (error) {
            this._state.connectionStatus = 'error';
            this._connectionError = 'Failed to connect to Aurora service';
            throw error;
        }
    }

    render() {
        if (!this.hass) return html`<div>Loading...</div>`;

        if (this._connectionError) {
            return html`
                <div class="error-message">
                    <span class="material-symbols-rounded">error</span>
                    ${this._connectionError}
                </div>
            `;
        }

        return html`
            <div class="controls-container ${this._loading ? 'loading' : ''}">
                ${this._state.connectionStatus === 'connected' ? html`
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
                <div class="playback-controls">
                    <button @click=${this._handlePlayPause} ?disabled=${!this._state.currentSource}>
                        <span class="material-symbols-rounded">
                            ${this._state.isPlaying ? 'pause' : 'play_arrow'}
                        </span>
                        ${this._state.isPlaying ? 'Pause' : 'Play'}
                    </button>
                    <div class="status-indicator">
                        <div class="status-dot ${this._state.isPlaying ? 'active' : ''}"></div>
                        ${this._state.isPlaying ? 'Playing' : 'Stopped'}
                    </div>
                </div>

                <div class="volume-control">
                    <span class="material-symbols-rounded">
                        ${this._state.volume === 0 ? 'volume_off' :
                this._state.volume < 50 ? 'volume_down' : 'volume_up'}
                    </span>
                    <input type="range"
                        min="0"
                        max="100"
                        .value=${this._state.volume}
                        @change=${this._handleVolumeChange}
                    />
                    <span>${this._state.volume}%</span>
                </div>

                <div class="source-selector">
                    <select .value=${this._state.currentSource || ''}
                            @change=${this._handleSourceChange}>
                        ${!this._state.currentSource ? html`
                            <option value="" disabled selected>Select audio source</option>
                        ` : ''}
                        ${this._sources.map(source => html`
                            <option value=${source}>${source}</option>
                        `)}
                    </select>
                </div>
            </div>
        `;
    }
}

customElements.define('aurora-media-controls', AuroraMediaControls); 