import { LitElement, html, css } from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";
import { mdiPlay, mdiPause, mdiSkipNext, mdiSkipPrevious, mdiVolumeHigh, mdiVolumeMute } from "@mdi/js";

class AuroraMediaControls extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      mediaPlayer: { type: String },
      _playerState: { type: Object },
      _volume: { type: Number },
      _muted: { type: Boolean },
      _position: { type: Number },
      _positionTimer: { type: Number },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
        background: var(--card-background-color);
        border-radius: var(--ha-card-border-radius);
      }
      .media-info {
        display: flex;
        align-items: center;
        margin-bottom: 16px;
        padding: 8px;
        background: var(--primary-background-color);
        border-radius: var(--ha-card-border-radius);
      }
      .media-art {
        width: 60px;
        height: 60px;
        border-radius: 8px;
        margin-right: 16px;
        background-size: cover;
        background-position: center;
        box-shadow: var(--ha-card-box-shadow);
      }
      .media-details {
        flex-grow: 1;
        overflow: hidden;
      }
      .media-title {
        font-size: 1.1em;
        font-weight: 500;
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--primary-text-color);
      }
      .media-artist {
        font-size: 0.9em;
        color: var(--secondary-text-color);
        margin: 4px 0 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .controls {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin: 16px 0;
      }
      .volume-control {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 16px 8px;
      }
      mwc-icon-button {
        --mdc-icon-button-size: 48px;
        --mdc-icon-size: 24px;
        color: var(--primary-text-color);
      }
      .play-button {
        --mdc-icon-button-size: 56px;
        --mdc-icon-size: 32px;
        background: var(--primary-color);
        border-radius: 50%;
        color: var(--text-primary-color);
        transition: all 0.2s ease-in-out;
      }
      .play-button:hover {
        background: var(--primary-color-light);
      }
      ha-slider {
        flex-grow: 1;
        --paper-slider-active-color: var(--primary-color);
        --paper-slider-knob-color: var(--primary-color);
      }
      .progress {
        margin: 8px;
        padding: 8px;
        background: var(--primary-background-color);
        border-radius: var(--ha-card-border-radius);
      }
      .progress-text {
        display: flex;
        justify-content: space-between;
        font-size: 0.8em;
        color: var(--secondary-text-color);
        margin-top: 4px;
      }
      .error-message {
        color: var(--error-color);
        font-size: 0.9em;
        text-align: center;
        padding: 8px;
      }
      .unavailable {
        opacity: 0.5;
        pointer-events: none;
      }
    `;
  }

  constructor() {
    super();
    this._volume = 0;
    this._muted = false;
    this._playerState = {};
    this._position = 0;
    this._positionTimer = null;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._clearPositionTimer();
  }

  render() {
    if (!this.mediaPlayer) {
      return html`<div class="error-message">No media player selected</div>`;
    }

    if (!this._playerState) {
      return html`<div class="error-message">Media player not available</div>`;
    }

    const state = this._playerState;
    const isPlaying = state.state === "playing";
    const isUnavailable = state.state === "unavailable";
    const hasMediaArt = state.attributes.entity_picture;
    const supportsPrevious = state.attributes.supported_features & 16;
    const supportsNext = state.attributes.supported_features & 32;

    return html`
      <div class="${isUnavailable ? 'unavailable' : ''}">
        <div class="media-info">
          ${hasMediaArt
            ? html`<div
                class="media-art"
                style="background-image: url(${state.attributes.entity_picture})"
              ></div>`
            : ""}
          <div class="media-details">
            <h3 class="media-title">
              ${state.attributes.media_title || "Nothing playing"}
            </h3>
            <p class="media-artist">${state.attributes.media_artist || ""}</p>
          </div>
        </div>

        <div class="controls">
          ${supportsPrevious
            ? html`
                <mwc-icon-button @click=${this._previousTrack}>
                  <ha-svg-icon path=${mdiSkipPrevious}></ha-svg-icon>
                </mwc-icon-button>
              `
            : ""}
          <mwc-icon-button class="play-button" @click=${this._playPause}>
            <ha-svg-icon path=${isPlaying ? mdiPause : mdiPlay}></ha-svg-icon>
          </mwc-icon-button>
          ${supportsNext
            ? html`
                <mwc-icon-button @click=${this._nextTrack}>
                  <ha-svg-icon path=${mdiSkipNext}></ha-svg-icon>
                </mwc-icon-button>
              `
            : ""}
        </div>

        <div class="volume-control">
          <mwc-icon-button @click=${this._toggleMute}>
            <ha-svg-icon
              path=${this._muted ? mdiVolumeMute : mdiVolumeHigh}
            ></ha-svg-icon>
          </mwc-icon-button>
          <ha-slider
            min="0"
            max="100"
            step="1"
            value=${this._volume}
            @change=${this._volumeChanged}
          ></ha-slider>
        </div>

        ${state.attributes.media_duration
          ? html`
              <div class="progress">
                <ha-slider
                  min="0"
                  max=${state.attributes.media_duration}
                  step="1"
                  value=${this._position}
                  @change=${this._seekChanged}
                ></ha-slider>
                <div class="progress-text">
                  <span>${this._formatTime(this._position)}</span>
                  <span>${this._formatTime(state.attributes.media_duration)}</span>
                </div>
              </div>
            `
          : ""}
      </div>
    `;
  }

  updated(changedProps) {
    if (changedProps.has("hass") || changedProps.has("mediaPlayer")) {
      this._updatePlayerState();
    }

    if (changedProps.has("_playerState")) {
      this._handleStateChange();
    }
  }

  _updatePlayerState() {
    if (!this.hass || !this.mediaPlayer) return;

    const state = this.hass.states[this.mediaPlayer];
    if (state) {
      this._playerState = state;
      this._volume = state.attributes.volume_level * 100;
      this._muted = state.attributes.is_volume_muted;
      this._position = state.attributes.media_position || 0;
    }
  }

  _handleStateChange() {
    this._clearPositionTimer();

    if (this._playerState?.state === "playing") {
      this._startPositionTimer();
    }
  }

  _startPositionTimer() {
    this._positionTimer = setInterval(() => {
      if (this._position !== null) {
        this._position += 1;
      }
    }, 1000);
  }

  _clearPositionTimer() {
    if (this._positionTimer) {
      clearInterval(this._positionTimer);
      this._positionTimer = null;
    }
  }

  async _playPause() {
    if (!this.mediaPlayer) return;
    try {
      const state = this._playerState.state;
      const service = state === "playing" ? "media_pause" : "media_play";
      await this.hass.callService("media_player", service, {
        entity_id: this.mediaPlayer,
      });
    } catch (error) {
      console.error("Error controlling playback:", error);
    }
  }

  async _previousTrack() {
    if (!this.mediaPlayer) return;
    try {
      await this.hass.callService("media_player", "media_previous_track", {
        entity_id: this.mediaPlayer,
      });
    } catch (error) {
      console.error("Error skipping to previous track:", error);
    }
  }

  async _nextTrack() {
    if (!this.mediaPlayer) return;
    try {
      await this.hass.callService("media_player", "media_next_track", {
        entity_id: this.mediaPlayer,
      });
    } catch (error) {
      console.error("Error skipping to next track:", error);
    }
  }

  async _volumeChanged(e) {
    if (!this.mediaPlayer) return;
    try {
      const volume = e.target.value / 100;
      await this.hass.callService("media_player", "volume_set", {
        entity_id: this.mediaPlayer,
        volume_level: volume,
      });
    } catch (error) {
      console.error("Error setting volume:", error);
    }
  }

  async _toggleMute() {
    if (!this.mediaPlayer) return;
    try {
      await this.hass.callService("media_player", "volume_mute", {
        entity_id: this.mediaPlayer,
        is_volume_muted: !this._muted,
      });
    } catch (error) {
      console.error("Error toggling mute:", error);
    }
  }

  async _seekChanged(e) {
    if (!this.mediaPlayer) return;
    try {
      const position = e.target.value;
      this._position = position;
      await this.hass.callService("media_player", "media_seek", {
        entity_id: this.mediaPlayer,
        seek_position: position,
      });
    } catch (error) {
      console.error("Error seeking:", error);
    }
  }

  _formatTime(seconds) {
    if (!seconds) return "0:00";
    const minutes = Math.floor(seconds / 60);
    seconds = Math.floor(seconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
}

customElements.define("aurora-media-controls", AuroraMediaControls); 