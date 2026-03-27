const mongoose = require('mongoose');

// Rate Limit Rule Schema
const rateLimitRuleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  endpoint: {
    type: String,
    required: true,
    trim: true
  },
  method: {
    type: String,
    required: true,
    enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
    default: 'GET'
  },
  tier: {
    type: String,
    required: true,
    enum: ['free', 'basic', 'premium', 'enterprise', 'custom'],
    default: 'free'
  },
  limits: {
    requestsPerMinute: {
      type: Number,
      required: true,
      min: 0
    },
    requestsPerHour: {
      type: Number,
      required: true,
      min: 0
    },
    requestsPerDay: {
      type: Number,
      required: true,
      min: 0
    },
    requestsPerMonth: {
      type: Number,
      required: true,
      min: 0
    }
  },
  features: {
    burstAllowance: {
      type: Number,
      default: 0,
      min: 0
    },
    prioritySupport: {
      type: Boolean,
      default: false
    },
    customEndpoints: {
      type: Boolean,
      default: false
    },
    advancedAnalytics: {
      type: Boolean,
      default: false
    },
    emergencyBypass: {
      type: Boolean,
      default: false
    }
  },
  enabled: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Rate Limit Violation Schema
const rateLimitViolationSchema = new mongoose.Schema({
  userId: {
    type: String,
    index: true
  },
  ipAddress: {
    type: String,
    required: true,
    index: true
  },
  endpoint: {
    type: String,
    required: true,
    index: true
  },
  method: {
    type: String,
    required: true
  },
  tier: {
    type: String,
    enum: ['free', 'basic', 'premium', 'enterprise', 'custom']
  },
  violationType: {
    type: String,
    required: true,
    enum: ['minute', 'hour', 'day', 'month', 'endpoint']
  },
  limitExceeded: {
    type: Number,
    required: true
  },
  actualRequests: {
    type: Number,
    required: true
  },
  userAgent: String,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  resolved: {
    type: Boolean,
    default: false
  },
  resolvedAt: Date,
  resolvedBy: String,
  notes: String
}, {
  timestamps: true
});

// Rate Limit Analytics Schema
const rateLimitAnalyticsSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    index: true
  },
  endpoint: {
    type: String,
    required: true,
    index: true
  },
  method: {
    type: String,
    required: true
  },
  tier: {
    type: String,
    enum: ['free', 'basic', 'premium', 'enterprise', 'custom']
  },
  totalRequests: {
    type: Number,
    required: true,
    min: 0
  },
  blockedRequests: {
    type: Number,
    required: true,
    min: 0
  },
  allowedRequests: {
    type: Number,
    required: true,
    min: 0
  },
  averageResponseTime: {
    type: Number,
    required: true,
    min: 0
  },
  peakRequestsPerMinute: {
    type: Number,
    required: true,
    min: 0
  },
  uniqueUsers: {
    type: Number,
    required: true,
    min: 0
  },
  uniqueIPs: {
    type: Number,
    required: true,
    min: 0
  },
  systemLoad: {
    cpuUsage: Number,
    memoryUsage: Number,
    activeConnections: Number
  }
}, {
  timestamps: true
});

// Rate Limit User Schema
const rateLimitUserSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: String,
  tier: {
    type: String,
    required: true,
    enum: ['free', 'basic', 'premium', 'enterprise', 'custom'],
    default: 'free'
  },
  customLimits: {
    type: Map,
    of: {
      requestsPerMinute: Number,
      requestsPerHour: Number,
      requestsPerDay: Number
    }
  },
  specialFeatures: {
    burstMultiplier: {
      type: Number,
      default: 1,
      min: 1
    },
    priorityMultiplier: {
      type: Number,
      default: 1,
      min: 1
    },
    bypassLimits: {
      type: Boolean,
      default: false
    },
    whitelist: {
      type: Boolean,
      default: false
    }
  },
  subscription: {
    planId: String,
    status: {
      type: String,
      enum: ['active', 'inactive', 'cancelled', 'expired'],
      default: 'inactive'
    },
    startDate: Date,
    endDate: Date,
    autoRenew: {
      type: Boolean,
      default: false
    }
  },
  usage: {
    currentMonth: {
      requests: {
        type: Number,
        default: 0
      },
      endpointBreakdown: {
        type: Map,
        of: Number,
        default: new Map()
      }
    },
    lastMonth: {
      requests: {
        type: Number,
        default: 0
      },
      endpointBreakdown: {
        type: Map,
        of: Number,
        default: new Map()
      }
    },
    allTime: {
      requests: {
        type: Number,
        default: 0
      },
      endpointBreakdown: {
        type: Map,
        of: Number,
        default: new Map()
      }
    }
  },
  violations: {
    count: {
      type: Number,
      default: 0
    },
    lastViolation: Date,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low'
    }
  }
}, {
  timestamps: true
});

// Rate Limit Alert Schema
const rateLimitAlertSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['limit_exceeded', 'tier_upgrade', 'emergency_mode', 'system_load', 'anomaly_detected']
  },
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical']
  },
  userId: String,
  ipAddress: String,
  endpoint: String,
  message: {
    type: String,
    required: true
  },
  data: mongoose.Schema.Types.Mixed,
  acknowledged: {
    type: Boolean,
    default: false
  },
  acknowledgedBy: String,
  acknowledgedAt: Date,
  resolved: {
    type: Boolean,
    default: false
  },
  resolvedBy: String,
  resolvedAt: Date
}, {
  timestamps: true
});

