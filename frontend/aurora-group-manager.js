import {
    LitElement,
    html,
    css,
} from "https://cdn.jsdelivr.net/gh/lit/dist@2/core/lit-core.min.js";

class AuroraGroupManager extends LitElement {
    static get properties() {
        return {
            hass: { type: Object },
            _groups: { type: Array, state: true },
            _availableLights: { type: Array, state: true },
            _selectedGroup: { type: Object, state: true },
            _loading: { type: Boolean, state: true },
            _editMode: { type: Boolean, state: true },
            _connectionError: { type: String, state: true },
            _connectionStatus: { type: String, state: true },
            _audioLevels: { type: Array, state: true },
            _audioSources: { type: Array, state: true }
        };
    }

    constructor() {
        super();
        this._groups = [];
        this._availableLights = [];
        this._selectedGroup = null;
        this._loading = false;
        this._editMode = false;
        this._connectionError = null;
        this._connectionStatus = 'disconnected';
        this._audioLevels = [];
        this._audioSources = [];
    }

    static get styles() {
        return css`
            :host {
                display: block;
                padding: 16px;
            }

            .group-container {
                display: grid;
                gap: 16px;
            }

            .group-list {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                gap: 8px;
            }

            .group-card {
                background: var(--card-background-color, #fff);
                border-radius: 8px;
                padding: 16px;
                cursor: pointer;
                border: 2px solid transparent;
                transition: all 0.3s ease;
            }

            .group-card:hover {
                transform: translateY(-2px);
                box-shadow: var(--shadow-elevation-2dp);
            }

            .group-card.selected {
                border-color: var(--primary-color);
                background: var(--primary-color-light);
            }

            .group-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }

            .group-name {
                font-weight: 500;
                font-size: 1.1em;
            }

            .group-info {
                font-size: 0.9em;
                color: var(--secondary-text-color);
            }

            .light-list {
                margin-top: 8px;
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
            }

            .light-chip {
                background: var(--primary-color-light);
                border-radius: 12px;
                padding: 2px 8px;
                font-size: 0.8em;
                display: flex;
                align-items: center;
                gap: 4px;
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

            .light-selector {
                max-height: 200px;
                overflow-y: auto;
                border: 1px solid var(--divider-color, #ccc);
                border-radius: 4px;
                padding: 8px;
            }

            .light-option {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 4px;
                cursor: pointer;
            }

            .light-option:hover {
                background: var(--primary-color-light);
                border-radius: 4px;
            }

            .actions {
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

            button.danger {
                background: var(--error-color);
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

            .audio-config {
                display: grid;
                gap: 16px;
                padding: 16px;
                background: var(--card-background-color);
                border-radius: 8px;
                border: 1px solid var(--divider-color);
            }

            .audio-source,
            .audio-sensitivity,
            .audio-thresholds,
            .frequency-ranges {
                display: grid;
                gap: 8px;
            }

            .threshold-inputs {
                display: flex;
                gap: 8px;
                align-items: center;
            }

            .threshold-inputs input {
                width: 80px;
            }

            .frequency-range {
                display: grid;
                grid-template-columns: 1fr 1fr auto;
                gap: 8px;
                align-items: center;
                padding: 8px;
                background: var(--primary-color-light);
                border-radius: 4px;
            }

            .frequency-range input[type="number"] {
                width: 100%;
            }

            .frequency-range input[type="color"] {
                width: 50px;
                height: 30px;
                padding: 0;
                border: none;
                border-radius: 4px;
            }

            .audio-visualization {
                margin-top: 16px;
            }

            .level-bars {
                display: flex;
                gap: 2px;
                height: 100px;
                align-items: flex-end;
                padding: 8px;
                background: var(--card-background-color);
                border: 1px solid var(--divider-color);
                border-radius: 4px;
            }

            .level-bar {
                flex: 1;
                background: var(--primary-color);
                min-width: 4px;
                transition: height 0.1s ease-out;
            }

            .audio-config label {
                font-weight: 500;
                color: var(--primary-text-color);
            }

            .audio-sensitivity input[type="range"] {
                width: 100%;
                height: 6px;
                -webkit-appearance: none;
                background: var(--primary-color-light);
                border-radius: 3px;
                outline: none;
            }

            .audio-sensitivity input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 16px;
                height: 16px;
                background: var(--primary-color);
                border-radius: 50%;
                cursor: pointer;
            }

            .audio-sensitivity input[type="range"]::-moz-range-thumb {
                width: 16px;
                height: 16px;
                background: var(--primary-color);
                border-radius: 50%;
                cursor: pointer;
                border: none;
            }
        `;
    }

