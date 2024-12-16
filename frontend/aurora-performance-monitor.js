import {
    LitElement,
    html,
    css,
} from "lit-element";
import { Chart } from 'chart.js/auto';

class AuroraPerformanceMonitor extends LitElement {
    static get properties() {
        return {
            hass: { type: Object },
            _metrics: { type: Object },
            _updateInterval: { type: Number },
            _historyData: { type: Array },
            _chart: { type: Object },
            _expanded: { type: Boolean },
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
                transition: transform 0.2s ease-in-out;
                cursor: pointer;
            }
            .metric-card:hover {
                transform: translateY(-2px);
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
                transition: background-color 0.3s ease;
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
                height: 0;
                overflow: hidden;
                transition: height 0.3s ease-in-out;
            }
            .chart-container.expanded {
                height: 300px;
                margin-top: 16px;
            }
            .chart-wrapper {
                position: relative;
                height: 100%;
            }
            .controls {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 16px;
            }
            .button {
                background: var(--primary-color);
                color: var(--text-primary-color);
                padding: 8px 16px;
                border-radius: 4px;
                border: none;
                cursor: pointer;
                transition: background 0.2s ease;
            }
            .button:hover {
                background: var(--primary-color-light);
            }
            .tooltip {
                position: absolute;
                background: var(--card-background-color);
                padding: 8px;
                border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                display: none;
            }
            .metric-card:hover .tooltip {
                display: block;
            }
            .optimization-tips {
                margin-top: 16px;
                padding: 16px;
                background: var(--primary-background-color);
                border-radius: 8px;
                display: none;
            }
            .optimization-tips.show {
                display: block;
            }
            .tip-item {
                margin: 8px 0;
                display: flex;
                align-items: center;
            }
            .tip-icon {
                margin-right: 8px;
                color: var(--primary-color);
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
        this._historyData = {
            latency: [],
            cpuUsage: [],
            memoryUsage: [],
            audioBufferHealth: [],
            timestamps: []
        };
        this._expanded = false;
        this._chart = null;
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
        if (this._chart) {
            this._chart.destroy();
        }
    }

    async _startMetricsUpdate() {
        await this._updateMetrics();
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

            // Update history data
            const timestamp = new Date();
            this._historyData.timestamps.push(timestamp);
            this._historyData.latency.push(this._metrics.latency);
            this._historyData.cpuUsage.push(this._metrics.cpuUsage);
            this._historyData.memoryUsage.push(this._metrics.memoryUsage);
            this._historyData.audioBufferHealth.push(this._metrics.audioBufferHealth);

            // Keep last 60 seconds of data
            if (this._historyData.timestamps.length > 60) {
                this._historyData.timestamps.shift();
                this._historyData.latency.shift();
                this._historyData.cpuUsage.shift();
                this._historyData.memoryUsage.shift();
                this._historyData.audioBufferHealth.shift();
            }

            if (this._expanded) {
                this._updateChart();
            }

            this.requestUpdate();
        } catch (error) {
            console.error('Failed to fetch metrics:', error);
        }
    }

    _getStatusClass(value, thresholds) {
        if (value >= thresholds.error) return 'status-error';
        if (value >= thresholds.warning) return 'status-warning';
        return 'status-good';
    }

    _getOptimizationTips() {
        const tips = [];

        if (this._metrics.latency > 50) {
            tips.push({
                icon: '⚡',
                text: 'High latency detected. Try reducing the buffer size or check network connectivity.'
            });
        }

        if (this._metrics.cpuUsage > 70) {
            tips.push({
                icon: '🔄',
                text: 'High CPU usage. Consider reducing the number of active effects or frequency bands.'
            });
        }

        if (this._metrics.memoryUsage > 80) {
            tips.push({
                icon: '💾',
                text: 'High memory usage. Try closing unused browser tabs or applications.'
            });
        }

        if (this._metrics.audioBufferHealth < 90) {
            tips.push({
                icon: '🎵',
                text: 'Audio buffer health is low. Check audio input settings and system resources.'
            });
        }

        return tips;
    }

    _toggleExpanded() {
        this._expanded = !this._expanded;
        if (this._expanded) {
            this._initChart();
        }
        this.requestUpdate();
    }

    _initChart() {
        const ctx = this.shadowRoot.querySelector('#performanceChart').getContext('2d');

        if (this._chart) {
            this._chart.destroy();
        }

        this._chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: this._historyData.timestamps.map(t => t.toLocaleTimeString()),
                datasets: [
                    {
                        label: 'Latency (ms)',
                        data: this._historyData.latency,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    },
                    {
                        label: 'CPU Usage (%)',
                        data: this._historyData.cpuUsage,
                        borderColor: 'rgb(255, 99, 132)',
                        tension: 0.1
                    },
                    {
                        label: 'Memory Usage (%)',
                        data: this._historyData.memoryUsage,
                        borderColor: 'rgb(255, 205, 86)',
                        tension: 0.1
                    },
                    {
                        label: 'Buffer Health (%)',
                        data: this._historyData.audioBufferHealth,
                        borderColor: 'rgb(54, 162, 235)',
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 0
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    _updateChart() {
        if (!this._chart) return;

        this._chart.data.labels = this._historyData.timestamps.map(t => t.toLocaleTimeString());
        this._chart.data.datasets[0].data = this._historyData.latency;
        this._chart.data.datasets[1].data = this._historyData.cpuUsage;
        this._chart.data.datasets[2].data = this._historyData.memoryUsage;
        this._chart.data.datasets[3].data = this._historyData.audioBufferHealth;
        this._chart.update('none');
    }

    render() {
        const tips = this._getOptimizationTips();

        return html`
            <div class="metrics-grid">
                <div class="metric-card" @click=${() => this._toggleExpanded()}>
                    <div class="metric-label">Latency</div>
                    <div class="metric-value">
                        <span class="status-indicator ${this._getStatusClass(this._metrics.latency, { warning: 50, error: 100 })}"></span>
                        ${this._metrics.latency.toFixed(1)}ms
                    </div>
                    <div class="tooltip">Click to view performance history</div>
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

            <div class="chart-container ${this._expanded ? 'expanded' : ''}">
                <div class="chart-wrapper">
                    <canvas id="performanceChart"></canvas>
                </div>
            </div>

            ${tips.length > 0 ? html`
                <div class="optimization-tips show">
                    ${tips.map(tip => html`
                        <div class="tip-item">
                            <span class="tip-icon">${tip.icon}</span>
                            <span>${tip.text}</span>
                        </div>
                    `)}
                </div>
            ` : ''}

            <div class="controls">
                <button class="button" @click=${this._toggleExpanded}>
                    ${this._expanded ? 'Hide' : 'Show'} Performance History
                </button>
            </div>
        `;
    }
}

customElements.define("aurora-performance-monitor", AuroraPerformanceMonitor); 