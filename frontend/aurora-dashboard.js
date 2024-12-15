import { LitElement, html, css } from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";
import { mdiPause, mdiPlay, mdiPlus, mdiCog } from "@mdi/js";

class AuroraDashboard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      _activeEffect: { type: String },
      _audioData: { type: Object },
      _lightGroups: { type: Array },
      _metrics: { type: Object },
      _selectedMediaPlayer: { type: String },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
        padding: 16px;
      }
      .container {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 16px;
      }
      .visualization {
        grid-column: 1;
        background: var(--card-background-color);
        border-radius: var(--ha-card-border-radius);
        padding: 16px;
        box-shadow: var(--ha-card-box-shadow);
      }
      .controls {
        grid-column: 2;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .card {
        background: var(--card-background-color);
        border-radius: var(--ha-card-border-radius);
        padding: 16px;
        box-shadow: var(--ha-card-box-shadow);
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      h2, h3 {
        margin: 0;
        color: var(--primary-text-color);
      }
      .button-row {
        display: flex;
        gap: 8px;
      }
      mwc-button {
        --mdc-theme-primary: var(--primary-color);
      }
      .metrics {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }
      .metric {
        padding: 8px;
        border-radius: 4px;
        background: var(--secondary-background-color);
      }
      .metric-label {
        font-size: 0.9em;
        color: var(--secondary-text-color);
      }
      .metric-value {
        font-size: 1.2em;
        font-weight: bold;
      }
      .media-player-select {
        margin-bottom: 16px;
      }
    `;
  }

  constructor() {
    super();
    this._activeEffect = "";
    this._audioData = {};
    this._lightGroups = [];
    this._metrics = {
      latency: 0,
      cpuUsage: 0,
      beatConfidence: 0,
      tempo: 0,
    };
    this._selectedMediaPlayer = null;
  }

  render() {
    return html`
      <ha-card>
        <div class="container">
          <div class="visualization">
            <div class="header">
              <h2>Aurora Sound to Light</h2>
              <div class="button-row">
                <mwc-button @click=${this._openConfig}>
                  <ha-svg-icon path=${mdiCog}></ha-svg-icon>
                </mwc-button>
              </div>
            </div>
            <aurora-visualizer
              .audioData=${this._audioData}
              .config=${this.config}
            ></aurora-visualizer>
          </div>
          
          <div class="controls">
            <div class="card">
              <h3>Media Player</h3>
              <div class="media-player-select">
                <ha-select
                  .label=${"Select Media Player"}
                  .value=${this._selectedMediaPlayer}
                  @selected=${this._handleMediaPlayerSelect}
                >
                  ${this._getMediaPlayerOptions()}
                </ha-select>
              </div>
              ${this._selectedMediaPlayer
                ? html`
                    <aurora-media-controls
                      .hass=${this.hass}
                      .mediaPlayer=${this._selectedMediaPlayer}
                    ></aurora-media-controls>
                  `
                : ""}
            </div>
            
            <div class="card">
              <h3>Active Effect</h3>
              <aurora-effect-selector
                .hass=${this.hass}
                .effect=${this._activeEffect}
                @effect-change=${this._handleEffectChange}
              ></aurora-effect-selector>
            </div>
            
            <div class="card">
              <h3>Light Groups</h3>
              <aurora-group-manager
                .hass=${this.hass}
                .groups=${this._lightGroups}
                @group-update=${this._handleGroupUpdate}
              ></aurora-group-manager>
            </div>
            
            <div class="card">
              <h3>Performance Metrics</h3>
              <div class="metrics">
                <div class="metric">
                  <div class="metric-label">Latency</div>
                  <div class="metric-value">${this._metrics.latency}ms</div>
                </div>
                <div class="metric">
                  <div class="metric-label">CPU Usage</div>
                  <div class="metric-value">${this._metrics.cpuUsage}%</div>
                </div>
                <div class="metric">
                  <div class="metric-label">Beat Confidence</div>
                  <div class="metric-value">${this._metrics.beatConfidence}%</div>
                </div>
                <div class="metric">
                  <div class="metric-label">Tempo</div>
                  <div class="metric-value">${this._metrics.tempo} BPM</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ha-card>
    `;
  }

  setConfig(config) {
    if (!config) {
      throw new Error("Invalid configuration");
    }
    this.config = config;
  }

  set hass(hass) {
    this._hass = hass;
    this._updateState();
  }

  async _updateState() {
    if (!this._hass) return;

    // Update audio data
    const audioState = this._hass.states["sensor.aurora_audio_data"];
    if (audioState) {
      this._audioData = JSON.parse(audioState.state);
    }

    // Update metrics
    const latencyState = this._hass.states["sensor.aurora_latency"];
    const cpuState = this._hass.states["sensor.aurora_cpu_usage"];
    const beatState = this._hass.states["sensor.aurora_beat_confidence"];
    const tempoState = this._hass.states["sensor.aurora_tempo"];

    this._metrics = {
      latency: latencyState ? parseFloat(latencyState.state) : 0,
      cpuUsage: cpuState ? parseFloat(cpuState.state) : 0,
      beatConfidence: beatState ? parseFloat(beatState.state) : 0,
      tempo: tempoState ? parseFloat(tempoState.state) : 0,
    };
  }

  _getMediaPlayerOptions() {
    if (!this._hass) return html``;

    const mediaPlayers = Object.entries(this._hass.states)
      .filter(([entityId]) => entityId.startsWith("media_player."))
      .map(([entityId, state]) => ({
        value: entityId,
        label: state.attributes.friendly_name || entityId,
      }));

    return mediaPlayers.map(
      (player) => html`
        <mwc-list-item .value=${player.value}>${player.label}</mwc-list-item>
      `
    );
  }

  async _handleMediaPlayerSelect(e) {
    const mediaPlayer = e.target.value;
    this._selectedMediaPlayer = mediaPlayer;
    
    // Update the integration's media player
    await this._hass.callService("aurora_sound_to_light", "set_media_player", {
      entity_id: mediaPlayer,
    });
  }

  async _openConfig() {
    const event = new CustomEvent("hass-more-info", {
      bubbles: true,
      composed: true,
      detail: {
        entityId: "aurora_sound_to_light.config",
      },
    });
    this.dispatchEvent(event);
  }

  async _handleEffectChange(e) {
    const effect = e.detail.effect;
    await this._hass.callService("aurora_sound_to_light", "set_effect", {
      effect_id: effect,
    });
    this._activeEffect = effect;
  }

  async _handleGroupUpdate(e) {
    const groups = e.detail.groups;
    await this._hass.callService("aurora_sound_to_light", "update_groups", {
      groups: groups,
    });
    this._lightGroups = groups;
  }
}

customElements.define("aurora-dashboard", AuroraDashboard); 