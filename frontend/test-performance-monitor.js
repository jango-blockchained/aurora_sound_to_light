// Test script for Aurora Performance Monitor
class TestLogger {
    constructor() {
        this.logs = [];
        this.startTime = new Date();
        this.testResults = {
            scenarios: {},
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                warnings: 0
            }
        };
    }

    log(message, level = 'info', scenario = null) {
        const entry = {
            timestamp: new Date(),
            level,
            message,
            scenario
        };
        this.logs.push(entry);
        console.log(`[${level.toUpperCase()}] ${message}`);
    }

    recordTestResult(scenario, result) {
        this.testResults.scenarios[scenario] = {
            ...result,
            timestamp: new Date()
        };
        this.testResults.summary.total++;
        if (result.status === 'passed') this.testResults.summary.passed++;
        if (result.status === 'failed') this.testResults.summary.failed++;
        if (result.warnings.length > 0) this.testResults.summary.warnings += result.warnings.length;
    }

    async saveReport() {
        const report = {
            testRun: {
                startTime: this.startTime,
                endTime: new Date(),
                duration: new Date() - this.startTime
            },
            results: this.testResults,
            logs: this.logs
        };

        // Format the report as text
        let reportText = '=== Aurora Performance Monitor Test Report ===\n\n';
        reportText += `Test Run: ${report.testRun.startTime.toISOString()}\n`;
        reportText += `Duration: ${report.testRun.duration}ms\n\n`;

        reportText += '=== Summary ===\n';
        reportText += `Total Tests: ${report.results.summary.total}\n`;
        reportText += `Passed: ${report.results.summary.passed}\n`;
        reportText += `Failed: ${report.results.summary.failed}\n`;
        reportText += `Warnings: ${report.results.summary.warnings}\n\n`;

        reportText += '=== Detailed Results ===\n';
        for (const [scenario, result] of Object.entries(report.results.scenarios)) {
            reportText += `\nScenario: ${scenario}\n`;
            reportText += `Status: ${result.status}\n`;
            reportText += `Metrics:\n`;
            for (const [metric, value] of Object.entries(result.metrics)) {
                reportText += `  ${metric}: ${value}\n`;
            }
            if (result.warnings.length > 0) {
                reportText += 'Warnings:\n';
                result.warnings.forEach(w => reportText += `  - ${w}\n`);
            }
            if (result.errors.length > 0) {
                reportText += 'Errors:\n';
                result.errors.forEach(e => reportText += `  - ${e}\n`);
            }
        }

        reportText += '\n=== Logs ===\n';
        this.logs.forEach(log => {
            reportText += `${log.timestamp.toISOString()} [${log.level.toUpperCase()}] ${log.scenario ? `[${log.scenario}] ` : ''}${log.message}\n`;
        });

        // Save report to file using Home Assistant WebSocket API
        try {
            const response = await window.testPerformanceMonitor.mockHass.callWS({
                type: 'aurora_sound_to_light/save_test_report',
                report: reportText
            });
            console.log('Test report saved:', response.path);
            return response.path;
        } catch (error) {
            console.error('Failed to save test report:', error);
            // Fallback: Download as file in browser
            const blob = new Blob([reportText], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `aurora-test-report-${new Date().toISOString()}.txt`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }
    }
}

class MockHomeAssistant {
    constructor() {
        this.metrics = {
            audioLatency: 20,
            lightLatency: 50,
            cpuUsage: 30,
            memoryUsage: 45,
            activeGroups: 2,
            activeEffects: 3,
            networkLatency: 15,
            bufferHealth: 95,
            dropoutRate: 0.1
        };
        this.logger = new TestLogger();
    }

    async callWS(params) {
        if (params.type === 'aurora_sound_to_light/get_performance_metrics') {
            // Simulate some random variations in metrics
            this.metrics = {
                audioLatency: this._vary(this.metrics.audioLatency, 5, 10, 100),
                lightLatency: this._vary(this.metrics.lightLatency, 10, 20, 200),
                cpuUsage: this._vary(this.metrics.cpuUsage, 5, 0, 100),
                memoryUsage: this._vary(this.metrics.memoryUsage, 3, 0, 100),
                activeGroups: Math.max(1, Math.min(5, this.metrics.activeGroups + (Math.random() > 0.8 ? Math.random() > 0.5 ? 1 : -1 : 0))),
                activeEffects: Math.max(1, Math.min(8, this.metrics.activeEffects + (Math.random() > 0.8 ? Math.random() > 0.5 ? 1 : -1 : 0))),
                networkLatency: this._vary(this.metrics.networkLatency, 5, 5, 500),
                bufferHealth: this._vary(this.metrics.bufferHealth, 2, 0, 100),
                dropoutRate: Math.max(0, Math.min(100, this.metrics.dropoutRate + (Math.random() - 0.5) * 0.2))
            };

            return { metrics: this.metrics };
        } else if (params.type === 'aurora_sound_to_light/save_test_report') {
            // Simulate saving report to disk
            return { path: `/config/test-reports/${new Date().toISOString()}-test-report.txt` };
        }
        throw new Error(`Unknown WebSocket command: ${params.type}`);
    }

