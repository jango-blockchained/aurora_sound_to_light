import {
    LitElement,
    html,
    css,
} from "https://cdn.jsdelivr.net/gh/lit/dist@2/core/lit-core.min.js";

class AuroraEffectSelector extends LitElement {
    static get properties() {
        return {
            hass: { type: Object },
            _effects: { type: Array, state: true },
            _selectedEffect: { type: Object, state: true },
            _presets: { type: Array, state: true },
            _loading: { type: Boolean, state: true },
            _editingPreset: { type: Boolean, state: true },
            _connectionError: { type: String, state: true },
            _connectionStatus: { type: String, state: true }
        };
    }

    constructor() {
        super();
        this._effects = [];
        this._selectedEffect = null;
        this._presets = [];
        this._loading = false;
        this._editingPreset = false;
        this._connectionError = null;
        this._connectionStatus = 'disconnected';
    }

    static get styles() {
        return css`
            :host {
                display: block;
                padding: 16px;
            }

            .effect-container {
                display: grid;
                gap: 16px;
            }

            .effect-list {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 8px;
            }

            .effect-card {
                background: var(--card-background-color, #fff);
                border-radius: 8px;
                padding: 16px;
                cursor: pointer;
                border: 2px solid transparent;
                transition: all 0.3s ease;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
            }

            .effect-card:hover {
                transform: translateY(-2px);
                box-shadow: var(--shadow-elevation-2dp);
            }

            .effect-card.selected {
                border-color: var(--primary-color);
                background: var(--primary-color-light);
            }

            .effect-icon {
                font-size: 24px;
                color: var(--primary-color);
            }

            .effect-name {
                font-weight: 500;
                text-align: center;
            }

            .config-panel {
                background: var(--card-background-color, #fff);
                border-radius: 8px;
                padding: 16px;
                margin-top: 16px;
            }

            .config-title {
                font-size: 1.1em;
                font-weight: 500;
                margin-bottom: 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .config-grid {
                display: grid;
                gap: 16px;
            }

            .config-item {
                display: grid;
                gap: 8px;
            }

            label {
                font-size: 0.9em;
                color: var(--secondary-text-color);
            }

            input, select {
                width: 100%;
                padding: 8px;
                border-radius: 4px;
                border: 1px solid var(--divider-color, #ccc);
                background: var(--card-background-color, #fff);
            }

            input[type="range"] {
                -webkit-appearance: none;
                height: 4px;
                border-radius: 2px;
                background: var(--primary-color-light);
            }

            input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: var(--primary-color);
                cursor: pointer;
            }

            .preset-section {
                margin-top: 16px;
            }

            .preset-list {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }

            .preset-chip {
                background: var(--primary-color-light);
                border-radius: 16px;
                padding: 4px 12px;
                font-size: 0.9em;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .preset-chip:hover {
                background: var(--primary-color);
                color: white;
            }

            .preset-actions {
                display: flex;
                gap: 8px;
                margin-top: 8px;
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
                gap: 4px;
                transition: background-color 0.3s ease;
            }

            button:hover {
                background: var(--primary-color-light);
            }

            button.secondary {
                background: var(--secondary-color);
            }

            .loading {
                opacity: 0.7;
                pointer-events: none;
            }

            .material-symbols-rounded {
                font-size: 20px;
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
        `;
    }

    async firstUpdated() {
        if (this.hass) {
            try {
                await this._initializeConnection();
                await this._fetchEffects();
                await this._fetchPresets();
            } catch (error) {
                console.error('Failed to initialize effect selector:', error);
                this._connectionError = error.message;
                this._connectionStatus = 'error';
            }
        }
    }

    updated(changedProps) {
        if (changedProps.has('hass') && this.hass) {
            this._fetchEffects();
            this._fetchPresets();
        }
    }

    async _fetchEffects() {
        try {
            const response = await this.hass.callWS({
                type: 'aurora_sound_to_light/get_effects'
            });
            this._effects = response.effects || [];
        } catch (error) {
            console.error('Failed to fetch effects:', error);
        }
    }

    async _fetchPresets() {
        try {
            const response = await this.hass.callWS({
                type: 'aurora_sound_to_light/get_presets'
            });
            this._presets = response.presets || [];
        } catch (error) {
            console.error('Failed to fetch presets:', error);
        }
    }

