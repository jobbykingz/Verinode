const client = require('prom-client');

class MetricsCollector {
  constructor() {
    this.register = new client.Registry();
    this.register.setDefaultLabels({
      app: 'verinode-backend'
    });
    client.collectDefaultMetrics({ register: this.register });
  }

  getRegistry() {
    return this.register;
  }

  async getMetrics() {
    return this.register.metrics();
  }
}

const metricsCollector = new MetricsCollector();
module.exports = { metricsCollector };