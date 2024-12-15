import {
    LitElement,
    html,
    css,
} from "lit-element";

class AuroraPerformanceMonitor extends LitElement {
    static get properties() {
        return {
            hass: { type: Object },
            _metrics: { type: Object },
            _updateInterval: { type: Number },
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
            .metrics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 16px;
                margin-bottom: 16px;
            }
            .metric-card {
                background: var(--primary-background-color);
                padding: 16px;
                border-radius: 8px;
                text-align: center;
            }
            .metric-value {
                font-size: 24px;
                font-weight: bold;
                margin: 8px 0;
            }
            .metric-label {
                font-size: 14px;
                color: var(--secondary-text-color);
            }
            .status-indicator {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                display: inline-block;
                margin-right: 8px;
            }
            .status-good {
                background-color: var(--success-color);
            }
            .status-warning {
                background-color: var(--warning-color);
            }
            .status-error {
                background-color: var(--error-color);
            }
            .chart-container {
                height: 200px;
                margin-top: 16px;
            }
        `;
    }

    constructor() {
        super();
        this._metrics = {
            latency: 0,
            cpuUsage: 0,
            memoryUsage: 0,
            audioBufferHealth: 100,
            systemStatus: 'good'
        };
        this._updateInterval = null;
    }

    connectedCallback() {
        super.connectedCallback();
        this._startMetricsUpdate();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._updateInterval) {
            clearInterval(this._updateInterval);
        }
    }

    async _startMetricsUpdate() {
        this._updateMetrics();
        this._updateInterval = setInterval(() => this._updateMetrics(), 1000);
    }

    async _updateMetrics() {
        if (!this.hass) return;

        try {
            const response = await this.hass.callWS({
                type: 'aurora_sound_to_light/get_metrics'
            });

            this._metrics = {
                ...this._metrics,
                ...response
            };
        } catch (error) {
            console.error('Failed to fetch metrics:', error);
        }
    }

    _getStatusClass(value, thresholds) {
        if (value >= thresholds.error) return 'status-error';
        if (value >= thresholds.warning) return 'status-warning';
        return 'status-good';
    }

    render() {
        return html`
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-label">Latency</div>
                    <div class="metric-value">
                        <span class="status-indicator ${this._getStatusClass(this._metrics.latency, { warning: 50, error: 100 })}"></span>
                        ${this._metrics.latency.toFixed(1)}ms
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-label">CPU Usage</div>
                    <div class="metric-value">
                        <span class="status-indicator ${this._getStatusClass(this._metrics.cpuUsage, { warning: 70, error: 90 })}"></span>
                        ${this._metrics.cpuUsage.toFixed(1)}%
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-label">Memory Usage</div>
                    <div class="metric-value">
                        <span class="status-indicator ${this._getStatusClass(this._metrics.memoryUsage, { warning: 70, error: 90 })}"></span>
                        ${this._metrics.memoryUsage.toFixed(1)}%
                    </div>
                </div>

                <div class="metric-card">
                    <div class="metric-label">Buffer Health</div>
                    <div class="metric-value">
                        <span class="status-indicator ${this._getStatusClass(100 - this._metrics.audioBufferHealth, { warning: 30, error: 60 })}"></span>
                        ${this._metrics.audioBufferHealth.toFixed(1)}%
                    </div>
                </div>
            </div>

            <div class="chart-container">
                <!-- TODO: Add performance history chart -->
            </div>
        `;
    }
}

customElements.define("aurora-performance-monitor", AuroraPerformanceMonitor); 