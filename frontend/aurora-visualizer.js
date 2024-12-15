import {
    LitElement,
    html,
    css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class AuroraVisualizer extends LitElement {
    static get properties() {
        return {
            hass: { type: Object },
            narrow: { type: Boolean },
            debug: { type: Boolean },
            _audioData: { type: Object },
            _canvasWidth: { type: Number },
            _canvasHeight: { type: Number },
            _animationFrame: { type: Number },
            _lastUpdate: { type: Number },
            _fps: { type: Number },
        };
    }

    static get styles() {
        return css`
            :host {
                display: block;
                background: var(--card-background-color);
                border-radius: var(--ha-card-border-radius);
            }
            .visualizer-container {
                position: relative;
                width: 100%;
                height: 200px;
                background: var(--primary-background-color);
                border-radius: var(--ha-card-border-radius);
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
            .stats {
                position: absolute;
                top: 8px;
                left: 8px;
                font-size: 12px;
                color: var(--primary-text-color);
                opacity: 0.7;
                text-shadow: 0 1px 2px rgba(0,0,0,0.5);
            }
            .debug-info {
                position: absolute;
                bottom: 8px;
                left: 8px;
                font-size: 10px;
                color: var(--primary-text-color);
                opacity: 0.5;
                font-family: monospace;
            }
            .placeholder {
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
                color: var(--primary-text-color);
                text-align: center;
                opacity: 0.7;
            }
        `;
    }

    constructor() {
        super();
        this.debug = false;
        this._audioData = {
            frequencies: new Float32Array(32).fill(0),
            waveform: new Float32Array(32).fill(0),
            beat: false,
            energy: 0,
            tempo: 0,
        };
        this._canvasWidth = 0;
        this._canvasHeight = 0;
        this._animationFrame = null;
        this._lastUpdate = performance.now();
        this._fps = 0;
    }

    firstUpdated() {
        this._setupCanvas();
        window.addEventListener('resize', this._handleResize.bind(this));
        this._startAnimation();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('resize', this._handleResize.bind(this));
        if (this._animationFrame) {
            cancelAnimationFrame(this._animationFrame);
        }
    }

    render() {
        return html`
            <div class="visualizer-container">
                <canvas id="visualizer"></canvas>
                <div class="beat-indicator ${this._audioData.beat ? 'active' : ''}"></div>
                <div class="stats">
                    ${this._audioData.tempo > 0 ? `${Math.round(this._audioData.tempo)} BPM` : ''}
                </div>
                ${this.debug ? html`
                    <div class="debug-info">
                        FPS: ${Math.round(this._fps)}<br>
                        Energy: ${this._audioData.energy.toFixed(3)}<br>
                        Beat: ${this._audioData.beat ? 'Yes' : 'No'}<br>
                        Frequencies: ${this._audioData.frequencies.length}
                    </div>
                ` : ''}
            </div>
        `;
    }

    _setupCanvas() {
        const canvas = this.shadowRoot.getElementById('visualizer');
        const container = canvas.parentElement;
        const rect = container.getBoundingClientRect();

        // Set canvas size with device pixel ratio for sharp rendering
        const dpr = window.devicePixelRatio || 1;
        this._canvasWidth = rect.width * dpr;
        this._canvasHeight = rect.height * dpr;

        canvas.width = this._canvasWidth;
        canvas.height = this._canvasHeight;

        // Get context and configure it
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
    }

    _handleResize() {
        this._setupCanvas();
    }

    _startAnimation() {
        const draw = (timestamp) => {
            // Calculate FPS
            const delta = timestamp - this._lastUpdate;
            this._fps = 1000 / delta;
            this._lastUpdate = timestamp;

            this._drawVisualization();
            this._animationFrame = requestAnimationFrame(draw);
        };
        this._animationFrame = requestAnimationFrame(draw);
    }

    _drawVisualization() {
        const canvas = this.shadowRoot.getElementById('visualizer');
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw frequency bars
        const barWidth = width / this._audioData.frequencies.length;
        const maxHeight = height * 0.8;

        // Create gradient based on energy level
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, this._getEnergyColor(this._audioData.energy));
        gradient.addColorStop(1, this._getHighlightColor(this._audioData.energy));

        ctx.fillStyle = gradient;

        // Draw bars with smooth animation
        this._audioData.frequencies.forEach((value, i) => {
            const x = i * barWidth;
            const barHeight = value * maxHeight;

            // Add glow effect on beats
            if (this._audioData.beat) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
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

        // Draw waveform overlay
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        this._audioData.waveform.forEach((value, i) => {
            const x = (i / this._audioData.waveform.length) * width;
            const y = (value * height * 0.3) + (height * 0.5);
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
    }

    _getEnergyColor(energy) {
        const hue = 240 - (energy * 200); // Blue to Red
        const saturation = 70 + (energy * 30);
        const lightness = 40 + (energy * 20);
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    _getHighlightColor(energy) {
        const hue = 240 - (energy * 200);
        return `hsl(${hue}, 100%, 75%)`;
    }

    // This method would be called by the parent component with audio data
    updateAudioData(data) {
        this._audioData = {
            ...this._audioData,
            ...data
        };
        this.requestUpdate();
    }
}

customElements.define("aurora-visualizer", AuroraVisualizer); 