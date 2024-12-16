import {
    LitElement,
    html,
    css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class AuroraEffectSelector extends LitElement {
    static get properties() {
        return {
            hass: { type: Object },
            effects: { type: Array },
            selectedEffect: { type: Object },
            presets: { type: Array },
            blendMode: { type: String },
            transitionTime: { type: Number },
            isPreviewActive: { type: Boolean },
            genreMode: { type: Boolean },
            currentGenre: { type: String }
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

            .effect-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px;
                margin-bottom: 16px;
            }

            .effect-card {
                position: relative;
                padding: 16px;
                background: var(--primary-background-color, #f5f5f5);
                border-radius: 8px;
                cursor: pointer;
                transition: transform 0.2s ease, box-shadow 0.2s ease;
            }

            .effect-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            }

            .effect-card.selected {
                border: 2px solid var(--primary-color);
            }

            .effect-card .preview {
                width: 100%;
                height: 100px;
                border-radius: 4px;
                margin-bottom: 8px;
                background: linear-gradient(45deg, var(--primary-color), var(--accent-color));
            }

            .effect-name {
                font-weight: 500;
                margin-bottom: 4px;
            }

            .effect-description {
                font-size: 0.9em;
                color: var(--secondary-text-color);
            }

            .parameters-panel {
                background: var(--primary-background-color, #f5f5f5);
                border-radius: 8px;
                padding: 16px;
                margin-top: 16px;
            }

            .parameter-row {
                display: flex;
                align-items: center;
                margin-bottom: 12px;
            }

            .parameter-label {
                flex: 0 0 150px;
                font-weight: 500;
            }

            .parameter-control {
                flex: 1;
            }

            input[type="range"] {
                width: 100%;
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

            .controls {
                display: flex;
                gap: 8px;
                margin-top: 16px;
            }

            button {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                background: var(--primary-color);
                color: white;
                cursor: pointer;
                transition: background 0.2s ease;
            }

            button:hover {
                background: var(--primary-color-light);
            }

            button.secondary {
                background: var(--secondary-color);
            }

            .blend-controls {
                display: flex;
                align-items: center;
                gap: 16px;
                margin-top: 16px;
                padding: 16px;
                background: var(--primary-background-color, #f5f5f5);
                border-radius: 8px;
            }

            .genre-mode {
                margin-top: 16px;
                padding: 16px;
                background: var(--primary-background-color, #f5f5f5);
                border-radius: 8px;
            }

            .preset-controls {
                margin-top: 16px;
            }

            .preset-list {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 8px;
            }

            .preset-item {
                padding: 4px 12px;
                border-radius: 16px;
                background: var(--primary-color);
                color: white;
                font-size: 0.9em;
                cursor: pointer;
            }

            .error-message {
                color: var(--error-color);
                font-size: 0.9em;
                margin-top: 8px;
            }
        `;
    }

    constructor() {
        super();
        this.effects = [];
        this.selectedEffect = null;
        this.presets = [];
        this.blendMode = 'mix';
        this.transitionTime = 1.0;
        this.isPreviewActive = false;
        this.genreMode = false;
        this.currentGenre = '';

        // Internal properties
        this._previewTimer = null;
        this._originalParameters = null;
    }

    firstUpdated() {
        this._loadEffects();
        this._loadPresets();
    }

    render() {
        return html`
            <div class="effect-selector">
                <div class="effect-grid">
                    ${this.effects.map(effect => this._renderEffectCard(effect))}
                </div>

                ${this.selectedEffect ? html`
                    <div class="parameters-panel">
                        <h3>Effect Parameters</h3>
                        ${this._renderParameters()}
                        
                        <div class="controls">
                            <button @click=${this._handlePreview}>
                                ${this.isPreviewActive ? 'Stop Preview' : 'Preview'}
                            </button>
                            <button @click=${this._handleApply}>
                                Apply
                            </button>
                            <button class="secondary" @click=${this._handleSavePreset}>
                                Save Preset
                            </button>
                        </div>
                    </div>

                    <div class="blend-controls">
                        <div class="parameter-row">
                            <div class="parameter-label">Blend Mode</div>
                            <select 
                                class="parameter-control"
                                .value=${this.blendMode}
                                @change=${this._handleBlendModeChange}
                            >
                                <option value="mix">Mix</option>
                                <option value="add">Add</option>
                                <option value="subtract">Subtract</option>
                                <option value="multiply">Multiply</option>
                            </select>
                        </div>

                        <div class="parameter-row">
                            <div class="parameter-label">Transition Time</div>
                            <input 
                                type="range"
                                min="0"
                                max="5"
                                step="0.1"
                                .value=${this.transitionTime}
                                @input=${this._handleTransitionTimeChange}
                            >
                            <span>${this.transitionTime}s</span>
                        </div>
                    </div>
                ` : ''}

                <div class="genre-mode">
                    <div class="parameter-row">
                        <div class="parameter-label">Genre-based Mode</div>
                        <input 
                            type="checkbox"
                            .checked=${this.genreMode}
                            @change=${this._handleGenreModeChange}
                        >
                    </div>
                    ${this.genreMode ? html`
                        <div class="parameter-row">
                            <div class="parameter-label">Current Genre</div>
                            <select 
                                class="parameter-control"
                                .value=${this.currentGenre}
                                @change=${this._handleGenreChange}
                            >
                                <option value="">Auto Detect</option>
                                <option value="rock">Rock</option>
                                <option value="electronic">Electronic</option>
                                <option value="classical">Classical</option>
                                <option value="jazz">Jazz</option>
                                <option value="pop">Pop</option>
                            </select>
                        </div>
                    ` : ''}
                </div>

                <div class="preset-controls">
                    <h3>Presets</h3>
                    <div class="preset-list">
                        ${this.presets.map(preset => html`
                            <div 
                                class="preset-item"
                                @click=${() => this._loadPreset(preset)}
                            >
                                ${preset.name}
                            </div>
                        `)}
                    </div>
                </div>
            </div>
        `;
    }

    _renderEffectCard(effect) {
        const isSelected = this.selectedEffect && this.selectedEffect.id === effect.id;
        return html`
            <div 
                class="effect-card ${isSelected ? 'selected' : ''}"
                @click=${() => this._selectEffect(effect)}
            >
                <div class="preview" style=${this._generatePreviewStyle(effect)}></div>
                <div class="effect-name">${effect.name}</div>
                <div class="effect-description">${effect.description}</div>
            </div>
        `;
    }

    _renderParameters() {
        if (!this.selectedEffect) return '';

        return html`
            ${Object.entries(this.selectedEffect.parameters).map(([key, param]) => html`
                <div class="parameter-row">
                    <div class="parameter-label">${param.name}</div>
                    <div class="parameter-control">
                        ${this._renderParameterControl(key, param)}
                    </div>
                </div>
            `)}
        `;
    }

    _renderParameterControl(key, param) {
        switch (param.type) {
            case 'range':
                return html`
                    <input 
                        type="range"
                        min=${param.min}
                        max=${param.max}
                        step=${param.step || 1}
                        .value=${param.value}
                        @input=${(e) => this._updateParameter(key, e.target.value)}
                    >
                    <span>${param.value}${param.unit || ''}</span>
                `;
            case 'color':
                return html`
                    <input 
                        type="color"
                        .value=${param.value}
                        @input=${(e) => this._updateParameter(key, e.target.value)}
                    >
                `;
            case 'select':
                return html`
                    <select 
                        .value=${param.value}
                        @change=${(e) => this._updateParameter(key, e.target.value)}
                    >
                        ${param.options.map(opt => html`
                            <option value=${opt.value}>${opt.label}</option>
                        `)}
                    </select>
                `;
            default:
                return html`
                    <input 
                        type="text"
                        .value=${param.value}
                        @input=${(e) => this._updateParameter(key, e.target.value)}
                    >
                `;
        }
    }

    _generatePreviewStyle(effect) {
        // Generate CSS gradient or animation based on effect type
        return `background: linear-gradient(45deg, ${effect.colors.join(', ')});`;
    }

    async _loadEffects() {
        try {
            const response = await this.hass.callWS({
                type: 'aurora_sound_to_light/get_effects'
            });
            this.effects = response.effects.map(effect => ({
                ...effect,
                parameters: this._initializeParameters(effect.parameters)
            }));
        } catch (error) {
            console.error('Failed to load effects:', error);
        }
    }

    _initializeParameters(parameters) {
        const initialized = {};
        for (const [key, param] of Object.entries(parameters)) {
            initialized[key] = {
                ...param,
                value: param.default
            };
        }
        return initialized;
    }

    async _loadPresets() {
        try {
            const response = await this.hass.callWS({
                type: 'aurora_sound_to_light/get_presets'
            });
            this.presets = response.presets;
        } catch (error) {
            console.error('Failed to load presets:', error);
        }
    }

    _selectEffect(effect) {
        this.selectedEffect = effect;
        this._originalParameters = JSON.parse(JSON.stringify(effect.parameters));
        this._dispatchEffectChange();
    }

    _updateParameter(key, value) {
        if (!this.selectedEffect) return;

        this.selectedEffect = {
            ...this.selectedEffect,
            parameters: {
                ...this.selectedEffect.parameters,
                [key]: {
                    ...this.selectedEffect.parameters[key],
                    value
                }
            }
        };

        if (this.isPreviewActive) {
            this._updatePreview();
        }
    }

    _handleBlendModeChange(e) {
        this.blendMode = e.target.value;
        this._dispatchEffectChange();
    }

    _handleTransitionTimeChange(e) {
        this.transitionTime = parseFloat(e.target.value);
        this._dispatchEffectChange();
    }

    _handleGenreModeChange(e) {
        this.genreMode = e.target.checked;
        this._dispatchEffectChange();
    }

    _handleGenreChange(e) {
        this.currentGenre = e.target.value;
        this._dispatchEffectChange();
    }

    _handlePreview() {
        this.isPreviewActive = !this.isPreviewActive;
        if (this.isPreviewActive) {
            this._startPreview();
        } else {
            this._stopPreview();
        }
    }

    async _handleApply() {
        try {
            await this.hass.callWS({
                type: 'aurora_sound_to_light/apply_effect',
                effect_id: this.selectedEffect.id,
                parameters: this._getParameterValues(),
                blend_mode: this.blendMode,
                transition_time: this.transitionTime
            });
        } catch (error) {
            console.error('Failed to apply effect:', error);
        }
    }

    async _handleSavePreset() {
        const name = prompt('Enter preset name:');
        if (!name) return;

        try {
            await this.hass.callWS({
                type: 'aurora_sound_to_light/save_preset',
                name,
                effect_id: this.selectedEffect.id,
                parameters: this._getParameterValues(),
                blend_mode: this.blendMode,
                transition_time: this.transitionTime
            });
            await this._loadPresets();
        } catch (error) {
            console.error('Failed to save preset:', error);
        }
    }

    async _loadPreset(preset) {
        try {
            const effect = this.effects.find(e => e.id === preset.effect_id);
            if (!effect) return;

            this.selectedEffect = {
                ...effect,
                parameters: this._applyPresetParameters(effect.parameters, preset.parameters)
            };
            this.blendMode = preset.blend_mode;
            this.transitionTime = preset.transition_time;

            this._dispatchEffectChange();
        } catch (error) {
            console.error('Failed to load preset:', error);
        }
    }

    _applyPresetParameters(baseParameters, presetParameters) {
        const applied = {};
        for (const [key, param] of Object.entries(baseParameters)) {
            applied[key] = {
                ...param,
                value: presetParameters[key] || param.default
            };
        }
        return applied;
    }

    _getParameterValues() {
        const values = {};
        for (const [key, param] of Object.entries(this.selectedEffect.parameters)) {
            values[key] = param.value;
        }
        return values;
    }

    _startPreview() {
        this._updatePreview();
        this._previewTimer = setInterval(() => this._updatePreview(), 1000);
    }

    _stopPreview() {
        if (this._previewTimer) {
            clearInterval(this._previewTimer);
            this._previewTimer = null;
        }
        // Restore original parameters
        if (this._originalParameters) {
            this.selectedEffect = {
                ...this.selectedEffect,
                parameters: JSON.parse(JSON.stringify(this._originalParameters))
            };
        }
    }

    async _updatePreview() {
        try {
            await this.hass.callWS({
                type: 'aurora_sound_to_light/preview_effect',
                effect_id: this.selectedEffect.id,
                parameters: this._getParameterValues()
            });
        } catch (error) {
            console.error('Failed to update preview:', error);
        }
    }

    _dispatchEffectChange() {
        const event = new CustomEvent('aurora-effect-change', {
            detail: {
                effect: this.selectedEffect,
                parameters: this._getParameterValues(),
                blendMode: this.blendMode,
                transitionTime: this.transitionTime,
                genreMode: this.genreMode,
                currentGenre: this.currentGenre
            },
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(event);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._stopPreview();
    }
}

customElements.define('aurora-effect-selector', AuroraEffectSelector); 