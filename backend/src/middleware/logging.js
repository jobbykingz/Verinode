const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'verinode-backend' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

const requestLogger = () => (req, res, next) => {
  logger.info({
    message: 'Incoming Request',
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.headers['x-request-id']
  });
  next();
};

const errorLogger = () => (err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    requestId: req.headers['x-request-id']
  });
  next(err);
};

const securityLogger = () => (req, res, next) => {
  // Security specific logging can be enhanced here
  next();
};

const performanceLogger = (threshold = 1000) => (req, res, next) => {
  const start = process.hrtime();
  res.on('finish', () => {
    const diff = process.hrtime(start);
    const duration = (diff[0] * 1000) + (diff[1] / 1e6); // milliseconds
    
    if (duration > threshold) {
      logger.warn({
        message: 'Slow Request Detected',
        method: req.method,
        path: req.path,
        duration
      });
    }
  });
  next();
};

const complianceLogger = () => (req, res, next) => {
  next();
};

module.exports = { logger, requestLogger, errorLogger, securityLogger, performanceLogger, complianceLogger };