    async firstUpdated() {
        if (this.hass) {
            try {
                await this._initializeConnection();
                await this._fetchGroups();
                await this._fetchAvailableLights();
            } catch (error) {
                console.error('Failed to initialize group manager:', error);
                this._connectionError = error.message;
                this._connectionStatus = 'error';
            }
        }
    }

    updated(changedProps) {
        if (changedProps.has('hass') && this.hass) {
            this._fetchGroups();
            this._fetchAvailableLights();
        }
    }

    async _fetchGroups() {
        try {
            const response = await this.hass.callWS({
                type: 'aurora_sound_to_light/get_groups'
            });
            this._groups = response.groups || [];
        } catch (error) {
            console.error('Failed to fetch groups:', error);
        }
    }

    async _fetchAvailableLights() {
        try {
            const lights = Object.entries(this.hass.states)
                .filter(([entity_id]) => entity_id.startsWith('light.'))
                .map(([entity_id, state]) => ({
                    entity_id,
                    name: state.attributes.friendly_name || entity_id.split('.')[1]
                }));
            this._availableLights = lights;
        } catch (error) {
            console.error('Failed to fetch available lights:', error);
        }
    }

    _handleGroupSelect(group) {
        this._selectedGroup = group;
        this._editMode = false;
    }

    _handleCreateGroup() {
        this._selectedGroup = {
            id: '',
            name: '',
            lights: [],
            config: {
                brightness: 100,
                transition: 1.0,
                color_mode: 'rgb',
                audio: {
                    source: '',
                    sensitivity: 50,
                    min_threshold: 10,
                    max_threshold: 90,
                    frequency_ranges: [
                        { min: 20, max: 200, color: '#ff0000' },
                        { min: 200, max: 2000, color: '#00ff00' },
                        { min: 2000, max: 20000, color: '#0000ff' }
                    ]
                }
            }
        };
        this._editMode = true;
    }

    async _handleSaveGroup() {
        if (!this._selectedGroup.name) {
            alert('Please enter a group name');
            return;
        }

        this._loading = true;
        try {
            await this.hass.callService('aurora_sound_to_light', 'save_group', {
                group: {
                    ...this._selectedGroup,
                    id: this._selectedGroup.id || `group_${Date.now()}`
                }
            });
            await this._fetchGroups();
            this._editMode = false;
        } catch (error) {
            console.error('Failed to save group:', error);
        } finally {
            this._loading = false;
        }
    }

    async _handleDeleteGroup() {
        if (!confirm(`Delete group "${this._selectedGroup.name}"?`)) return;

        this._loading = true;
        try {
            await this.hass.callService('aurora_sound_to_light', 'delete_group', {
                group_id: this._selectedGroup.id
            });
            await this._fetchGroups();
            this._selectedGroup = null;
        } catch (error) {
            console.error('Failed to delete group:', error);
        } finally {
            this._loading = false;
        }
    }

    _handleLightToggle(entityId) {
        const lights = this._selectedGroup.lights.includes(entityId)
            ? this._selectedGroup.lights.filter(id => id !== entityId)
            : [...this._selectedGroup.lights, entityId];

        this._selectedGroup = {
            ...this._selectedGroup,
            lights
        };
    }

    _handleConfigChange(key, value) {
        this._selectedGroup = {
            ...this._selectedGroup,
            config: {
                ...this._selectedGroup.config,
                [key]: value
            }
        };
    }

    _updateFrequencyRange(index, field, value) {
        const ranges = [...this._selectedGroup.config.audio.frequency_ranges];
        ranges[index] = {
            ...ranges[index],
            [field]: field === 'min' || field === 'max' ? parseInt(value) : value
        };

        this._handleConfigChange('audio', {
            ...this._selectedGroup.config.audio,
            frequency_ranges: ranges
        });
    }

