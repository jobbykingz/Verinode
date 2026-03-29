const tf = require('@tensorflow/tfjs-node');

/**
 * ML-Based Fraud Detection Service
 * Real-time fraud detection using behavioral analysis and anomaly detection
 */
class FraudDetectionService {
  constructor() {
    this.model = null;
    this.featureExtractor = null;
    this.riskThresholds = {
      LOW: 0.3,
      MEDIUM: 0.6,
      HIGH: 0.8
    };
    
    this.behavioralPatterns = new Map();
    this.transactionHistory = new Map();
  }

  /**
   * Initialize and train the fraud detection model
   */
  async initializeModel() {
    // Create neural network model
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [50],
          units: 128,
          activation: 'relu',
          kernel_regularizer: 'l2'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });

    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    return this.model;
  }

  /**
   * Train model with historical data
   */
  async trainModel(trainingData) {
    if (!this.model) {
      await this.initializeModel();
    }

    const { features, labels } = this.prepareTrainingData(trainingData);
    
    const xs = tf.tensor2d(features, [features.length, features[0].length]);
    const ys = tf.tensor2d(labels, [labels.length, 1]);

    const history = await this.model.fit(xs, ys, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch}: loss = ${logs.loss}, acc = ${logs.acc}`);
        }
      }
    });

    // Cleanup tensors
    xs.dispose();
    ys.dispose();

    return history;
  }

  /**
   * Detect fraud in real-time
   */
  async detectFraud(transaction, userId) {
    const startTime = Date.now();
    
    // Extract features
    const features = await this.extractFeatures(transaction, userId);
    
    // Get fraud score
    const fraudScore = await this.predictFraudScore(features);
    
    // Determine risk level
    const riskLevel = this.determineRiskLevel(fraudScore);
    
    // Check for anomalies
    const anomalies = await this.detectAnomalies(userId, transaction);
    
    // Generate prevention actions
    const actions = await this.generatePreventionActions(riskLevel, anomalies);
    
    const result = {
      transactionId: transaction.id,
      fraudScore,
      riskLevel,
      anomalies,
      actions,
      latency: Date.now() - startTime,
      timestamp: new Date()
    };

    // Store for monitoring
    await this.storeFraudDetection(result);

    return result;
  }

  /**
   * Analyze user behavior patterns
   */
  async analyzeBehavior(userId, timeRange = '30d') {
    const transactions = await this.getUserTransactions(userId, timeRange);
    
    const patterns = {
      averageTransactionAmount: this.calculateAverage(transactions.map(t => t.amount)),
      transactionFrequency: this.calculateFrequency(transactions),
      typicalLocations: this.extractLocations(transactions),
      typicalTimes: this.extractTimes(transactions),
      devicePatterns: this.extractDevicePatterns(transactions),
      velocityPatterns: this.calculateVelocity(transactions)
    };

    // Store behavioral profile
    this.behavioralPatterns.set(userId, {
      patterns,
      updatedAt: new Date(),
      confidence: 0.95
    });

    return patterns;
  }

  /**
   * Detect anomalous behavior
   */
  async detectAnomalies(userId, transaction) {
    const anomalies = [];
    
    const profile = this.behavioralPatterns.get(userId);
    if (!profile) {
      await this.analyzeBehavior(userId);
    }

    const patterns = profile?.patterns;

    // Amount anomaly
    if (Math.abs(transaction.amount - patterns.averageTransactionAmount) > 3 * patterns.stdDev) {
      anomalies.push({
        type: 'AMOUNT_ANOMALY',
        severity: 'HIGH',
        description: `Transaction amount ${transaction.amount} deviates significantly from average ${patterns.averageTransactionAmount}`
      });
    }

    // Location anomaly
    if (!patterns.typicalLocations.includes(transaction.location)) {
      anomalies.push({
        type: 'LOCATION_ANOMALY',
        severity: 'MEDIUM',
        description: `Transaction from unusual location: ${transaction.location}`
      });
    }

    // Time anomaly
    const hour = new Date(transaction.timestamp).getHours();
    if (!patterns.typicalTimes.includes(hour)) {
      anomalies.push({
        type: 'TIME_ANOMALY',
        severity: 'LOW',
        description: `Transaction at unusual hour: ${hour}`
      });
    }

    // Velocity anomaly
    const recentTransactions = await this.getRecentTransactions(userId, '1h');
    if (recentTransactions.length > 5) {
      anomalies.push({
        type: 'VELOCITY_ANOMALY',
        severity: 'HIGH',
        description: `High transaction velocity: ${recentTransactions.length} in last hour`
      });
    }

    return anomalies;
  }

  /**
   * Generate automated prevention actions
   */
  async generatePreventionActions(riskLevel, anomalies) {
    const actions = [];

    if (riskLevel === 'CRITICAL') {
      actions.push({
        type: 'BLOCK_TRANSACTION',
        priority: 1,
        reason: 'Critical risk level detected'
      });
      actions.push({
        type: 'FREEZE_ACCOUNT',
        priority: 2,
        reason: 'Multiple high-severity anomalies'
      });
      actions.push({
        type: 'ALERT_FRAUD_TEAM',
        priority: 3,
        reason: 'Immediate review required'
      });
    } else if (riskLevel === 'HIGH') {
      actions.push({
        type: 'REQUIRE_ADDITIONAL_AUTH',
        priority: 1,
        reason: 'High risk level requires additional verification'
      });
      actions.push({
        type: 'FLAG_FOR_REVIEW',
        priority: 2,
        reason: 'Manual review recommended'
      });
    } else if (riskLevel === 'MEDIUM') {
      actions.push({
        type: 'ENHANCED_MONITORING',
        priority: 1,
        reason: 'Medium risk - increase monitoring'
      });
    }

    return actions;
  }

  /**
   * Calculate fraud probability score
   */
  async predictFraudScore(features) {
    if (!this.model) {
      await this.initializeModel();
    }

    const inputTensor = tf.tensor2d([features], [1, features.length]);
    const prediction = this.model.predict(inputTensor);
    const score = (await prediction.data())[0];
    
    inputTensor.dispose();
    prediction.dispose();

    return Math.round(score * 100) / 100;
  }

  /**
   * Extract features for ML model
   */
  async extractFeatures(transaction, userId) {
    const features = [];

    // Transaction features
    features.push(transaction.amount);
    features.push(transaction.hour);
    features.push(transaction.dayOfWeek);
    
    // User behavioral features
    const behavior = await this.analyzeBehavior(userId);
    features.push(behavior.averageTransactionAmount);
    features.push(behavior.transactionFrequency);
    
    // Device features
    features.push(transaction.deviceTrustScore || 0);
    
    // Location features
    features.push(transaction.locationRiskScore || 0);
    
    // Historical features
    const recentCount = await this.countRecentTransactions(userId, '24h');
    features.push(recentCount);
    
    // Pad to 50 features
    while (features.length < 50) {
      features.push(0);
    }

    return features.slice(0, 50);
  }

  determineRiskLevel(score) {
    if (score >= this.riskThresholds.HIGH) return 'CRITICAL';
    if (score >= this.riskThresholds.MEDIUM) return 'HIGH';
    if (score >= this.riskThresholds.LOW) return 'MEDIUM';
    return 'LOW';
  }

  // Helper methods
  calculateAverage(arr) { /* Implementation */ return arr.reduce((a, b) => a + b, 0) / arr.length; }
  calculateFrequency(transactions) { /* Implementation */ return transactions.length; }
  extractLocations(transactions) { /* Implementation */ return [...new Set(transactions.map(t => t.location))]; }
  extractTimes(transactions) { /* Implementation */ return [...new Set(transactions.map(t => new Date(t.timestamp).getHours()))]; }
  extractDevicePatterns(transactions) { /* Implementation */ return {}; }
  calculateVelocity(transactions) { /* Implementation */ return {}; }
  
  async getUserTransactions(userId, range) { /* Implementation */ return []; }
  async getRecentTransactions(userId, range) { /* Implementation */ return []; }
  async countRecentTransactions(userId, range) { /* Implementation */ return 0; }
  async storeFraudDetection(result) { /* Implementation */ }
  prepareTrainingData(data) { /* Implementation */ return { features: [], labels: [] }; }
}

module.exports = FraudDetectionService;
