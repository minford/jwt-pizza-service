const config = require('./config.js');
const os = require('os');
const logger = require('./logger.js');

class MetricBuilder {
    constructor() {
        this.metrics = [];
    }

    toString(delim = '\n') {
        return this.metrics.join(delim);
    }

    addMetric(metric) {
        this.metrics.push(metric);
    }
}

class Metrics {
    constructor() {
        this.requests = {};
        this.requestDurations = {};
        this.authAttempts = { success: 0, failure: 0 };
        this.userCounts = { created: 0, active: 0 };
        this.purchases = {
            count: 0,
            successful: 0,
            failed: 0,
            totalCost: 0,
        };
    }

    startPeriodicReporting(period) {
        setInterval(() => {
            try {
                Promise.all([
                    this.collectHttpMetrics(),
                    this.collectSystemMetrics(),
                    this.collectUserMetrics(),
                    this.collectAuthMetrics(),
                    this.collectPurchaseMetrics()
                ]).catch(error => {
                    console.error('Error sending metrics batch:', error);
                });
            } catch (error) {
                logger.log('error', 'metrics', { msg: 'Error sending metrics', err: { msg: error.message, stack: error.stack } });
            }
        }, period);
    }

    metricsReporter(req, res) {
        res.send(this.getMetrics());
    }

    getMetrics(delim = '\n') {
        const buf = new MetricBuilder();
        this.httpMetrics(buf);
        this.systemMetrics(buf);
        this.userMetrics(buf);
        this.purchaseMetrics(buf);
        this.authMetrics(buf);

        return buf.toString(delim);
    }

    requestTracker(req, res, next) {
        const start = Date.now();
        const endpoint = `${req.method} ${req.path}`;

        this.requests[endpoint] = (this.requests[endpoint] || 0) + 1;

        res.on('finish', () => {
            const duration = Date.now() - start;
            if (!this.requestDurations[endpoint]) {
                this.requestDurations[endpoint] = [];
            }
            this.requestDurations[endpoint].push(duration);

            const statusCode = res.statusCode;
            const statusCategory = Math.floor(statusCode / 100) * 100;
            this.trackStatusCode(endpoint, statusCategory);
        });

        next();
    }

    trackStatusCode(endpoint, statusCategory) {
        const metricName = `status_${statusCategory}`;
        if (!this[metricName]) {
            this[metricName] = {};
        }
        this[metricName][endpoint] = (this[metricName][endpoint] || 0) + 1;
    }

    trackNewUser() {
        this.userCounts.created++;
        this.userCounts.active++;
    }

    setActiveUsers(count) {
        this.userCounts.active = count;
    }

    trackPurchase(successful, cost) {
        this.purchases.count++;

        if (successful) {
            this.purchases.successful++;
            this.purchases.totalCost += cost;
        } else {
            this.purchases.failed++;
        }

    }

    collectHttpMetrics() {
        const promises = [];

        Object.keys(this.requests).forEach((endpoint) => {
            promises.push(
                this.sendMetricToGrafana('http_requests_total', this.requests[endpoint], 'sum', 'count', { endpoint })
            );
        });

        Object.keys(this.requestDurations).forEach((endpoint) => {
            if (this.requestDurations[endpoint].length > 0) {
                const avgDuration = this.calculateAverage(this.requestDurations[endpoint]);
                promises.push(
                    this.sendMetricToGrafana('http_request_duration_ms', avgDuration, 'gauge', 'ms', { endpoint })
                );
                this.requestDurations[endpoint] = []; // Reset after reporting
            }
        });

        ['status_200', 'status_300', 'status_400', 'status_500'].forEach(statusMetric => {
            if (this[statusMetric]) {
                Object.keys(this[statusMetric]).forEach(endpoint => {
                    promises.push(
                        this.sendMetricToGrafana(statusMetric, this[statusMetric][endpoint], 'sum', 'count', { endpoint })
                    );
                });
            }
        });

        return Promise.all(promises);
    }

    collectSystemMetrics() {
        const cpu = this.getCpuUsagePercentage();
        const memory = this.getMemoryUsagePercentage();

        return Promise.all([
            this.sendMetricToGrafana('system_cpu_usage_percent', cpu, 'gauge', 'percent'),
            this.sendMetricToGrafana('system_memory_usage_percent', memory, 'gauge', 'percent')
        ]);
    }

    collectUserMetrics() {
        return Promise.all([
            this.sendMetricToGrafana('users_created_total', this.userCounts.created, 'sum', 'count'),
            this.sendMetricToGrafana('users_active', this.userCounts.active, 'gauge', 'count')
        ]);
    }

    collectAuthMetrics() {
        return Promise.all([
            this.sendMetricToGrafana('auth_success_total', this.authAttempts.success, 'sum', 'count'),
            this.sendMetricToGrafana('auth_failure_total', this.authAttempts.failure, 'sum', 'count')
        ]);
    }

    collectPurchaseMetrics() {
        const promises = [
            this.sendMetricToGrafana('purchases_total', this.purchases.count, 'sum', 'count'),
            this.sendMetricToGrafana('purchases_successful', this.purchases.successful, 'sum', 'count'),
            this.sendMetricToGrafana('purchases_failed', this.purchases.failed, 'sum', 'count'),
            this.sendMetricToGrafana('purchases_total_cost', this.purchases.totalCost, 'sum', 'currency')
        ];


        return Promise.all(promises);
    }

    getCpuUsagePercentage() {
        const cpuUsage = os.loadavg()[0] / os.cpus().length;
        return cpuUsage.toFixed(2) * 100;
    }

    getMemoryUsagePercentage() {
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;
        const memoryUsage = (usedMemory / totalMemory) * 100;
        return memoryUsage.toFixed(2);
    }

    sendMetricToGrafana(metricName, metricValue, type, unit) {
        const metric = {
            resourceMetrics: [
                {
                    scopeMetrics: [
                        {
                            metrics: [
                                {
                                    name: metricName,
                                    unit: unit,
                                    [type]: {
                                        dataPoints: [
                                            {
                                                asInt: metricValue,
                                                timeUnixNano: Date.now() * 1000000,
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                },
            ],
        };

        if (type === 'sum') {
            metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].aggregationTemporality = 'AGGREGATION_TEMPORALITY_CUMULATIVE';
            metric.resourceMetrics[0].scopeMetrics[0].metrics[0][type].isMonotonic = true;
        }

        const body = JSON.stringify(metric);
        fetch(`${config.url}`, {
            method: 'POST',
            body: body,
            headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
        })
            .then((response) => {
                if (!response.ok) {
                    response.text().then((text) => {
                        console.error(`Failed to push metrics data to Grafana: ${text}\n${body}`);
                    });
                } else {
                    console.log(`Pushed ${metricName}`);
                }
            })
            .catch((error) => {
                console.error('Error pushing metrics:', error);
            });
    }

    calculateAverage(arr) {
        const sum = arr.reduce((a, b) => a + b, 0);
        return sum / arr.length;
    }
}

module.exports = new Metrics();