    async _initializeConnection() {
        try {
            await this.hass.callWS({
                type: 'aurora_sound_to_light/ping'
            });
            const response = await this.hass.callWS({
                type: 'aurora_sound_to_light/get_audio_sources'
            });
            this._audioSources = response.sources || [];
            this._connectionStatus = 'connected';
            this._connectionError = null;

            this._startAudioLevelUpdates();
        } catch (error) {
            this._connectionStatus = 'error';
            this._connectionError = 'Failed to connect to Aurora service';
            throw error;
        }
    }

    async _startAudioLevelUpdates() {
        this.hass.connection.subscribeMessage(
            (message) => {
                this._audioLevels = message.levels;
            },
            { type: 'aurora_sound_to_light/audio_levels' }
        );
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
            <div class="group-container ${this._loading ? 'loading' : ''}">
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
                <div class="group-list">
                    ${this._groups.map(group => html`
                        <div class="group-card ${this._selectedGroup?.id === group.id ? 'selected' : ''}"
                             @click=${() => this._handleGroupSelect(group)}>
                            <div class="group-header">
                                <div class="group-name">${group.name}</div>
                                <span class="material-symbols-rounded">
                                    ${this._selectedGroup?.id === group.id ? 'check_circle' : 'lightbulb'}
                                </span>
                            </div>
                            <div class="group-info">
                                ${group.lights.length} light${group.lights.length !== 1 ? 's' : ''}
                            </div>
                            <div class="light-list">
                                ${group.lights.slice(0, 3).map(light => html`
                                    <div class="light-chip">
                                        <span class="material-symbols-rounded">lightbulb</span>
                                        ${this._availableLights.find(l => l.entity_id === light)?.name || light}
                                    </div>
                                `)}
                                ${group.lights.length > 3 ? html`
                                    <div class="light-chip">+${group.lights.length - 3} more</div>
                                ` : ''}
                            </div>
                        </div>
                    `)}
                    <div class="group-card" @click=${this._handleCreateGroup}>
                        <div class="group-header">
                            <div class="group-name">Create New Group</div>
                            <span class="material-symbols-rounded">add_circle</span>
                        </div>
                    </div>
                </div>

                ${this._selectedGroup ? html`
                    <div class="config-panel">
                        <div class="config-title">
                            <span>${this._editMode ? 'Edit Group' : this._selectedGroup.name}</span>
                            <div class="actions">
                                ${!this._editMode ? html`
                                    <button @click=${() => this._editMode = true}>
                                        <span class="material-symbols-rounded">edit</span>
                                        Edit
                                    </button>
                                ` : html`
                                    <button @click=${this._handleSaveGroup}>
                                        <span class="material-symbols-rounded">save</span>
                                        Save
                                    </button>
                                `}
                                ${this._selectedGroup.id ? html`
                                    <button class="danger" @click=${this._handleDeleteGroup}>
                                        <span class="material-symbols-rounded">delete</span>
                                        Delete
                                    </button>
                                ` : ''}
                            </div>
                        </div>

                        ${this._editMode ? html`
                            <div class="config-grid">
                                <div class="config-item">
                                    <label>Group Name</label>
                                    <input type="text"
                                        .value=${this._selectedGroup.name}
                                        @input=${e => this._selectedGroup = {
                        ...this._selectedGroup,
                        name: e.target.value
                    }}
                                    />
                                </div>

                                <div class="config-item">
                                    <label>Lights</label>
                                    <div class="light-selector">
                                        ${this._availableLights.map(light => html`
                                            <div class="light-option"
                                                 @click=${() => this._handleLightToggle(light.entity_id)}>
                                                <input type="checkbox"
                                                    .checked=${this._selectedGroup.lights.includes(light.entity_id)}
                                                />
                                                ${light.name}
                                            </div>
                                        `)}
                                    </div>
                                </div>

                                <div class="config-item">
                                    <label>Default Brightness</label>
                                    <input type="range"
                                        min="0"
                                        max="100"
                                        .value=${this._selectedGroup.config.brightness}
                                        @input=${e => this._handleConfigChange('brightness', parseInt(e.target.value))}
                                    />
                                </div>

                                <div class="config-item">
                                    <label>Transition Time (seconds)</label>
                                    <input type="number"
                                        min="0"
                                        max="10"
                                        step="0.1"
                                        .value=${this._selectedGroup.config.transition}
                                        @input=${e => this._handleConfigChange('transition', parseFloat(e.target.value))}
                                    />
                                </div>

                                <div class="config-item">
                                    <label>Color Mode</label>
                                    <select
                                        .value=${this._selectedGroup.config.color_mode}
                                        @change=${e => this._handleConfigChange('color_mode', e.target.value)}
                                    >
                                        <option value="rgb">RGB</option>
                                        <option value="hsv">HSV</option>
                                        <option value="xy">XY</option>
                                    </select>
                                </div>

                                <div class="config-item">
                                    <label>Audio Configuration</label>
                                    <div class="audio-config">
                                        <div class="audio-source">
                                            <label>Audio Source</label>
                                            <select
                                                .value=${this._selectedGroup.config.audio?.source || ''}
                                                @change=${e => this._handleConfigChange('audio', {
                        ...this._selectedGroup.config.audio,
                        source: e.target.value
                    })}
                                            >
                                                <option value="">Select Source</option>
                                                ${this._audioSources.map(source => html`
                                                    <option value=${source.id}>${source.name}</option>
                                                `)}
                                            </select>
                                        </div>

                                        <div class="audio-sensitivity">
                                            <label>Sensitivity (${this._selectedGroup.config.audio?.sensitivity || 50}%)</label>
                                            <input type="range"
                                                min="0"
                                                max="100"
                                                .value=${this._selectedGroup.config.audio?.sensitivity || 50}
                                                @input=${e => this._handleConfigChange('audio', {
                        ...this._selectedGroup.config.audio,
                        sensitivity: parseInt(e.target.value)
                    })}
                                            />
                                        </div>

                                        <div class="audio-thresholds">
                                            <label>Threshold Range</label>
                                            <div class="threshold-inputs">
                                                <input type="number"
                                                    min="0"
                                                    max="100"
                                                    .value=${this._selectedGroup.config.audio?.min_threshold || 10}
                                                    @input=${e => this._handleConfigChange('audio', {
                        ...this._selectedGroup.config.audio,
                        min_threshold: parseInt(e.target.value)
                    })}
                                                /> -
                                                <input type="number"
                                                    min="0"
                                                    max="100"
                                                    .value=${this._selectedGroup.config.audio?.max_threshold || 90}
                                                    @input=${e => this._handleConfigChange('audio', {
                        ...this._selectedGroup.config.audio,
                        max_threshold: parseInt(e.target.value)
                    })}
                                                />
                                            </div>
                                        </div>

                                        <div class="frequency-ranges">
                                            <label>Frequency Ranges</label>
                                            ${this._selectedGroup.config.audio?.frequency_ranges?.map((range, index) => html`
                                                <div class="frequency-range">
                                                    <input type="number"
                                                        placeholder="Min Hz"
                                                        .value=${range.min}
                                                        @input=${e => this._updateFrequencyRange(index, 'min', e.target.value)}
                                                    />
                                                    <input type="number"
                                                        placeholder="Max Hz"
                                                        .value=${range.max}
                                                        @input=${e => this._updateFrequencyRange(index, 'max', e.target.value)}
                                                    />
                                                    <input type="color"
                                                        .value=${range.color}
                                                        @input=${e => this._updateFrequencyRange(index, 'color', e.target.value)}
                                                    />
                                                </div>
                                            `)}
                                        </div>

                                        ${this._audioLevels.length > 0 ? html`
                                            <div class="audio-visualization">
                                                <label>Current Audio Levels</label>
                                                <div class="level-bars">
                                                    ${this._audioLevels.map(level => html`
                                                        <div class="level-bar" style="height: ${level}%"></div>
                                                    `)}
                                                </div>
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            </div>
                        ` : html`
                            <div class="light-list">
                                ${this._selectedGroup.lights.map(light => html`
                                    <div class="light-chip">
                                        <span class="material-symbols-rounded">lightbulb</span>
                                        ${this._availableLights.find(l => l.entity_id === light)?.name || light}
                                    </div>
                                `)}
                            </div>
                        `}
                    </div>
                ` : ''}
            </div>
        `;
    }
}

customElements.define('aurora-group-manager', AuroraGroupManager); 