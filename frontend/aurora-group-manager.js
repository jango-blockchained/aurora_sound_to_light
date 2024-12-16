import {
    LitElement,
    html,
    css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class AuroraGroupManager extends LitElement {
    static get properties() {
        return {
            hass: { type: Object },
            entities: { type: Array },
            groups: { type: Array },
            selectedGroup: { type: Object },
            zones: { type: Array },
            is3DMode: { type: Boolean },
            showMeshTopology: { type: Boolean },
            testMode: { type: Boolean }
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

            .container {
                display: grid;
                grid-template-columns: 300px 1fr;
                gap: 16px;
                height: 600px;
            }

            .sidebar {
                display: flex;
                flex-direction: column;
                gap: 16px;
                padding: 16px;
                background: var(--primary-background-color, #f5f5f5);
                border-radius: 8px;
                overflow-y: auto;
            }

            .main-content {
                position: relative;
                background: var(--primary-background-color, #f5f5f5);
                border-radius: 8px;
                overflow: hidden;
            }

            .entity-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .entity-item {
                display: flex;
                align-items: center;
                padding: 8px;
                background: var(--card-background-color, #fff);
                border-radius: 4px;
                cursor: move;
                user-select: none;
            }

            .entity-item.selected {
                border: 2px solid var(--primary-color);
            }

            .entity-item:hover {
                background: var(--secondary-background-color);
            }

            .group-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .group-item {
                padding: 8px;
                background: var(--card-background-color, #fff);
                border-radius: 4px;
                cursor: pointer;
            }

            .group-item.selected {
                border: 2px solid var(--primary-color);
            }

            .group-item:hover {
                background: var(--secondary-background-color);
            }

            .zone-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
                gap: 8px;
                padding: 16px;
            }

            .zone {
                padding: 8px;
                background: var(--card-background-color, #fff);
                border-radius: 4px;
                text-align: center;
                cursor: pointer;
            }

            .zone.active {
                background: var(--primary-color);
                color: white;
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

            .canvas-container {
                position: relative;
                width: 100%;
                height: 100%;
            }

            canvas {
                width: 100%;
                height: 100%;
            }

            .topology-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
            }

            .test-panel {
                position: absolute;
                top: 16px;
                right: 16px;
                padding: 16px;
                background: rgba(0, 0, 0, 0.8);
                border-radius: 8px;
                color: white;
            }

            .position-controls {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 8px;
                margin-top: 16px;
            }

            .position-input {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .position-input label {
                font-size: 0.9em;
                color: var(--secondary-text-color);
            }

            input[type="number"] {
                width: 100%;
                padding: 4px;
                border: 1px solid var(--divider-color);
                border-radius: 4px;
            }

            .mesh-controls {
                position: absolute;
                bottom: 16px;
                left: 16px;
                display: flex;
                gap: 8px;
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
        this.entities = [];
        this.groups = [];
        this.selectedGroup = null;
        this.zones = [];
        this.is3DMode = false;
        this.showMeshTopology = false;
        this.testMode = false;

        // Internal properties
        this._canvas = null;
        this._ctx = null;
        this._scene = null;
        this._camera = null;
        this._renderer = null;
        this._draggedEntity = null;
        this._meshConnections = new Map();
    }

    firstUpdated() {
        this._loadEntities();
        this._loadGroups();
        this._loadZones();
        this._setupCanvas();
        this._setupDragAndDrop();
    }

    render() {
        return html`
            <div class="container">
                <div class="sidebar">
                    <h3>Light Entities</h3>
                    <div class="entity-list">
                        ${this.entities.map(entity => this._renderEntityItem(entity))}
                    </div>

                    <h3>Groups</h3>
                    <div class="group-list">
                        ${this.groups.map(group => this._renderGroupItem(group))}
                    </div>

                    <div class="controls">
                        <button @click=${this._handleCreateGroup}>
                            Create Group
                        </button>
                        ${this.selectedGroup ? html`
                            <button class="secondary" @click=${this._handleDeleteGroup}>
                                Delete Group
                            </button>
                        ` : ''}
                    </div>
                </div>

                <div class="main-content">
                    <div class="canvas-container">
                        <canvas></canvas>
                        ${this.showMeshTopology ? html`
                            <div class="topology-overlay"></div>
                        ` : ''}
                    </div>

                    ${this.selectedGroup ? html`
                        <div class="position-controls">
                            <div class="position-input">
                                <label>X Position</label>
                                <input 
                                    type="number"
                                    .value=${this.selectedGroup.position?.x || 0}
                                    @input=${(e) => this._updatePosition('x', e.target.value)}
                                >
                            </div>
                            <div class="position-input">
                                <label>Y Position</label>
                                <input 
                                    type="number"
                                    .value=${this.selectedGroup.position?.y || 0}
                                    @input=${(e) => this._updatePosition('y', e.target.value)}
                                >
                            </div>
                            <div class="position-input">
                                <label>Z Position</label>
                                <input 
                                    type="number"
                                    .value=${this.selectedGroup.position?.z || 0}
                                    @input=${(e) => this._updatePosition('z', e.target.value)}
                                >
                            </div>
                        </div>
                    ` : ''}

                    <div class="mesh-controls">
                        <button 
                            @click=${() => this.is3DMode = !this.is3DMode}
                            class=${this.is3DMode ? 'secondary' : ''}
                        >
                            ${this.is3DMode ? '2D Mode' : '3D Mode'}
                        </button>
                        <button 
                            @click=${() => this.showMeshTopology = !this.showMeshTopology}
                            class=${this.showMeshTopology ? 'secondary' : ''}
                        >
                            ${this.showMeshTopology ? 'Hide Mesh' : 'Show Mesh'}
                        </button>
                        <button 
                            @click=${() => this.testMode = !this.testMode}
                            class=${this.testMode ? 'secondary' : ''}
                        >
                            ${this.testMode ? 'Stop Test' : 'Test Group'}
                        </button>
                    </div>

                    ${this.testMode && this.selectedGroup ? html`
                        <div class="test-panel">
                            <h4>Testing Group: ${this.selectedGroup.name}</h4>
                            <div class="test-controls">
                                <button @click=${this._handleTestSequence}>
                                    Run Test Sequence
                                </button>
                                <button @click=${this._handleTestResponse}>
                                    Test Response Time
                                </button>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>

            <div class="zone-grid">
                ${this.zones.map(zone => html`
                    <div 
                        class="zone ${this.selectedGroup?.zone === zone.id ? 'active' : ''}"
                        @click=${() => this._assignZone(zone)}
                    >
                        ${zone.name}
                    </div>
                `)}
            </div>
        `;
    }

    _renderEntityItem(entity) {
        const isSelected = this.selectedGroup?.entities.includes(entity.entity_id);
        return html`
            <div 
                class="entity-item ${isSelected ? 'selected' : ''}"
                draggable="true"
                @dragstart=${(e) => this._handleDragStart(e, entity)}
                @click=${() => this._toggleEntitySelection(entity)}
            >
                <span>${entity.name}</span>
            </div>
        `;
    }

    _renderGroupItem(group) {
        const isSelected = this.selectedGroup?.id === group.id;
        return html`
            <div 
                class="group-item ${isSelected ? 'selected' : ''}"
                @click=${() => this._selectGroup(group)}
            >
                <div class="group-name">${group.name}</div>
                <div class="group-info">
                    ${group.entities.length} lights | Zone: ${group.zone || 'None'}
                </div>
            </div>
        `;
    }

    async _loadEntities() {
        try {
            const entities = Object.entries(this.hass.states)
                .filter(([entity_id]) => entity_id.startsWith('light.'))
                .map(([entity_id, state]) => ({
                    entity_id,
                    name: state.attributes.friendly_name || entity_id.split('.')[1],
                    state: state.state,
                    attributes: state.attributes
                }));
            this.entities = entities;
        } catch (error) {
            console.error('Failed to load entities:', error);
        }
    }

    async _loadGroups() {
        try {
            const response = await this.hass.callWS({
                type: 'aurora_sound_to_light/get_groups'
            });
            this.groups = response.groups;
        } catch (error) {
            console.error('Failed to load groups:', error);
        }
    }

    async _loadZones() {
        try {
            const response = await this.hass.callWS({
                type: 'aurora_sound_to_light/get_zones'
            });
            this.zones = response.zones;
        } catch (error) {
            console.error('Failed to load zones:', error);
        }
    }

    _setupCanvas() {
        this._canvas = this.shadowRoot.querySelector('canvas');
        this._ctx = this._canvas.getContext('2d');

        if (this.is3DMode) {
            this._setup3DScene();
        }

        this._resizeCanvas();
        window.addEventListener('resize', () => this._resizeCanvas());
        this._startRendering();
    }

    _resizeCanvas() {
        const container = this._canvas.parentElement;
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this._canvas.width = rect.width * dpr;
        this._canvas.height = rect.height * dpr;

        if (this.is3DMode && this._renderer) {
            this._renderer.setSize(rect.width, rect.height);
            this._camera.aspect = rect.width / rect.height;
            this._camera.updateProjectionMatrix();
        } else {
            this._ctx.scale(dpr, dpr);
        }
    }

    _setup3DScene() {
        // This would be implemented with Three.js or similar
        // For now, we'll just use 2D canvas
    }

    _startRendering() {
        const render = () => {
            if (this.is3DMode) {
                this._render3DScene();
            } else {
                this._render2DScene();
            }
            requestAnimationFrame(render);
        };
        render();
    }

    _render2DScene() {
        this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

        // Draw groups
        this.groups.forEach(group => {
            this._drawGroup(group);
        });

        // Draw mesh topology if enabled
        if (this.showMeshTopology) {
            this._drawMeshConnections();
        }
    }

    _render3DScene() {
        // This would render the 3D scene
        // For now, we'll just use 2D
    }

    _drawGroup(group) {
        const { x, y } = group.position || { x: 0, y: 0 };

        this._ctx.beginPath();
        this._ctx.arc(x, y, 10, 0, Math.PI * 2);
        this._ctx.fillStyle = group === this.selectedGroup ?
            'var(--primary-color)' : 'var(--secondary-color)';
        this._ctx.fill();

        this._ctx.fillStyle = 'var(--primary-text-color)';
        this._ctx.textAlign = 'center';
        this._ctx.fillText(group.name, x, y + 20);
    }

    _drawMeshConnections() {
        this._ctx.strokeStyle = 'rgba(var(--rgb-primary-color), 0.3)';
        this._ctx.lineWidth = 1;

        this._meshConnections.forEach((connections, groupId) => {
            const group = this.groups.find(g => g.id === groupId);
            if (!group) return;

            connections.forEach(connectedGroupId => {
                const connectedGroup = this.groups.find(g => g.id === connectedGroupId);
                if (!connectedGroup) return;

                this._ctx.beginPath();
                this._ctx.moveTo(group.position.x, group.position.y);
                this._ctx.lineTo(connectedGroup.position.x, connectedGroup.position.y);
                this._ctx.stroke();
            });
        });
    }

    _setupDragAndDrop() {
        this._canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        this._canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!this._draggedEntity) return;

            const rect = this._canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            this._updateEntityPosition(this._draggedEntity, x, y);
            this._draggedEntity = null;
        });
    }

    _handleDragStart(e, entity) {
        this._draggedEntity = entity;
        e.dataTransfer.setData('text/plain', entity.entity_id);
        e.dataTransfer.effectAllowed = 'move';
    }

    async _handleCreateGroup() {
        const name = prompt('Enter group name:');
        if (!name) return;

        try {
            const response = await this.hass.callWS({
                type: 'aurora_sound_to_light/create_group',
                name,
                entities: [],
                position: { x: 0, y: 0, z: 0 }
            });

            await this._loadGroups();
            this._selectGroup(response.group);
        } catch (error) {
            console.error('Failed to create group:', error);
        }
    }

    async _handleDeleteGroup() {
        if (!this.selectedGroup) return;

        if (!confirm(`Delete group "${this.selectedGroup.name}"?`)) return;

        try {
            await this.hass.callWS({
                type: 'aurora_sound_to_light/delete_group',
                group_id: this.selectedGroup.id
            });

            this.selectedGroup = null;
            await this._loadGroups();
        } catch (error) {
            console.error('Failed to delete group:', error);
        }
    }

    _selectGroup(group) {
        this.selectedGroup = group;
        this._updateMeshTopology();
    }

    async _toggleEntitySelection(entity) {
        if (!this.selectedGroup) return;

        const entities = [...this.selectedGroup.entities];
        const index = entities.indexOf(entity.entity_id);

        if (index === -1) {
            entities.push(entity.entity_id);
        } else {
            entities.splice(index, 1);
        }

        try {
            await this.hass.callWS({
                type: 'aurora_sound_to_light/update_group',
                group_id: this.selectedGroup.id,
                entities
            });

            await this._loadGroups();
            this._updateMeshTopology();
        } catch (error) {
            console.error('Failed to update group:', error);
        }
    }

    async _assignZone(zone) {
        if (!this.selectedGroup) return;

        try {
            await this.hass.callWS({
                type: 'aurora_sound_to_light/assign_zone',
                group_id: this.selectedGroup.id,
                zone_id: zone.id
            });

            await this._loadGroups();
            this._updateMeshTopology();
        } catch (error) {
            console.error('Failed to assign zone:', error);
        }
    }

    async _updatePosition(axis, value) {
        if (!this.selectedGroup) return;

        const position = {
            ...this.selectedGroup.position,
            [axis]: parseFloat(value)
        };

        try {
            await this.hass.callWS({
                type: 'aurora_sound_to_light/update_group',
                group_id: this.selectedGroup.id,
                position
            });

            await this._loadGroups();
            this._updateMeshTopology();
        } catch (error) {
            console.error('Failed to update position:', error);
        }
    }

    _updateMeshTopology() {
        this._meshConnections.clear();

        this.groups.forEach(group => {
            const connections = new Set();

            // Find groups in the same zone
            if (group.zone) {
                this.groups.forEach(otherGroup => {
                    if (otherGroup.id !== group.id && otherGroup.zone === group.zone) {
                        connections.add(otherGroup.id);
                    }
                });
            }

            // Find nearby groups
            const maxDistance = 100; // Adjust based on your scale
            this.groups.forEach(otherGroup => {
                if (otherGroup.id === group.id) return;

                const distance = this._calculateDistance(group.position, otherGroup.position);
                if (distance <= maxDistance) {
                    connections.add(otherGroup.id);
                }
            });

            this._meshConnections.set(group.id, connections);
        });
    }

    _calculateDistance(pos1, pos2) {
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const dz = (pos2.z || 0) - (pos1.z || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    async _handleTestSequence() {
        if (!this.selectedGroup || !this.testMode) return;

        try {
            await this.hass.callWS({
                type: 'aurora_sound_to_light/test_group',
                group_id: this.selectedGroup.id,
                test_type: 'sequence'
            });
        } catch (error) {
            console.error('Failed to run test sequence:', error);
        }
    }

    async _handleTestResponse() {
        if (!this.selectedGroup || !this.testMode) return;

        try {
            const response = await this.hass.callWS({
                type: 'aurora_sound_to_light/test_group',
                group_id: this.selectedGroup.id,
                test_type: 'response'
            });

            console.log('Response time:', response.response_time);
        } catch (error) {
            console.error('Failed to test response time:', error);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('resize', this._resizeCanvas);
        if (this._renderer) {
            this._renderer.dispose();
        }
    }
}

customElements.define('aurora-group-manager', AuroraGroupManager); 