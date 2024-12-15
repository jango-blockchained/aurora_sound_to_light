import {
    LitElement,
    html,
    css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class AuroraEffectSelector extends LitElement {
    static get properties() {
        return {
            hass: { type: Object },
            narrow: { type: Boolean },
            _effects: { type: Array },
            _selectedEffect: { type: String },
            _config: { type: Object },
        };
    }

    static get styles() {
        return css`
            :host {
                display: block;
                padding: 16px;
                background: var(--card-background-color);
                border-radius: var(--ha-card-border-radius);
            }
            .effects {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 8px;
                margin-bottom: 16px;
            }
            .effect {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 16px;
                background: var(--primary-background-color);
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            .effect:hover {
                transform: translateY(-2px);
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            .effect.selected {
                border: 2px solid var(--primary-color);
            }
            .effect-icon {
                font-size: 24px;
                margin-bottom: 8px;
            }
            .effect-name {
                text-align: center;
                font-weight: 500;
            }
            .config-panel {
                background: var(--primary-background-color);
                border-radius: 8px;
                padding: 16px;
                margin-top: 16px;
            }
            .config-section {
                margin-bottom: 16px;
            }
            .config-title {
                font-weight: 500;
                margin-bottom: 8px;
            }
            .config-controls {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 8px;
            }
            .slider-container {
                display: flex;
                flex-direction: column;
            }
            .slider-label {
                display: flex;
                justify-content: space-between;
                margin-bottom: 4px;
            }
            ha-switch {
                margin: 8px 0;
            }
        `;
    }

    constructor() {
        super();
        this._effects = [
            {
                id: 'bass_pulse',
                name: 'Bass Pulse',
                icon: 'mdi:speaker',
                config: {
                    sensitivity: 50,
                    color_mode: 'gradient',
                    speed: 50,
                    intensity: 75,
                },
            },
            {
                id: 'frequency_sweep',
                name: 'Frequency Sweep',
                icon: 'mdi:waveform',
                config: {
                    range_low: 20,
                    range_high: 200,
                    speed: 50,
                    color_shift: true,
                },
            },
            {
                id: 'color_wave',
                name: 'Color Wave',
                icon: 'mdi:palette',
                config: {
                    colors: ['#ff0000', '#00ff00', '#0000ff'],
                    wave_speed: 50,
                    transition_mode: 'smooth',
                },
            },
            {
                id: 'strobe_sync',
                name: 'Strobe Sync',
                icon: 'mdi:lightning-bolt',
                config: {
                    sensitivity: 80,
                    color: '#ffffff',
                    min_bpm: 100,
                    max_bpm: 160,
                },
            },
            {
                id: 'rainbow_flow',
                name: 'Rainbow Flow',
                icon: 'mdi:rainbow',
                config: {
                    speed: 50,
                    saturation: 100,
                    brightness: 100,
                    direction: 'forward',
                },
            },
        ];
        this._selectedEffect = null;
        this._config = {};
    }

    render() {
        const selectedEffect = this._effects.find(e => e.id === this._selectedEffect);

        return html`
            <div class="effects">
                ${this._effects.map(effect => html`
                    <div class="effect ${effect.id === this._selectedEffect ? 'selected' : ''}"
                         @click=${() => this._selectEffect(effect.id)}>
                        <ha-icon class="effect-icon" icon="${effect.icon}"></ha-icon>
                        <span class="effect-name">${effect.name}</span>
                    </div>
                `)}
            </div>

            ${selectedEffect ? html`
                <div class="config-panel">
                    <div class="config-section">
                        <div class="config-title">${selectedEffect.name} Configuration</div>
                        <div class="config-controls">
                            ${this._renderEffectConfig(selectedEffect)}
                        </div>
                    </div>
                    <ha-button @click=${this._applyEffect} style="width: 100%;">
                        Apply Effect
                    </ha-button>
                </div>
            ` : ''}
        `;
    }

    _renderEffectConfig(effect) {
        const config = effect.config;
        return Object.entries(config).map(([key, value]) => {
            if (typeof value === 'number') {
                return this._renderSlider(key, value);
            } else if (typeof value === 'boolean') {
                return this._renderSwitch(key, value);
            } else if (Array.isArray(value) && value.every(item => /#[0-9a-f]{6}/.test(item))) {
                return this._renderColorPicker(key, value);
            } else if (typeof value === 'string' && /#[0-9a-f]{6}/.test(value)) {
                return this._renderColorPicker(key, [value]);
            }
            return '';
        });
    }

    _renderSlider(key, value) {
        const formattedKey = key.replace(/_/g, ' ');
        return html`
            <div class="slider-container">
                <div class="slider-label">
                    <span>${formattedKey}</span>
                    <span>${value}</span>
                </div>
                <ha-slider
                    min="0"
                    max="100"
                    .value=${value}
                    @change=${e => this._updateConfig(key, parseInt(e.target.value))}>
                </ha-slider>
            </div>
        `;
    }

    _renderSwitch(key, value) {
        const formattedKey = key.replace(/_/g, ' ');
        return html`
            <div class="switch-container">
                <ha-switch
                    .checked=${value}
                    @change=${e => this._updateConfig(key, e.target.checked)}>
                    ${formattedKey}
                </ha-switch>
            </div>
        `;
    }

    _renderColorPicker(key, values) {
        const formattedKey = key.replace(/_/g, ' ');
        return html`
            <div class="color-container">
                <span>${formattedKey}</span>
                ${values.map((color, index) => html`
                    <ha-color-picker
                        .value=${color}
                        @value-changed=${e => this._updateColor(key, index, e.detail.value)}>
                    </ha-color-picker>
                `)}
            </div>
        `;
    }

    _selectEffect(effectId) {
        this._selectedEffect = effectId;
        const effect = this._effects.find(e => e.id === effectId);
        if (effect) {
            this._config = {...effect.config};
        }
    }

    _updateConfig(key, value) {
        const effect = this._effects.find(e => e.id === this._selectedEffect);
        if (effect) {
            effect.config[key] = value;
            this.requestUpdate();
        }
    }

    _updateColor(key, index, value) {
        const effect = this._effects.find(e => e.id === this._selectedEffect);
        if (effect && Array.isArray(effect.config[key])) {
            effect.config[key][index] = value;
        } else if (effect) {
            effect.config[key] = value;
        }
        this.requestUpdate();
    }

    _applyEffect() {
        const effect = this._effects.find(e => e.id === this._selectedEffect);
        if (effect && this.hass) {
            this.hass.callService('aurora_sound_to_light', 'apply_effect', {
                effect_id: effect.id,
                config: effect.config,
            });
        }
    }
}

customElements.define("aurora-effect-selector", AuroraEffectSelector); 