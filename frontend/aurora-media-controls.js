import {
    LitElement,
    html,
    css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class AuroraMediaControls extends LitElement {
    static get properties() {
        return {
            hass: { type: Object },
            mediaPlayers: { type: Array },
            selectedPlayer: { type: String },
            volume: { type: Number },
            inputSource: { type: String },
            isPlaying: { type: Boolean },
            currentTrack: { type: Object },
            bufferSize: { type: Number },
            microphoneGain: { type: Number }
        };
    }

    static get styles() {
        return css`
            :host {
                display: block;
                padding: 16px;
                background: var(--card-background-color, #fff);
                border-radius: var(--ha-card-border-radius, 4px);
                box-shadow: var(--ha-card-box-shadow, 0 2px 2px rgba(0, 0, 0, 0.1));
            }

            .controls-container {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            }

            .title {
                font-size: 1.2em;
                font-weight: 500;
                color: var(--primary-text-color);
            }

            .player-selector {
                width: 100%;
                padding: 8px;
                border-radius: 4px;
                border: 1px solid var(--divider-color);
            }

            .control-row {
                display: flex;
                align-items: center;
                gap: 16px;
            }

            .playback-controls {
                display: flex;
                justify-content: center;
                gap: 16px;
            }

            button {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                background: var(--primary-color);
                color: white;
                cursor: pointer;
                transition: background 0.3s ease;
            }

            button:hover {
                background: var(--primary-color-light);
            }

            button:disabled {
                background: var(--disabled-color);
                cursor: not-allowed;
            }

            .volume-slider {
                flex: 1;
                height: 36px;
            }

            .source-switch {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .track-info {
                padding: 8px;
                background: var(--secondary-background-color);
                border-radius: 4px;
                margin-top: 16px;
            }

            .track-info .title {
                font-weight: bold;
            }

            .track-info .artist {
                color: var(--secondary-text-color);
            }

            .settings-row {
                display: flex;
                align-items: center;
                gap: 16px;
                margin-top: 16px;
            }

            .settings-label {
                min-width: 120px;
                color: var(--primary-text-color);
            }

            input[type="range"] {
                flex: 1;
                height: 4px;
                border-radius: 2px;
                background: var(--primary-color);
            }

            input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: var(--primary-color);
                cursor: pointer;
            }
        `;
    }

    constructor() {
        super();
        this.mediaPlayers = [];
        this.selectedPlayer = '';
        this.volume = 1.0;
        this.inputSource = 'media_player';
        this.isPlaying = false;
        this.currentTrack = {
            title: '',
            artist: '',
            album: '',
            duration: 0,
            position: 0
        };
        this.bufferSize = 2048;
        this.microphoneGain = 1.0;
    }

    firstUpdated() {
        this._initializeMediaPlayers();
        this._setupAudioContext();
    }

    render() {
        return html`
            <div class="controls-container">
                <div class="header">
                    <div class="title">Media Controls</div>
                </div>

                <select class="player-selector" 
                        .value=${this.selectedPlayer}
                        @change=${this._handlePlayerChange}>
                    <option value="">Select Media Player</option>
                    ${this.mediaPlayers.map(player => html`
                        <option value=${player.entity_id}>${player.name}</option>
                    `)}
                </select>

                <div class="source-switch">
                    <label>
                        <input type="radio" 
                               name="source" 
                               value="media_player"
                               .checked=${this.inputSource === 'media_player'}
                               @change=${this._handleSourceChange}>
                        Media Player
                    </label>
                    <label>
                        <input type="radio" 
                               name="source" 
                               value="microphone"
                               .checked=${this.inputSource === 'microphone'}
                               @change=${this._handleSourceChange}>
                        Microphone
                    </label>
                </div>

                <div class="playback-controls">
                    <button @click=${this._handlePrevious} 
                            ?disabled=${!this.selectedPlayer || this.inputSource !== 'media_player'}>
                        ⏮️
                    </button>
                    <button @click=${this._handlePlayPause}
                            ?disabled=${!this.selectedPlayer && this.inputSource === 'media_player'}>
                        ${this.isPlaying ? '⏸️' : '▶️'}
                    </button>
                    <button @click=${this._handleNext}
                            ?disabled=${!this.selectedPlayer || this.inputSource !== 'media_player'}>
                        ⏭️
                    </button>
                </div>

                <div class="control-row">
                    <span>Volume</span>
                    <input type="range" 
                           class="volume-slider"
                           min="0" 
                           max="1" 
                           step="0.01"
                           .value=${this.volume}
                           @input=${this._handleVolumeChange}>
                </div>

                ${this.inputSource === 'microphone' ? html`
                    <div class="settings-row">
                        <span class="settings-label">Microphone Gain</span>
                        <input type="range" 
                               min="0" 
                               max="2" 
                               step="0.1"
                               .value=${this.microphoneGain}
                               @input=${this._handleGainChange}>
                    </div>

                    <div class="settings-row">
                        <span class="settings-label">Buffer Size</span>
                        <select @change=${this._handleBufferSizeChange}>
                            ${[512, 1024, 2048, 4096, 8192].map(size => html`
                                <option value=${size} ?selected=${this.bufferSize === size}>
                                    ${size}
                                </option>
                            `)}
                        </select>
                    </div>
                ` : ''}

                ${this.currentTrack.title && this.inputSource === 'media_player' ? html`
                    <div class="track-info">
                        <div class="title">${this.currentTrack.title}</div>
                        ${this.currentTrack.artist ? html`
                            <div class="artist">${this.currentTrack.artist}</div>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }

    _initializeMediaPlayers() {
        if (this.hass) {
            this.mediaPlayers = Object.entries(this.hass.states)
                .filter(([entity_id]) => entity_id.startsWith('media_player.'))
                .map(([entity_id, state]) => ({
                    entity_id,
                    name: state.attributes.friendly_name || entity_id.split('.')[1]
                }));
        }
    }

    async _setupAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.gainNode = this.audioContext.createGain();
            this.gainNode.connect(this.audioContext.destination);

            if (this.inputSource === 'microphone') {
                await this._setupMicrophone();
            }
        } catch (error) {
            this._dispatchEvent('error', { message: 'Failed to initialize audio context' });
        }
    }

    async _setupMicrophone() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = this.audioContext.createMediaStreamSource(stream);
            source.connect(this.gainNode);
        } catch (error) {
            this._dispatchEvent('error', { message: 'Failed to access microphone' });
        }
    }

    _handlePlayerChange(e) {
        this.selectedPlayer = e.target.value;
        this._dispatchEvent('player-change', { player: this.selectedPlayer });
    }

    _handleSourceChange(e) {
        this.inputSource = e.target.value;
        this._dispatchEvent('source-change', { source: this.inputSource });

        if (this.inputSource === 'microphone') {
            this._setupMicrophone();
        }
    }

    _handlePlayPause() {
        this.isPlaying = !this.isPlaying;

        if (this.inputSource === 'media_player' && this.selectedPlayer) {
            this._dispatchEvent('media-command', {
                command: this.isPlaying ? 'play' : 'pause',
                player: this.selectedPlayer
            });
        } else if (this.inputSource === 'microphone') {
            if (this.isPlaying) {
                this.audioContext.resume();
            } else {
                this.audioContext.suspend();
            }
        }
    }

    _handlePrevious() {
        if (this.selectedPlayer) {
            this._dispatchEvent('media-command', {
                command: 'previous',
                player: this.selectedPlayer
            });
        }
    }

    _handleNext() {
        if (this.selectedPlayer) {
            this._dispatchEvent('media-command', {
                command: 'next',
                player: this.selectedPlayer
            });
        }
    }

    _handleVolumeChange(e) {
        this.volume = parseFloat(e.target.value);
        this.gainNode.gain.value = this.volume;
        this._dispatchEvent('volume-change', { volume: this.volume });
    }

    _handleGainChange(e) {
        this.microphoneGain = parseFloat(e.target.value);
        if (this.gainNode) {
            this.gainNode.gain.value = this.microphoneGain;
        }
        this._dispatchEvent('gain-change', { gain: this.microphoneGain });
    }

    _handleBufferSizeChange(e) {
        this.bufferSize = parseInt(e.target.value);
        this._dispatchEvent('buffer-size-change', { bufferSize: this.bufferSize });
    }

    _dispatchEvent(type, detail) {
        const event = new CustomEvent(`aurora-media-${type}`, {
            detail,
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(event);
    }

    // Update state from Home Assistant
    updated(changedProperties) {
        if (changedProperties.has('hass')) {
            this._initializeMediaPlayers();
            this._updatePlayerState();
        }
    }

    _updatePlayerState() {
        if (this.hass && this.selectedPlayer) {
            const state = this.hass.states[this.selectedPlayer];
            if (state) {
                this.isPlaying = state.state === 'playing';
                this.volume = state.attributes.volume_level || 1;
                this.currentTrack = {
                    title: state.attributes.media_title || '',
                    artist: state.attributes.media_artist || '',
                    album: state.attributes.media_album_name || '',
                    duration: state.attributes.media_duration || 0,
                    position: state.attributes.media_position || 0
                };
            }
        }
    }
}

customElements.define('aurora-media-controls', AuroraMediaControls); 