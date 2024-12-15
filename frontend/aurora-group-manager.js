import {
    LitElement,
    html,
    css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class AuroraGroupManager extends LitElement {
    static get properties() {
        return {
            hass: { type: Object },
            narrow: { type: Boolean },
            _groups: { type: Array },
            _lights: { type: Array },
            _selectedGroup: { type: String },
            _editMode: { type: Boolean },
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
            .groups {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .group {
                display: flex;
                align-items: center;
                padding: 8px;
                background: var(--primary-background-color);
                border-radius: 4px;
                cursor: pointer;
            }
            .group.selected {
                border: 2px solid var(--primary-color);
            }
            .group-name {
                flex-grow: 1;
                margin: 0 8px;
            }
            .lights {
                margin-top: 16px;
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }
            .light {
                padding: 8px;
                background: var(--primary-background-color);
                border-radius: 4px;
                cursor: pointer;
                display: flex;
                align-items: center;
            }
            .light.selected {
                border: 2px solid var(--primary-color);
            }
            .light-name {
                margin: 0 8px;
            }
            .actions {
                display: flex;
                gap: 8px;
                margin-top: 16px;
            }
            ha-button {
                flex: 1;
            }
            .edit-group {
                margin-top: 16px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .edit-group ha-textfield {
                width: 100%;
            }
        `;
    }

    constructor() {
        super();
        this._groups = [];
        this._lights = [];
        this._selectedGroup = null;
        this._editMode = false;
    }

    firstUpdated() {
        this._fetchGroups();
        this._fetchLights();
    }

    render() {
        return html`
            <div class="groups">
                ${this._groups.map(group => html`
                    <div class="group ${group.id === this._selectedGroup ? 'selected' : ''}"
                         @click=${() => this._selectGroup(group.id)}>
                        <ha-icon icon="mdi:lightbulb-group"></ha-icon>
                        <span class="group-name">${group.name}</span>
                        <ha-icon-button
                            .path=${group.enabled ? "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" : "M20,4C21.1,4 22,4.9 22,6V18C22,19.1 21.1,20 20,20H4C2.9,20 2,19.1 2,18V6C2,4.9 2.9,4 4,4H20M20,18V6H4V18H20Z"}
                            @click=${(e) => this._toggleGroup(e, group.id)}>
                        </ha-icon-button>
                    </div>
                `)}
            </div>

            <div class="actions">
                <ha-button @click=${this._addGroup}>
                    <ha-icon icon="mdi:plus"></ha-icon>
                    Add Group
                </ha-button>
                ${this._selectedGroup ? html`
                    <ha-button @click=${this._editGroup}>
                        <ha-icon icon="mdi:pencil"></ha-icon>
                        Edit Group
                    </ha-button>
                    <ha-button @click=${this._deleteGroup}>
                        <ha-icon icon="mdi:delete"></ha-icon>
                        Delete Group
                    </ha-button>
                ` : ''}
            </div>

            ${this._editMode ? html`
                <div class="edit-group">
                    <ha-textfield
                        label="Group Name"
                        .value=${this._getSelectedGroup()?.name || ''}
                        @change=${this._updateGroupName}>
                    </ha-textfield>
                    <div class="lights">
                        ${this._lights.map(light => html`
                            <div class="light ${this._isLightInSelectedGroup(light.entity_id) ? 'selected' : ''}"
                                 @click=${() => this._toggleLight(light.entity_id)}>
                                <ha-icon icon="mdi:lightbulb"></ha-icon>
                                <span class="light-name">${light.name}</span>
                            </div>
                        `)}
                    </div>
                    <ha-button @click=${this._saveGroup}>
                        Save Group
                    </ha-button>
                </div>
            ` : ''}
        `;
    }

    _fetchGroups() {
        // TODO: Fetch groups from HA
        this._groups = [
            { id: '1', name: 'Living Room', enabled: true, lights: ['light.living_room_1', 'light.living_room_2'] },
            { id: '2', name: 'Kitchen', enabled: false, lights: ['light.kitchen_1', 'light.kitchen_2'] },
        ];
    }

    _fetchLights() {
        if (this.hass) {
            this._lights = Object.keys(this.hass.states)
                .filter(entityId => entityId.startsWith('light.'))
                .map(entityId => ({
                    entity_id: entityId,
                    name: this.hass.states[entityId].attributes.friendly_name || entityId,
                }));
        }
    }

    _selectGroup(groupId) {
        this._selectedGroup = groupId;
        this._editMode = false;
    }

    _toggleGroup(e, groupId) {
        e.stopPropagation();
        const group = this._groups.find(g => g.id === groupId);
        if (group) {
            group.enabled = !group.enabled;
            this.requestUpdate();
            // TODO: Call service to toggle group
        }
    }

    _getSelectedGroup() {
        return this._groups.find(g => g.id === this._selectedGroup);
    }

    _isLightInSelectedGroup(entityId) {
        const group = this._getSelectedGroup();
        return group ? group.lights.includes(entityId) : false;
    }

    _addGroup() {
        // TODO: Add new group
        this._editMode = true;
        this._selectedGroup = null;
    }

    _editGroup() {
        this._editMode = true;
    }

    _deleteGroup() {
        // TODO: Delete group
        this._groups = this._groups.filter(g => g.id !== this._selectedGroup);
        this._selectedGroup = null;
    }

    _updateGroupName(e) {
        const group = this._getSelectedGroup();
        if (group) {
            group.name = e.target.value;
            this.requestUpdate();
        }
    }

    _toggleLight(entityId) {
        const group = this._getSelectedGroup();
        if (group) {
            const index = group.lights.indexOf(entityId);
            if (index === -1) {
                group.lights.push(entityId);
            } else {
                group.lights.splice(index, 1);
            }
            this.requestUpdate();
        }
    }

    _saveGroup() {
        // TODO: Save group to HA
        this._editMode = false;
    }
}

customElements.define("aurora-group-manager", AuroraGroupManager); 