    _vary(value, maxChange, min, max) {
        const change = (Math.random() - 0.5) * 2 * maxChange;
        return Math.max(min, Math.min(max, value + change));
    }
}

// Test scenarios with enhanced validation
const testScenarios = [
    {
        name: 'Normal Operation',
        duration: 10000,
        setup: (mock) => {
            // Default metrics are already set for normal operation
            mock.logger.log('Setting up Normal Operation scenario', 'info', 'Normal Operation');
        },
        validate: (metrics, monitor) => {
            const warnings = [];
            const errors = [];

            if (metrics.cpuUsage > 50) warnings.push('CPU usage higher than expected for normal operation');
            if (metrics.audioLatency > 30) warnings.push('Audio latency higher than optimal');

            return {
                status: errors.length === 0 ? 'passed' : 'failed',
                metrics,
                warnings,
                errors
            };
        }
    },
    {
        name: 'High CPU Load',
        duration: 10000,
        setup: (mock) => {
            mock.metrics.cpuUsage = 85;
            mock.metrics.memoryUsage = 75;
            mock.metrics.audioLatency = 40;
            mock.logger.log('Setting up High CPU Load scenario', 'info', 'High CPU Load');
        },
        validate: (metrics, monitor) => {
            const warnings = [];
            const errors = [];

            if (metrics.cpuUsage < 70) errors.push('CPU load not high enough for scenario');
            if (monitor.alerts.length === 0) warnings.push('No alerts generated for high CPU usage');

            return {
                status: errors.length === 0 ? 'passed' : 'failed',
                metrics,
                warnings,
                errors
            };
        }
    },
    {
        name: 'Network Issues',
        duration: 10000,
        setup: (mock) => {
            mock.metrics.networkLatency = 250;
            mock.metrics.bufferHealth = 60;
            mock.metrics.dropoutRate = 2.5;
            mock.logger.log('Setting up Network Issues scenario', 'info', 'Network Issues');
        },
        validate: (metrics, monitor) => {
            const warnings = [];
            const errors = [];

            if (metrics.networkLatency < 200) errors.push('Network latency not high enough for scenario');
            if (metrics.bufferHealth > 70) warnings.push('Buffer health too good for network issues scenario');

            return {
                status: errors.length === 0 ? 'passed' : 'failed',
                metrics,
                warnings,
                errors
            };
        }
    },
    {
        name: 'Critical System Load',
        duration: 10000,
        setup: (mock) => {
            mock.metrics.cpuUsage = 95;
            mock.metrics.memoryUsage = 90;
            mock.metrics.audioLatency = 150;
            mock.metrics.lightLatency = 200;
            mock.metrics.bufferHealth = 20;
            mock.logger.log('Setting up Critical System Load scenario', 'info', 'Critical System Load');
        },
        validate: (metrics, monitor) => {
            const warnings = [];
            const errors = [];

            if (metrics.cpuUsage < 90) errors.push('CPU usage not critical enough for scenario');
            if (monitor.alerts.length === 0) errors.push('No alerts generated for critical system load');
            if (metrics.bufferHealth > 30) warnings.push('Buffer health too good for critical scenario');

            return {
                status: errors.length === 0 ? 'passed' : 'failed',
                metrics,
                warnings,
                errors
            };
        }
    }
];

// Enhanced test runner
async function runTests() {
    const mockHass = new MockHomeAssistant();
    window.testPerformanceMonitor.mockHass = mockHass;
    const monitor = document.createElement('aurora-performance-monitor');
    monitor.hass = mockHass;
    document.body.appendChild(monitor);

    mockHass.logger.log('Starting Performance Monitor tests...', 'info');

    for (const scenario of testScenarios) {
        mockHass.logger.log(`Running scenario: ${scenario.name}`, 'info', scenario.name);
        scenario.setup(mockHass);

        // Wait for scenario duration
        await new Promise(resolve => setTimeout(resolve, scenario.duration));

        // Validate scenario results
        const result = scenario.validate(mockHass.metrics, monitor);
        mockHass.logger.recordTestResult(scenario.name, result);

        // Log results
        mockHass.logger.log(
            `Scenario ${scenario.name} ${result.status} (Warnings: ${result.warnings.length}, Errors: ${result.errors.length})`,
            result.status === 'passed' ? 'success' : 'error',
            scenario.name
        );
    }

    mockHass.logger.log('Tests completed', 'info');

    // Generate and save test report
    const reportPath = await mockHass.logger.saveReport();
    mockHass.logger.log(`Test report saved to: ${reportPath}`, 'info');
}

// Run tests when the page loads
window.addEventListener('load', runTests);

// Export for manual testing
window.testPerformanceMonitor = {
    runTests,
    MockHomeAssistant,
    testScenarios
}; 