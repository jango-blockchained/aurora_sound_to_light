import { LitElement, html, css } from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";
import { mdiPencil, mdiDelete, mdiPlus } from "@mdi/js";

class AuroraEffectSelector extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      effect: { type: String },
      _effects: { type: Array },
      _showEditor: { type: Boolean },
      _editingEffect: { type: Object },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }
      .effect-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .effect-item {
        display: flex;
        align-items: center;
        padding: 8px;
        border-radius: 4px;
        background: var(--secondary-background-color);
        cursor: pointer;
      }
      .effect-item.active {
        background: var(--primary-color);
        color: var(--primary-text-color);
      }
      .effect-name {
        flex-grow: 1;
      }
      .effect-actions {
        display: flex;
        gap: 4px;
      }
      .editor {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--card-background-color);
        z-index: 1000;
        padding: 16px;
        display: flex;
        flex-direction: column;
      }
      .editor-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .parameter-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
        overflow-y: auto;
      }
      .parameter-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .parameter-label {
        font-size: 0.9em;
        color: var(--secondary-text-color);
      }
      mwc-button {
        --mdc-theme-primary: var(--primary-color);
      }
    `;
  }

  constructor() {
    super();
    this._effects = [];
    this._showEditor = false;
    this._editingEffect = null;
  }

  async firstUpdated() {
    await this._loadEffects();
  }

  render() {
    return html`
      <div class="effect-list">
        ${this._effects.map(
          (effect) => html`
            <div
              class="effect-item ${effect.id === this.effect ? "active" : ""}"
              @click=${() => this._selectEffect(effect.id)}
            >
              <div class="effect-name">${effect.name}</div>
              ${effect.type === "custom"
                ? html`
                    <div class="effect-actions">
                      <mwc-icon-button
                        @click=${(e) => this._editEffect(e, effect)}
                      >
                        <ha-svg-icon path=${mdiPencil}></ha-svg-icon>
                      </mwc-icon-button>
                      <mwc-icon-button
                        @click=${(e) => this._deleteEffect(e, effect.id)}
                      >
                        <ha-svg-icon path=${mdiDelete}></ha-svg-icon>
                      </mwc-icon-button>
                    </div>
                  `
                : ""}
            </div>
          `
        )}
        <mwc-button @click=${this._createEffect}>
          <ha-svg-icon path=${mdiPlus}></ha-svg-icon>
          Create Effect
        </mwc-button>
      </div>

      ${this._showEditor
        ? html`
            <div class="editor">
              <div class="editor-header">
                <h2>
                  ${this._editingEffect?.id
                    ? "Edit Effect"
                    : "Create New Effect"}
                </h2>
                <mwc-button @click=${this._closeEditor}>Close</mwc-button>
              </div>
              <form @submit=${this._saveEffect}>
                <div class="parameter-list">
                  <div class="parameter-item">
                    <div class="parameter-label">Name</div>
                    <ha-textfield
                      .value=${this._editingEffect?.name || ""}
                      name="name"
                      required
                    ></ha-textfield>
                  </div>
                  <div class="parameter-item">
                    <div class="parameter-label">Description</div>
                    <ha-textarea
                      .value=${this._editingEffect?.description || ""}
                      name="description"
                    ></ha-textarea>
                  </div>
                  <div class="parameter-item">
                    <div class="parameter-label">Code</div>
                    <ha-code-editor
                      .value=${this._editingEffect?.code || ""}
                      .mode=${"python"}
                      name="code"
                      required
                    ></ha-code-editor>
                  </div>
                  <div class="parameter-item">
                    <div class="parameter-label">Parameters</div>
                    <ha-yaml-editor
                      .value=${this._editingEffect?.parameters || {}}
                      name="parameters"
                    ></ha-yaml-editor>
                  </div>
                </div>
                <div class="button-row">
                  <mwc-button @click=${this._closeEditor}>Cancel</mwc-button>
                  <mwc-button raised type="submit">Save</mwc-button>
                </div>
              </form>
            </div>
          `
        : ""}
    `;
  }

  async _loadEffects() {
    const result = await this.hass.callService("aurora_sound_to_light", "list_effects", {});
    this._effects = result.effects;
  }

  async _selectEffect(effectId) {
    this.dispatchEvent(
      new CustomEvent("effect-change", {
        detail: { effect: effectId },
      })
    );
  }

  _editEffect(e, effect) {
    e.stopPropagation();
    this._editingEffect = effect;
    this._showEditor = true;
  }

  async _deleteEffect(e, effectId) {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this effect?")) {
      await this.hass.callService("aurora_sound_to_light", "delete_effect", {
        effect_id: effectId,
      });
      await this._loadEffects();
    }
  }

  _createEffect() {
    this._editingEffect = null;
    this._showEditor = true;
  }

  _closeEditor() {
    this._showEditor = false;
    this._editingEffect = null;
  }

  async _saveEffect(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get("name"),
      description: formData.get("description"),
      code: formData.get("code"),
      parameters: formData.get("parameters"),
    };

    if (this._editingEffect?.id) {
      await this.hass.callService("aurora_sound_to_light", "update_effect", {
        effect_id: this._editingEffect.id,
        ...data,
      });
    } else {
      await this.hass.callService("aurora_sound_to_light", "create_effect", data);
    }

    await this._loadEffects();
    this._closeEditor();
  }
}

customElements.define("aurora-effect-selector", AuroraEffectSelector); 