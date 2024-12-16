import {
    LitElement,
    html,
    css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class AuroraVisualizer extends LitElement {
    static get properties() {
        return {
            mode: { type: String },
            fftSize: { type: Number },
            smoothingTimeConstant: { type: Number },
            minDecibels: { type: Number },
            maxDecibels: { type: Number },
            colorScheme: { type: String },
            isActive: { type: Boolean },
            beatDetectionEnabled: { type: Boolean },
            showFPS: { type: Boolean }
        };
    }

    static get styles() {
        return css`
            :host {
                display: block;
                width: 100%;
                height: 300px;
                background: var(--card-background-color, #fff);
                border-radius: var(--ha-card-border-radius, 4px);
                box-shadow: var(--ha-card-box-shadow, 0 2px 2px rgba(0, 0, 0, 0.1));
                overflow: hidden;
            }

            .visualizer-container {
                position: relative;
                width: 100%;
                height: 100%;
            }

            canvas {
                width: 100%;
                height: 100%;
            }

            .controls {
                position: absolute;
                top: 8px;
                right: 8px;
                display: flex;
                gap: 8px;
                padding: 8px;
                background: rgba(0, 0, 0, 0.5);
                border-radius: 4px;
                z-index: 1;
            }

            button {
                padding: 4px 8px;
                border: none;
                border-radius: 4px;
                background: var(--primary-color);
                color: white;
                cursor: pointer;
                font-size: 0.8em;
            }

            button:hover {
                background: var(--primary-color-light);
            }

            .fps-counter {
                position: absolute;
                bottom: 8px;
                left: 8px;
                padding: 4px 8px;
                background: rgba(0, 0, 0, 0.5);
                color: white;
                border-radius: 4px;
                font-size: 0.8em;
                z-index: 1;
            }

            .beat-indicator {
                position: absolute;
                top: 8px;
                left: 8px;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: var(--error-color);
                opacity: 0;
                transition: opacity 0.1s ease;
                z-index: 1;
            }

            .beat-indicator.active {
                opacity: 1;
            }
        `;
    }

    constructor() {
        super();
        this.mode = 'frequency'; // frequency, waveform, spectrum
        this.fftSize = 2048;
        this.smoothingTimeConstant = 0.8;
        this.minDecibels = -90;
        this.maxDecibels = -10;
        this.colorScheme = 'rainbow';
        this.isActive = false;
        this.beatDetectionEnabled = true;
        this.showFPS = true;

        // Internal properties
        this._audioContext = null;
        this._analyser = null;
        this._dataArray = null;
        this._canvas = null;
        this._canvasCtx = null;
        this._animationFrame = null;
        this._lastFrameTime = 0;
        this._fps = 0;
        this._beatDetector = null;
        this._colorMap = new Map();
    }

    firstUpdated() {
        this._setupCanvas();
        this._setupAudioContext();
        this._setupBeatDetector();
        this._initializeColorMap();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._stopVisualization();
        if (this._audioContext) {
            this._audioContext.close();
        }
    }

    render() {
        return html`
            <div class="visualizer-container">
                <canvas></canvas>
                <div class="controls">
                    <button @click=${() => this.mode = 'frequency'}>
                        Frequency
                    </button>
                    <button @click=${() => this.mode = 'waveform'}>
                        Waveform
                    </button>
                    <button @click=${() => this.mode = 'spectrum'}>
                        Spectrum
                    </button>
                </div>
                ${this.showFPS ? html`
                    <div class="fps-counter">
                        FPS: ${this._fps}
                    </div>
                ` : ''}
                <div class="beat-indicator ${this._beatDetector?.isBeat ? 'active' : ''}"></div>
            </div>
        `;
    }

    _setupCanvas() {
        this._canvas = this.shadowRoot.querySelector('canvas');
        this._canvasCtx = this._canvas.getContext('2d');

        // Set up canvas size with device pixel ratio
        this._resizeCanvas();
        window.addEventListener('resize', () => this._resizeCanvas());
    }

    _resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this._canvas.getBoundingClientRect();

        this._canvas.width = rect.width * dpr;
        this._canvas.height = rect.height * dpr;
        this._canvasCtx.scale(dpr, dpr);
    }

    _setupAudioContext() {
        this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this._analyser = this._audioContext.createAnalyser();

        // Configure analyser
        this._analyser.fftSize = this.fftSize;
        this._analyser.smoothingTimeConstant = this.smoothingTimeConstant;
        this._analyser.minDecibels = this.minDecibels;
        this._analyser.maxDecibels = this.maxDecibels;

        this._dataArray = new Uint8Array(this._analyser.frequencyBinCount);
    }

    _setupBeatDetector() {
        this._beatDetector = {
            threshold: 1.15,
            decay: 0.98,
            energyHistory: new Array(30).fill(0),
            currentEnergy: 0,
            isBeat: false,

            analyze: (dataArray) => {
                let energy = 0;
                // Calculate energy from lower frequencies (bass)
                for (let i = 0; i < 10; i++) {
                    energy += dataArray[i];
                }
                energy /= 10;

                const averageEnergy = this._beatDetector.energyHistory.reduce((a, b) => a + b) /
                    this._beatDetector.energyHistory.length;

                this._beatDetector.isBeat = energy > averageEnergy * this._beatDetector.threshold;

                this._beatDetector.energyHistory.push(energy);
                this._beatDetector.energyHistory.shift();
                this._beatDetector.currentEnergy = energy;
            }
        };
    }

    _initializeColorMap() {
        const schemes = {
            rainbow: [
                [148, 0, 211], [75, 0, 130], [0, 0, 255],
                [0, 255, 0], [255, 255, 0], [255, 127, 0],
                [255, 0, 0]
            ],
            cool: [
                [0, 255, 255], [0, 255, 127], [0, 255, 0],
                [0, 127, 255], [0, 0, 255], [127, 0, 255],
                [255, 0, 255]
            ],
            warm: [
                [255, 0, 0], [255, 127, 0], [255, 255, 0],
                [255, 255, 127], [255, 127, 127], [255, 0, 127],
                [255, 0, 255]
            ]
        };

        this._colorMap.set('rainbow', schemes.rainbow);
        this._colorMap.set('cool', schemes.cool);
        this._colorMap.set('warm', schemes.warm);
    }

    _startVisualization() {
        if (!this.isActive) return;

        const drawFrame = (timestamp) => {
            if (!this.isActive) return;

            // Calculate FPS
            if (this.showFPS) {
                const deltaTime = timestamp - this._lastFrameTime;
                this._fps = Math.round(1000 / deltaTime);
                this._lastFrameTime = timestamp;
            }

            // Get audio data
            switch (this.mode) {
                case 'frequency':
                    this._analyser.getByteFrequencyData(this._dataArray);
                    this._drawFrequencyVisualization();
                    break;
                case 'waveform':
                    this._analyser.getByteTimeDomainData(this._dataArray);
                    this._drawWaveformVisualization();
                    break;
                case 'spectrum':
                    this._analyser.getByteFrequencyData(this._dataArray);
                    this._drawSpectrumVisualization();
                    break;
            }

            // Beat detection
            if (this.beatDetectionEnabled) {
                this._beatDetector.analyze(this._dataArray);
                this.requestUpdate(); // Update beat indicator
            }

            this._animationFrame = requestAnimationFrame(drawFrame);
        };

        this._animationFrame = requestAnimationFrame(drawFrame);
    }

    _stopVisualization() {
        this.isActive = false;
        if (this._animationFrame) {
            cancelAnimationFrame(this._animationFrame);
        }
    }

    _drawFrequencyVisualization() {
        const width = this._canvas.width;
        const height = this._canvas.height;
        const barWidth = width / this._analyser.frequencyBinCount;

        this._canvasCtx.clearRect(0, 0, width, height);

        for (let i = 0; i < this._analyser.frequencyBinCount; i++) {
            const barHeight = (this._dataArray[i] / 255) * height;
            const colorIndex = Math.floor((i / this._analyser.frequencyBinCount) * 7);
            const [r, g, b] = this._colorMap.get(this.colorScheme)[colorIndex];

            this._canvasCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            this._canvasCtx.fillRect(
                i * barWidth,
                height - barHeight,
                barWidth,
                barHeight
            );
        }
    }

    _drawWaveformVisualization() {
        const width = this._canvas.width;
        const height = this._canvas.height;
        const sliceWidth = width / this._analyser.frequencyBinCount;

        this._canvasCtx.clearRect(0, 0, width, height);
        this._canvasCtx.beginPath();
        this._canvasCtx.strokeStyle = `rgb(${this._colorMap.get(this.colorScheme)[0].join(',')})`;
        this._canvasCtx.lineWidth = 2;

        let x = 0;
        for (let i = 0; i < this._analyser.frequencyBinCount; i++) {
            const v = this._dataArray[i] / 128.0;
            const y = (v * height) / 2;

            if (i === 0) {
                this._canvasCtx.moveTo(x, y);
            } else {
                this._canvasCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }

        this._canvasCtx.stroke();
    }

    _drawSpectrumVisualization() {
        const width = this._canvas.width;
        const height = this._canvas.height;

        this._canvasCtx.clearRect(0, 0, width, height);

        const imageData = this._canvasCtx.createImageData(width, height);
        const data = imageData.data;

        for (let i = 0; i < this._analyser.frequencyBinCount; i++) {
            const value = this._dataArray[i];
            const colorIndex = Math.floor((value / 255) * 6);
            const [r, g, b] = this._colorMap.get(this.colorScheme)[colorIndex];

            for (let y = 0; y < height; y++) {
                const index = (y * width + i) * 4;
                data[index] = r;
                data[index + 1] = g;
                data[index + 2] = b;
                data[index + 3] = 255;
            }
        }

        this._canvasCtx.putImageData(imageData, 0, 0);
    }

    // Public methods for external control
    setAudioSource(sourceNode) {
        sourceNode.connect(this._analyser);
        this.isActive = true;
        this._startVisualization();
    }

    disconnectAudioSource() {
        this._analyser.disconnect();
        this.isActive = false;
        this._stopVisualization();
    }

    updateAnalyserSettings(settings) {
        Object.assign(this, settings);
        if (this._analyser) {
            this._analyser.fftSize = this.fftSize;
            this._analyser.smoothingTimeConstant = this.smoothingTimeConstant;
            this._analyser.minDecibels = this.minDecibels;
            this._analyser.maxDecibels = this.maxDecibels;
            this._dataArray = new Uint8Array(this._analyser.frequencyBinCount);
        }
    }
}

customElements.define('aurora-visualizer', AuroraVisualizer); 