    async _handleEffectSelect(effect) {
        this._loading = true;
        try {
            await this.hass.callService('aurora_sound_to_light', 'set_effect', {
                effect: effect.id,
                config: effect.config
            });
            this._selectedEffect = effect;
        } catch (error) {
            console.error('Failed to set effect:', error);
        } finally {
            this._loading = false;
        }
    }

    async _handleConfigChange(e, key) {
        if (!this._selectedEffect) return;

        const value = e.target.type === 'range' ? parseFloat(e.target.value) : e.target.value;
        const newConfig = {
            ...this._selectedEffect.config,
            [key]: value
        };

        try {
            await this.hass.callService('aurora_sound_to_light', 'update_effect_config', {
                effect: this._selectedEffect.id,
                config: newConfig
            });
            this._selectedEffect = {
                ...this._selectedEffect,
                config: newConfig
            };
        } catch (error) {
            console.error('Failed to update effect config:', error);
        }
    }

    async _handlePresetSelect(preset) {
        this._loading = true;
        try {
            await this.hass.callService('aurora_sound_to_light', 'load_preset', {
                preset: preset.id
            });
            this._selectedEffect = preset.effect;
        } catch (error) {
            console.error('Failed to load preset:', error);
        } finally {
            this._loading = false;
        }
    }

    async _handleSavePreset() {
        if (!this._selectedEffect) return;

        const name = prompt('Enter preset name:');
        if (!name) return;

        try {
            await this.hass.callService('aurora_sound_to_light', 'save_preset', {
                name,
                effect: this._selectedEffect.id,
                config: this._selectedEffect.config
            });
            await this._fetchPresets();
        } catch (error) {
            console.error('Failed to save preset:', error);
        }
    }

    async _handleDeletePreset(preset) {
        if (!confirm(`Delete preset "${preset.name}"?`)) return;

        try {
            await this.hass.callService('aurora_sound_to_light', 'delete_preset', {
                preset: preset.id
            });
            await this._fetchPresets();
        } catch (error) {
            console.error('Failed to delete preset:', error);
        }
    }

    async _initializeConnection() {
        try {
            await this.hass.callWS({
                type: 'aurora_sound_to_light/ping'
            });
            this._connectionStatus = 'connected';
            this._connectionError = null;
        } catch (error) {
            this._connectionStatus = 'error';
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
            <div class="effect-container ${this._loading ? 'loading' : ''}">
                ${this._connectionStatus === 'connected' ? html`
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
                <div class="effect-list">
                    ${this._effects.map(effect => html`
                        <div class="effect-card ${this._selectedEffect?.id === effect.id ? 'selected' : ''}"
                             @click=${() => this._handleEffectSelect(effect)}>
                            <span class="material-symbols-rounded effect-icon">
                                ${effect.icon || 'auto_fix'}
                            </span>
                            <span class="effect-name">${effect.name}</span>
                        </div>
                    `)}
                </div>

                ${this._selectedEffect ? html`
                    <div class="config-panel">
                        <div class="config-title">
                            <span>${this._selectedEffect.name} Configuration</span>
                            <button @click=${this._handleSavePreset}>
                                <span class="material-symbols-rounded">save</span>
                                Save as Preset
                            </button>
                        </div>
                        <div class="config-grid">
                            ${Object.entries(this._selectedEffect.config).map(([key, value]) => html`
                                <div class="config-item">
                                    <label>${key}</label>
                                    ${typeof value === 'number' ? html`
                                        <input type="range"
                                            min="0"
                                            max="100"
                                            step="1"
                                            .value=${value}
                                            @input=${(e) => this._handleConfigChange(e, key)}
                                        />
                                    ` : html`
                                        <input type="text"
                                            .value=${value}
                                            @change=${(e) => this._handleConfigChange(e, key)}
                                        />
                                    `}
                                </div>
                            `)}
                        </div>
                    </div>
                ` : ''}

                <div class="preset-section">
                    <div class="config-title">
                        <span>Presets</span>
                    </div>
                    <div class="preset-list">
                        ${this._presets.map(preset => html`
                            <div class="preset-chip" @click=${() => this._handlePresetSelect(preset)}>
                                <span class="material-symbols-rounded">bookmark</span>
                                ${preset.name}
                                <span class="material-symbols-rounded"
                                      @click=${(e) => {
                e.stopPropagation();
                this._handleDeletePreset(preset);
            }}>
                                    close
                                </span>
                            </div>
                        `)}
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('aurora-effect-selector', AuroraEffectSelector); 