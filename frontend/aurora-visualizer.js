import { LitElement, html, css } from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class AuroraVisualizer extends LitElement {
  static get properties() {
    return {
      audioData: { type: Object },
      config: { type: Object },
      _canvasWidth: { type: Number },
      _canvasHeight: { type: Number },
      _animationFrame: { type: Number },
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
        width: 100%;
      }
      .visualizer-container {
        position: relative;
        width: 100%;
        height: 200px;
        background: var(--primary-background-color);
        border-radius: 4px;
        overflow: hidden;
      }
      canvas {
        width: 100%;
        height: 100%;
      }
      .beat-indicator {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--primary-color);
        opacity: 0;
        transition: opacity 0.1s ease-out;
      }
      .beat-indicator.active {
        opacity: 1;
      }
    `;
  }

  constructor() {
    super();
    this.audioData = {
      band_energies: [],
      is_beat: false,
      tempo: 0,
      bass_energy: 0,
      mid_energy: 0,
      high_energy: 0,
    };
    this._canvasWidth = 0;
    this._canvasHeight = 0;
    this._animationFrame = null;
  }

  firstUpdated() {
    this._setupCanvas();
    window.addEventListener("resize", this._handleResize.bind(this));
    this._startAnimation();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("resize", this._handleResize.bind(this));
    if (this._animationFrame) {
      cancelAnimationFrame(this._animationFrame);
    }
  }

  render() {
    return html`
      <div class="visualizer-container">
        <canvas id="visualizer"></canvas>
        <div
          class="beat-indicator ${this.audioData.is_beat ? "active" : ""}"
        ></div>
      </div>
    `;
  }

  _setupCanvas() {
    const canvas = this.shadowRoot.getElementById("visualizer");
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();

    // Set canvas size with device pixel ratio for sharp rendering
    const dpr = window.devicePixelRatio || 1;
    this._canvasWidth = rect.width * dpr;
    this._canvasHeight = rect.height * dpr;

    canvas.width = this._canvasWidth;
    canvas.height = this._canvasHeight;

    // Get context and configure it
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
  }

  _handleResize() {
    this._setupCanvas();
  }

  _startAnimation() {
    const draw = () => {
      this._drawVisualization();
      this._animationFrame = requestAnimationFrame(draw);
    };
    draw();
  }

  _drawVisualization() {
    const canvas = this.shadowRoot.getElementById("visualizer");
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw frequency bands
    const bands = this.audioData.band_energies || [];
    const barWidth = width / bands.length;
    const maxHeight = height * 0.8;

    // Create gradient based on energy levels
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, this._getEnergyColor(this.audioData.bass_energy));
    gradient.addColorStop(0.5, this._getEnergyColor(this.audioData.mid_energy));
    gradient.addColorStop(1, this._getEnergyColor(this.audioData.high_energy));

    ctx.fillStyle = gradient;

    // Draw bars with smooth animation
    bands.forEach((energy, i) => {
      const x = i * barWidth;
      const barHeight = energy * maxHeight;
      
      // Add glow effect on beats
      if (this.audioData.is_beat) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
      } else {
        ctx.shadowBlur = 0;
      }

      // Draw bar with rounded corners
      ctx.beginPath();
      ctx.moveTo(x + 2, height);
      ctx.lineTo(x + 2, height - barHeight + 4);
      ctx.quadraticCurveTo(x + 2, height - barHeight, x + 6, height - barHeight);
      ctx.lineTo(x + barWidth - 6, height - barHeight);
      ctx.quadraticCurveTo(
        x + barWidth - 2,
        height - barHeight,
        x + barWidth - 2,
        height - barHeight + 4
      );
      ctx.lineTo(x + barWidth - 2, height);
      ctx.fill();
    });

    // Draw tempo indicator
    if (this.audioData.tempo > 0) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.font = "14px Arial";
      ctx.textAlign = "right";
      ctx.fillText(`${Math.round(this.audioData.tempo)} BPM`, width - 10, 20);
    }
  }

  _getEnergyColor(energy) {
    // Convert energy level to HSL color
    // Energy ranges from 0 to 1
    const hue = 240 - energy * 240; // Blue (240) to Red (0)
    const saturation = 80 + energy * 20; // Increase saturation with energy
    const lightness = 40 + energy * 20; // Increase lightness with energy
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  updated(changedProperties) {
    if (changedProperties.has("audioData")) {
      // Trigger immediate redraw when audio data updates
      this._drawVisualization();
    }
  }
}

customElements.define("aurora-visualizer", AuroraVisualizer); 