const { logger } = require('../middleware/logging');

const monitoringService = {
  shutdown: () => {
    logger.info('Monitoring service shutting down...');
    // Cleanup logic if needed
  }
};

module.exports = { monitoringService };