import {
    LitElement,
    html,
    css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class AuroraDashboard extends LitElement {
    static get properties() {
        return {
            hass: { type: Object },
            narrow: { type: Boolean },
            debug: { type: Boolean },
            _audioData: { type: Object },
            _mediaPlayer: { type: String },
        };
    }

    static get styles() {
        return css`
            :host {
                display: block;
                padding: 16px;
                --mdc-theme-primary: var(--primary-color);
                background: var(--primary-background-color);
                min-height: 100vh;
                color: var(--primary-text-color);
            }
            ha-card {
                margin-bottom: 16px;
            }
            .grid-container {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 16px;
                padding: 16px;
            }
            .control-section {
                background: var(--card-background-color);
                border-radius: var(--ha-card-border-radius, 8px);
                padding: 16px;
                box-shadow: var(--ha-card-box-shadow, none);
            }
            .section-header {
                font-size: 18px;
                font-weight: 500;
                margin-bottom: 16px;
                color: var(--primary-text-color);
            }
            .error {
                color: var(--error-color);
                padding: 16px;
            }
            .loading {
                padding: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .card-header {
                padding: 16px;
                font-size: 24px;
                font-weight: 500;
                color: var(--primary-text-color);
            }
            .media-player-select {
                width: 100%;
                margin-bottom: 16px;
            }
        `;
    }

    constructor() {
        super();
        this.debug = false;
        this._mediaPlayer = null;
        this._audioData = {
            frequencies: new Float32Array(32).fill(0),
            waveform: new Float32Array(32).fill(0),
            beat: false,
            energy: 0,
            tempo: 0,
        };
        this._boundAudioUpdate = this._handleAudioUpdate.bind(this);
    }

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener('aurora_audio_update', this._boundAudioUpdate);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('aurora_audio_update', this._boundAudioUpdate);
    }

    _handleAudioUpdate(event) {
        this._audioData = event.detail;
        const visualizer = this.shadowRoot.querySelector('aurora-visualizer');
        if (visualizer) {
            visualizer.updateAudioData(this._audioData);
        }
    }

    _getMediaPlayers() {
        if (!this.hass) return [];
        return Object.entries(this.hass.states)
            .filter(([entityId]) => entityId.startsWith('media_player.'))
            .map(([entityId, state]) => ({
                entityId,
                name: state.attributes.friendly_name || entityId,
            }));
    }

    async _handleMediaPlayerChange(event) {
        const mediaPlayer = event.target.value;
        this._mediaPlayer = mediaPlayer;
        
        // Call service to update audio processor
        await this.hass.callService('aurora_sound_to_light', 'set_media_player', {
            entity_id: mediaPlayer,
        });
    }

    render() {
        const mediaPlayers = this._getMediaPlayers();

        return html`
            <ha-card>
                <div class="card-header">
                    Aurora Sound to Light
                </div>
                <div class="grid-container">
                    <div class="control-section">
                        <div class="section-header">Audio Input</div>
                        <ha-select
                            class="media-player-select"
                            label="Media Player"
                            .value=${this._mediaPlayer || ''}
                            @selected=${this._handleMediaPlayerChange}
                        >
                            ${mediaPlayers.map(player => html`
                                <ha-list-item value=${player.entityId}>
                                    ${player.name}
                                </ha-list-item>
                            `)}
                        </ha-select>
                        <aurora-media-controls 
                            .hass=${this.hass}
                            .mediaPlayer=${this._mediaPlayer}
                        ></aurora-media-controls>
                    </div>
                    <div class="control-section">
                        <div class="section-header">Visualization</div>
                        <aurora-visualizer
                            .hass=${this.hass}
                            .debug=${this.debug}
                        ></aurora-visualizer>
                    </div>
                    <div class="control-section">
                        <div class="section-header">Effects</div>
                        <aurora-effect-selector
                            .hass=${this.hass}
                            .audioData=${this._audioData}
                        ></aurora-effect-selector>
                    </div>
                    <div class="control-section">
                        <div class="section-header">Light Groups</div>
                        <aurora-group-manager
                            .hass=${this.hass}
                            .audioData=${this._audioData}
                        ></aurora-group-manager>
                    </div>
                </div>
            </ha-card>
        `;
    }
}

customElements.define("aurora-dashboard", AuroraDashboard); 