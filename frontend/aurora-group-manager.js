import { LitElement, html, css } from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";
import { mdiPlus, mdiDelete, mdiDragVertical } from "@mdi/js";

class AuroraGroupManager extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      groups: { type: Array },
      _availableLights: { type: Array },
      _draggingGroup: { type: Number },
      _draggingLight: { type: String },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }
      .group-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .group {
        background: var(--secondary-background-color);
        border-radius: 4px;
        padding: 8px;
      }
      .group-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .group-name {
        flex-grow: 1;
      }
      .light-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .light-item {
        display: flex;
        align-items: center;
        padding: 4px;
        background: var(--card-background-color);
        border-radius: 4px;
        cursor: move;
      }
      .light-item.dragging {
        opacity: 0.5;
      }
      .light-name {
        flex-grow: 1;
      }
      .drag-handle {
        cursor: move;
        padding: 4px;
      }
      .drop-target {
        height: 2px;
        background: var(--primary-color);
        margin: 4px 0;
        display: none;
      }
      .drop-target.active {
        display: block;
      }
      .available-lights {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--divider-color);
      }
      mwc-button {
        --mdc-theme-primary: var(--primary-color);
      }
    `;
  }

  constructor() {
    super();
    this.groups = [];
    this._availableLights = [];
    this._draggingGroup = -1;
    this._draggingLight = null;
  }

  firstUpdated() {
    this._loadAvailableLights();
  }

  render() {
    return html`
      <div class="group-list">
        ${this.groups.map(
          (group, index) => html`
            <div class="group" data-group-index=${index}>
              <div class="group-header">
                <ha-textfield
                  .value=${group.name}
                  @change=${(e) => this._updateGroupName(index, e.target.value)}
                ></ha-textfield>
                <mwc-icon-button @click=${() => this._deleteGroup(index)}>
                  <ha-svg-icon path=${mdiDelete}></ha-svg-icon>
                </mwc-icon-button>
              </div>
              <div
                class="light-list"
                @dragover=${this._handleDragOver}
                @drop=${(e) => this._handleDrop(e, index)}
              >
                ${group.lights.map(
                  (light, lightIndex) => html`
                    <div
                      class="light-item ${this._draggingLight === light
                        ? "dragging"
                        : ""}"
                      draggable="true"
                      @dragstart=${(e) => this._handleDragStart(e, light)}
                      @dragend=${this._handleDragEnd}
                    >
                      <div class="drag-handle">
                        <ha-svg-icon path=${mdiDragVertical}></ha-svg-icon>
                      </div>
                      <div class="light-name">
                        ${this.hass.states[light]?.attributes?.friendly_name ||
                        light}
                      </div>
                      <mwc-icon-button
                        @click=${() =>
                          this._removeLightFromGroup(index, lightIndex)}
                      >
                        <ha-svg-icon path=${mdiDelete}></ha-svg-icon>
                      </mwc-icon-button>
                    </div>
                    <div
                      class="drop-target ${this._draggingLight ? "active" : ""}"
                      data-index=${lightIndex + 1}
                    ></div>
                  `
                )}
              </div>
            </div>
          `
        )}
        <mwc-button @click=${this._addGroup}>
          <ha-svg-icon path=${mdiPlus}></ha-svg-icon>
          Add Group
        </mwc-button>
      </div>

      <div class="available-lights">
        <h3>Available Lights</h3>
        <div
          class="light-list"
          @dragover=${this._handleDragOver}
          @drop=${this._handleDropToAvailable}
        >
          ${this._availableLights.map(
            (light) => html`
              <div
                class="light-item ${this._draggingLight === light
                  ? "dragging"
                  : ""}"
                draggable="true"
                @dragstart=${(e) => this._handleDragStart(e, light)}
                @dragend=${this._handleDragEnd}
              >
                <div class="drag-handle">
                  <ha-svg-icon path=${mdiDragVertical}></ha-svg-icon>
                </div>
                <div class="light-name">
                  ${this.hass.states[light]?.attributes?.friendly_name || light}
                </div>
              </div>
            `
          )}
        </div>
      </div>
    `;
  }

  _loadAvailableLights() {
    const allLights = Object.keys(this.hass.states).filter(
      (entityId) => entityId.startsWith("light.")
    );
    const usedLights = new Set(
      this.groups.flatMap((group) => group.lights)
    );
    this._availableLights = allLights.filter(
      (light) => !usedLights.has(light)
    );
  }

  _addGroup() {
    const newGroups = [
      ...this.groups,
      {
        name: `Group ${this.groups.length + 1}`,
        lights: [],
      },
    ];
    this._updateGroups(newGroups);
  }

  _deleteGroup(index) {
    const newGroups = [...this.groups];
    const deletedLights = newGroups[index].lights;
    newGroups.splice(index, 1);
    this._availableLights = [...this._availableLights, ...deletedLights];
    this._updateGroups(newGroups);
  }

  _updateGroupName(index, name) {
    const newGroups = [...this.groups];
    newGroups[index].name = name;
    this._updateGroups(newGroups);
  }

  _removeLightFromGroup(groupIndex, lightIndex) {
    const newGroups = [...this.groups];
    const [removedLight] = newGroups[groupIndex].lights.splice(lightIndex, 1);
    this._availableLights = [...this._availableLights, removedLight];
    this._updateGroups(newGroups);
  }

  _handleDragStart(e, light) {
    this._draggingLight = light;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", light);
  }

  _handleDragEnd() {
    this._draggingLight = null;
    this.requestUpdate();
  }

  _handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  _handleDrop(e, groupIndex) {
    e.preventDefault();
    const light = e.dataTransfer.getData("text/plain");
    
    // Remove from source
    if (this._availableLights.includes(light)) {
      this._availableLights = this._availableLights.filter(
        (l) => l !== light
      );
    } else {
      this.groups.forEach((group, index) => {
        const lightIndex = group.lights.indexOf(light);
        if (lightIndex !== -1) {
          group.lights.splice(lightIndex, 1);
        }
      });
    }

    // Add to target group
    const newGroups = [...this.groups];
    const dropTarget = e.target.closest(".drop-target");
    if (dropTarget) {
      const index = parseInt(dropTarget.dataset.index);
      newGroups[groupIndex].lights.splice(index, 0, light);
    } else {
      newGroups[groupIndex].lights.push(light);
    }

    this._updateGroups(newGroups);
  }

  _handleDropToAvailable(e) {
    e.preventDefault();
    const light = e.dataTransfer.getData("text/plain");
    
    // Remove from groups
    const newGroups = this.groups.map((group) => ({
      ...group,
      lights: group.lights.filter((l) => l !== light),
    }));

    // Add to available lights
    if (!this._availableLights.includes(light)) {
      this._availableLights = [...this._availableLights, light];
    }

    this._updateGroups(newGroups);
  }

  _updateGroups(newGroups) {
    this.groups = newGroups;
    this.dispatchEvent(
      new CustomEvent("group-update", {
        detail: { groups: newGroups },
      })
    );
  }
}

customElements.define("aurora-group-manager", AuroraGroupManager); 