// Rate Limit Configuration Schema
const rateLimitConfigurationSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  value: mongoose.Schema.Types.Mixed,
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['general', 'tiers', 'dynamic', 'emergency', 'notifications']
  },
  editable: {
    type: Boolean,
    default: true
  },
  requiresRestart: {
    type: Boolean,
    default: false
  },
  lastModifiedBy: String,
  lastModifiedAt: Date
}, {
  timestamps: true
});

// Indexes for better performance
rateLimitViolationSchema.index({ userId: 1, timestamp: -1 });
rateLimitViolationSchema.index({ ipAddress: 1, timestamp: -1 });
rateLimitViolationSchema.index({ endpoint: 1, timestamp: -1 });

rateLimitAnalyticsSchema.index({ date: -1, endpoint: 1 });
rateLimitAnalyticsSchema.index({ date: -1, tier: 1 });

rateLimitAlertSchema.index({ type: 1, createdAt: -1 });
rateLimitAlertSchema.index({ severity: 1, createdAt: -1 });
rateLimitAlertSchema.index({ userId: 1, createdAt: -1 });

// Static methods for RateLimitUser
rateLimitUserSchema.statics.findByUserId = function(userId) {
  return this.findOne({ userId });
};

rateLimitUserSchema.statics.updateUsage = function(userId, endpoint, increment = 1) {
  return this.updateOne(
    { userId },
    { 
      $inc: { 
        'usage.currentMonth.requests': increment,
        'usage.allTime.requests': increment,
        [`usage.currentMonth.endpointBreakdown.${endpoint}`]: increment,
        [`usage.allTime.endpointBreakdown.${endpoint}`]: increment
      }
    },
    { upsert: true }
  );
};

rateLimitUserSchema.statics.incrementViolations = function(userId, severity = 'low') {
  return this.updateOne(
    { userId },
    { 
      $inc: { 'violations.count': 1 },
      $set: { 
        'violations.lastViolation': new Date(),
        'violations.severity': severity
      }
    },
    { upsert: true }
  );
};

// Static methods for RateLimitViolation
rateLimitViolationSchema.statics.findByUserId = function(userId, limit = 100) {
  return this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit);
};

rateLimitViolationSchema.statics.findByIPAddress = function(ipAddress, limit = 100) {
  return this.find({ ipAddress })
    .sort({ timestamp: -1 })
    .limit(limit);
};

rateLimitViolationSchema.statics.findUnresolved = function() {
  return this.find({ resolved: false })
    .sort({ timestamp: -1 });
};

// Static methods for RateLimitAnalytics
rateLimitAnalyticsSchema.statics.getDailyStats = function(date, endpoint = null) {
  const query = { 
    date: {
      $gte: new Date(date.setHours(0, 0, 0, 0)),
      $lt: new Date(date.setHours(23, 59, 59, 999))
    }
  };
  
  if (endpoint) {
    query.endpoint = endpoint;
  }
  
  return this.find(query).sort({ endpoint: 1 });
};

rateLimitAnalyticsSchema.statics.getMonthlyStats = function(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);
  
  return this.aggregate([
    {
      $match: {
        date: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$tier',
        totalRequests: { $sum: '$totalRequests' },
        blockedRequests: { $sum: '$blockedRequests' },
        allowedRequests: { $sum: '$allowedRequests' },
        averageResponseTime: { $avg: '$averageResponseTime' },
        uniqueUsers: { $sum: '$uniqueUsers' },
        uniqueIPs: { $sum: '$uniqueIPs' }
      }
    }
  ]);
};

// Static methods for RateLimitAlert
rateLimitAlertSchema.statics.findUnacknowledged = function() {
  return this.find({ acknowledged: false })
    .sort({ createdAt: -1 });
};

rateLimitAlertSchema.statics.findBySeverity = function(severity) {
  return this.find({ severity })
    .sort({ createdAt: -1 });
};

rateLimitAlertSchema.statics.acknowledgeAlert = function(alertId, acknowledgedBy) {
  return this.updateOne(
    { _id: alertId },
    { 
      acknowledged: true,
      acknowledgedBy,
      acknowledgedAt: new Date()
    }
  );
};

// Static methods for RateLimitConfiguration
rateLimitConfigurationSchema.statics.getByCategory = function(category) {
  return this.find({ category }).sort({ key: 1 });
};

rateLimitConfigurationSchema.statics.upsertConfig = function(key, value, description, category, lastModifiedBy) {
  return this.findOneAndUpdate(
    { key },
    { 
      value,
      description,
      category,
      lastModifiedBy,
      lastModifiedAt: new Date()
    },
    { upsert: true, new: true }
  );
};

// Export models
const RateLimitRule = mongoose.model('RateLimitRule', rateLimitRuleSchema);
const RateLimitViolation = mongoose.model('RateLimitViolation', rateLimitViolationSchema);
const RateLimitAnalytics = mongoose.model('RateLimitAnalytics', rateLimitAnalyticsSchema);
const RateLimitUser = mongoose.model('RateLimitUser', rateLimitUserSchema);
const RateLimitAlert = mongoose.model('RateLimitAlert', rateLimitAlertSchema);
const RateLimitConfiguration = mongoose.model('RateLimitConfiguration', rateLimitConfigurationSchema);

module.exports = {
  RateLimitRule,
  RateLimitViolation,
  RateLimitAnalytics,
  RateLimitUser,
  RateLimitAlert,
  RateLimitConfiguration
};
