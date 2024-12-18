import {
    LitElement,
    html,
    css,
} from "https://cdn.jsdelivr.net/gh/lit/dist@2/core/lit-core.min.js";

// Initialize Chart.js when the component loads
let chartInitialized = false;

function initializeChart() {
    if (chartInitialized || !window.Chart) return;

    const { Chart } = window;
    // Register all required components
    Chart.register(
        Chart.LineController,
        Chart.LineElement,
        Chart.PointElement,
        Chart.LinearScale,
        Chart.TimeScale,
        Chart.CategoryScale,
        Chart.Legend,
        Chart.Title,
        Chart.Tooltip,
        Chart.Filler
    );

    chartInitialized = true;
}

export class AuroraPerformanceMonitor extends LitElement {
    static get properties() {
        return {
            hass: { type: Object },
            _metrics: { type: Object, state: true },
            _expanded: { type: Boolean, state: true },
            _showChart: { type: Boolean, state: true },
            _updateInterval: { type: Number, state: true },
            alerts: { type: Array, state: true }
        };
    }

    constructor() {
        super();
        // Initialize Chart.js components
        initializeChart();

        this._metrics = {
            latency: 0,
            cpuUsage: 0,
            memoryUsage: 0,
            timestamp: Date.now()
        };
        this._expanded = false;
        this._showChart = false;
        this._updateInterval = null;
        this._history = {
            timestamps: [],
            latency: [],
            cpuUsage: [],
            memoryUsage: []
        };
        this._maxHistoryLength = 50;
        this._chart = null;
        this.alerts = [];
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('hass') && this.hass) {
            if (!this._updateInterval) {
                this._startMetricsUpdate();
            }
        }
    }

    connectedCallback() {
        super.connectedCallback();
        if (this.hass) {
            this._startMetricsUpdate();
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._stopMetricsUpdate();
        if (this._chart) {
            this._chart.destroy();
            this._chart = null;
        }
    }

    _startMetricsUpdate() {
        if (!this.hass) return;
        this._updateMetrics();
        this._updateInterval = setInterval(() => {
            this._updateMetrics();
        }, 5000);
    }

    _stopMetricsUpdate() {
        if (this._updateInterval) {
            clearInterval(this._updateInterval);
            this._updateInterval = null;
        }
    }

    async _updateMetrics() {
        if (!this.hass) return;

        try {
            const response = await this.hass.callWS({
                type: 'aurora_sound_to_light/get_performance_metrics'
            });

            // Extract metrics from the response
            const metrics = response.metrics || response;

            this._metrics = {
                latency: metrics.latency || 0,
                cpuUsage: metrics.cpuUsage || 0,
                memoryUsage: metrics.memoryUsage || 0,
                timestamp: metrics.timestamp || Date.now()
            };

            // Update alerts based on thresholds
            this.alerts = [];
            if (this._metrics.cpuUsage > 80) {
                this.alerts.push('High CPU Usage');
            }
            if (this._metrics.memoryUsage > 85) {
                this.alerts.push('High Memory Usage');
            }
            if (this._metrics.latency > 200) {
                this.alerts.push('High Latency');
            }

            this._updateHistory(this._metrics);

            if (this._expanded && this._chart) {
                this._updateChart();
            }

            this.requestUpdate();
        } catch (error) {
            console.error('Failed to update metrics:', error);
            // On error, use the mock metrics if they're available
            if (this.hass.metrics) {
                this._metrics = {
                    latency: this.hass.metrics.latency || 0,
                    cpuUsage: this.hass.metrics.cpuUsage || 0,
                    memoryUsage: this.hass.metrics.memoryUsage || 0,
                    timestamp: this.hass.metrics.timestamp || Date.now()
                };
                this._updateHistory(this._metrics);
                this.requestUpdate();
            }
            this.dispatchEvent(new CustomEvent('error', {
                detail: { message: error.message }
            }));
        }
    }

    _updateHistory(metrics) {
        if (!this._history) {
            this._history = {
                timestamps: [],
                latency: [],
                cpuUsage: [],
                memoryUsage: []
            };
        }

        this._history.timestamps.push(new Date(metrics.timestamp));
        this._history.latency.push(metrics.latency);
        this._history.cpuUsage.push(metrics.cpuUsage);
        this._history.memoryUsage.push(metrics.memoryUsage);

        if (this._history.timestamps.length > this._maxHistoryLength) {
            this._history.timestamps.shift();
            this._history.latency.shift();
            this._history.cpuUsage.shift();
            this._history.memoryUsage.shift();
        }
    }

    _getStatusClass(value, thresholds) {
        if (value >= thresholds.high) return 'status-high';
        if (value >= thresholds.medium) return 'status-medium';
        return 'status-normal';
    }

    _toggleExpanded() {
        this._expanded = !this._expanded;
        if (this._expanded) {
            this.updateComplete.then(() => this._initChart());
        } else if (this._chart) {
            this._chart.destroy();
            this._chart = null;
        }
        this.requestUpdate();
    }

    async _initChart() {
        // Make sure Chart.js is initialized
        initializeChart();
        if (!window.Chart) {
            console.error('Chart.js is not available');
            return;
        }

        const canvas = this.shadowRoot.querySelector('#performanceChart');
        if (!canvas) {
            console.error('Canvas element not found');
            return;
        }

        const ctx = canvas.getContext('2d');
        if (this._chart) {
            this._chart.destroy();
        }

        try {
            this._chart = new window.Chart(ctx, {
                type: 'line',
                data: {
                    labels: this._history.timestamps,
                    datasets: [
                        {
                            label: 'Latency (ms)',
                            data: this._history.latency,
                            borderColor: 'rgb(75, 192, 192)',
                            backgroundColor: 'rgba(75, 192, 192, 0.1)',
                            tension: 0.1,
                            fill: true
                        },
                        {
                            label: 'CPU Usage (%)',
                            data: this._history.cpuUsage,
                            borderColor: 'rgb(255, 99, 132)',
                            backgroundColor: 'rgba(255, 99, 132, 0.1)',
                            tension: 0.1,
                            fill: true
                        },
                        {
                            label: 'Memory Usage (%)',
                            data: this._history.memoryUsage,
                            borderColor: 'rgb(153, 102, 255)',
                            backgroundColor: 'rgba(153, 102, 255, 0.1)',
                            tension: 0.1,
                            fill: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 750,
                        easing: 'easeInOutQuart'
                    },
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'second',
                                displayFormats: {
                                    second: 'HH:mm:ss'
                                }
                            },
                            title: {
                                display: true,
                                text: 'Time'
                            },
                            grid: {
                                display: true,
                                color: 'rgba(0,0,0,0.1)'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Value'
                            },
                            grid: {
                                display: true,
                                color: 'rgba(0,0,0,0.1)'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                padding: 15
                            }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(0,0,0,0.7)',
                            padding: 10,
                            cornerRadius: 4,
                            titleColor: 'white',
                            bodyColor: 'white',
                            borderColor: 'white',
                            borderWidth: 1
                        }
                    },
                    interaction: {
                        mode: 'nearest',
                        axis: 'x',
                        intersect: false
                    }
                }
            });
        } catch (error) {
            console.error('Failed to initialize chart:', error);
        }
    }

    _updateChart() {
        if (!this._chart) return;

        this._chart.data.labels = this._history.timestamps;
        this._chart.data.datasets[0].data = this._history.latency;
        this._chart.data.datasets[1].data = this._history.cpuUsage;
        this._chart.data.datasets[2].data = this._history.memoryUsage;
        this._chart.update('none'); // Use 'none' mode for better performance
    }

    render() {
        if (!this.hass) return html`<div>Loading...</div>`;

        return html`
            <div class="monitor ${this._expanded ? 'expanded' : ''}">
                <div class="header" @click=${this._toggleExpanded}>
                    <h3>Performance Monitor</h3>
                    <span class="toggle">${this._expanded ? '▼' : '▶'}</span>
                </div>
                <div class="metrics">
                    <div class="metric ${this._getStatusClass(this._metrics.latency, { medium: 100, high: 200 })}">
                        <span class="label">Latency</span>
                        <span class="value">${this._metrics.latency}ms</span>
                    </div>
                    <div class="metric ${this._getStatusClass(this._metrics.cpuUsage, { medium: 50, high: 80 })}">
                        <span class="label">CPU Usage</span>
                        <span class="value">${this._metrics.cpuUsage}%</span>
                    </div>
                    <div class="metric ${this._getStatusClass(this._metrics.memoryUsage, { medium: 60, high: 85 })}">
                        <span class="label">Memory</span>
                        <span class="value">${this._metrics.memoryUsage}%</span>
                    </div>
                </div>
                ${this._expanded ? html`
                    <div class="chart-container">
                        <canvas id="performanceChart"></canvas>
                    </div>
                ` : ''}
            </div>
        `;
    }

    static get styles() {
        return css`
            :host {
                display: block;
                margin: 16px;
            }

            .monitor {
                background: var(--card-background-color, #fff);
                border-radius: 8px;
                box-shadow: var(--ha-card-box-shadow, 0 2px 2px rgba(0, 0, 0, 0.1));
                padding: 16px;
                transition: all 0.3s ease;
            }

            .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
                user-select: none;
            }

            .metrics {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 16px;
                margin-top: 16px;
                transition: all 0.3s ease;
            }

            .metric {
                padding: 12px;
                border-radius: 4px;
                display: flex;
                flex-direction: column;
                align-items: center;
                transition: all 0.3s ease;
            }

            .status-normal {
                background-color: var(--success-color, #4CAF50);
                color: white;
            }

            .status-medium {
                background-color: var(--warning-color, #FF9800);
                color: white;
            }

            .status-high {
                background-color: var(--error-color, #F44336);
                color: white;
            }

            .label {
                font-size: 0.9em;
                opacity: 0.9;
            }

            .value {
                font-size: 1.2em;
                font-weight: bold;
                margin-top: 4px;
            }

            .chart-container {
                margin-top: 16px;
                height: 300px;
                transition: all 0.3s ease;
            }

            .expanded {
                height: auto;
            }

            .toggle {
                font-size: 1.2em;
                transition: transform 0.3s ease;
            }

            .expanded .toggle {
                transform: rotate(180deg);
            }

            @media (max-width: 600px) {
                .metrics {
                    grid-template-columns: 1fr;
                }

                .chart-container {
                    height: 200px;
                }
            }
        `;
    }
}

customElements.define('aurora-performance-monitor', AuroraPerformanceMonitor); 