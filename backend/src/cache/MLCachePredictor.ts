import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { WinstonLogger } from '../utils/logger';
import { 
  CachePattern, 
  CachePrediction, 
  AccessPattern, 
  MLModelMetrics,
  CacheEvent 
} from '../models/CachePattern';

export interface MLCachePredictorConfig {
  modelPath: string;
  pythonPath: string;
  predictionThreshold: number;
  retrainingInterval: number;
  maxHistorySize: number;
  featureWindowSize: number;
  predictionHorizon: number;
}

export class MLCachePredictor extends EventEmitter {
  private config: MLCachePredictorConfig;
  private logger: WinstonLogger;
  private pythonProcess?: ChildProcess;
  private modelMetrics: MLModelMetrics;
  private accessHistory: Map<string, CacheEvent[]>;
  private patterns: Map<string, AccessPattern>;
  private isInitialized: boolean = false;
  private retrainingTimer?: NodeJS.Timeout;

  constructor(config: MLCachePredictorConfig) {
    super();
    this.config = config;
    this.logger = new WinstonLogger();
    this.modelMetrics = this.initializeModelMetrics();
    this.accessHistory = new Map();
    this.patterns = new Map();
  }

  /**
   * Initialize the ML predictor
   */
  async initialize(): Promise<void> {
    try {
      await this.startPythonProcess();
      await this.loadModel();
      this.startRetraining();
      this.isInitialized = true;
      this.logger.info('ML Cache Predictor initialized successfully');
      this.emit('initialized');
    } catch (error) {
      this.logger.error('Failed to initialize ML Cache Predictor', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Predict cache access probability for a key
   */
  async predictAccess(key: string, features?: any): Promise<CachePrediction> {
    if (!this.isInitialized) {
      throw new Error('ML Cache Predictor not initialized');
    }

    try {
      const history = this.accessHistory.get(key) || [];
      const pattern = this.patterns.get(key);
      
      // Extract features from access history
      const extractedFeatures = this.extractFeatures(key, history, features);
      
      // Call Python ML model for prediction
      const prediction = await this.callPythonModel('predict', {
        key,
        features: extractedFeatures,
        pattern: pattern ? {
          frequency: pattern.frequency,
          hourlyDistribution: pattern.hourlyDistribution,
          weeklyDistribution: pattern.weeklyDistribution,
          seasonalTrend: pattern.seasonalTrend
        } : undefined
      });

      // Enhance prediction with business logic
      const enhancedPrediction = this.enhancePrediction(key, prediction, history);

      this.emit('prediction', enhancedPrediction);
      return enhancedPrediction;

    } catch (error) {
      this.logger.error(`Failed to predict access for key: ${key}`, error);
      this.emit('error', error);
      return this.getDefaultPrediction(key);
    }
  }

  /**
   * Batch predict for multiple keys
   */
  async predictBatch(keys: string[]): Promise<CachePrediction[]> {
    if (!this.isInitialized) {
      throw new Error('ML Cache Predictor not initialized');
    }

    try {
      const batchFeatures = keys.map(key => ({
        key,
        features: this.extractFeatures(key, this.accessHistory.get(key) || []),
        pattern: this.patterns.get(key)
      }));

      const predictions = await this.callPythonModel('predict_batch', {
        predictions: batchFeatures
      });

      return predictions.map((pred: any, index: number) => 
        this.enhancePrediction(keys[index], pred, this.accessHistory.get(keys[index]) || [])
      );

    } catch (error) {
      this.logger.error('Failed to batch predict', error);
      return keys.map(key => this.getDefaultPrediction(key));
    }
  }

  /**
   * Record cache access event
   */
  recordAccess(event: CacheEvent): void {
    const key = event.key;
    const history = this.accessHistory.get(key) || [];
    
    history.push(event);
    
    // Limit history size
    if (history.length > this.config.maxHistorySize) {
      history.splice(0, history.length - this.config.maxHistorySize);
    }
    
    this.accessHistory.set(key, history);
    
    // Update pattern if enough data
    if (history.length >= 10) {
      this.updatePattern(key, history);
    }
    
    this.emit('accessRecorded', event);
  }

  /**
   * Get model performance metrics
   */
  getModelMetrics(): MLModelMetrics {
    return { ...this.modelMetrics };
  }

  /**
   * Retrain the ML model
   */
  async retrainModel(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('ML Cache Predictor not initialized');
    }

    try {
      this.logger.info('Starting model retraining...');
      
      // Prepare training data
      const trainingData = this.prepareTrainingData();
      
      // Call Python to retrain model
      const metrics = await this.callPythonModel('retrain', {
        data: trainingData,
        windowSize: this.config.featureWindowSize,
        horizon: this.config.predictionHorizon
      });

      // Update model metrics
      this.modelMetrics = {
        ...this.modelMetrics,
        ...metrics,
        lastTrained: new Date(),
        modelVersion: this.generateModelVersion()
      };

      // Reload the updated model
      await this.loadModel();
      
      this.logger.info('Model retraining completed successfully');
      this.emit('modelRetrained', this.modelMetrics);

    } catch (error) {
      this.logger.error('Failed to retrain model', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get access patterns for all keys
   */
  getPatterns(): AccessPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get pattern for specific key
   */
  getPattern(key: string): AccessPattern | undefined {
    return this.patterns.get(key);
  }

  /**
   * Shutdown the predictor
   */
  async shutdown(): Promise<void> {
    try {
      if (this.retrainingTimer) {
        clearInterval(this.retrainingTimer);
      }
      
      if (this.pythonProcess) {
        this.pythonProcess.kill();
      }
      
      this.isInitialized = false;
      this.logger.info('ML Cache Predictor shutdown completed');
      this.emit('shutdown');

    } catch (error) {
      this.logger.error('Failed to shutdown ML Cache Predictor', error);
      throw error;
    }
  }

  // Private methods

  private async startPythonProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pythonProcess = spawn(this.config.pythonPath, [
        '-m', 'cache_prediction',
        '--model-path', this.config.modelPath
      ]);

      this.pythonProcess.stdout?.on('data', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'ready') {
            resolve();
          } else if (message.type === 'error') {
            reject(new Error(message.error));
          }
        } catch (error) {
          // Ignore non-JSON output
        }
      });

      this.pythonProcess.stderr?.on('data', (data) => {
        this.logger.error('Python process error:', data.toString());
      });

      this.pythonProcess.on('error', reject);
      this.pythonProcess.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Python process exited with code ${code}`));
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        reject(new Error('Python process initialization timeout'));
      }, 30000);
    });
  }

  private async loadModel(): Promise<void> {
    await this.callPythonModel('load_model', {
      path: this.config.modelPath
    });
  }

  private async callPythonModel(method: string, params: any): Promise<any> {
    if (!this.pythonProcess) {
      throw new Error('Python process not available');
    }

    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36).substr(2, 9);
      const message = JSON.stringify({
        id: requestId,
        method,
        params
      });

      let responseReceived = false;
      
      const timeout = setTimeout(() => {
        if (!responseReceived) {
          reject(new Error('Python model call timeout'));
        }
      }, 10000);

      const handleResponse = (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === requestId) {
            responseReceived = true;
            clearTimeout(timeout);
            
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response.result);
            }
          }
        } catch (error) {
          // Ignore non-JSON output
        }
      };

      this.pythonProcess?.stdout?.once('data', handleResponse);
      this.pythonProcess?.stdin?.write(message + '\n');
    });
  }

  private extractFeatures(key: string, history: CacheEvent[], additionalFeatures?: any): any {
    const now = Date.now();
    const recentHistory = history.filter(event => 
      now - event.timestamp.getTime() <= this.config.featureWindowSize * 1000
    );

    // Time-based features
    const hour = new Date().getHours();
    const dayOfWeek = new Date().getDay();
    const dayOfMonth = new Date().getDate();
    const month = new Date().getMonth();

    // Frequency features
    const accessCount = recentHistory.length;
    const avgAccessInterval = accessCount > 1 ? 
      recentHistory.slice(1).reduce((sum, event, i) => 
        sum + (event.timestamp.getTime() - recentHistory[i].timestamp.getTime()), 0
      ) / (accessCount - 1) : 0;

    // Pattern features
    const hourlyPattern = this.calculateHourlyPattern(recentHistory);
    const weeklyPattern = this.calculateWeeklyPattern(recentHistory);

    // Key features
    const keyFeatures = this.extractKeyFeatures(key);

    return {
      keyFeatures,
      timeFeatures: { hour, dayOfWeek, dayOfMonth, month },
      frequencyFeatures: { accessCount, avgAccessInterval },
      patternFeatures: { hourlyPattern, weeklyPattern },
      ...additionalFeatures
    };
  }

  private extractKeyFeatures(key: string): any {
    return {
      keyLength: key.length,
      keyParts: key.split(':').length,
      hasNumbers: /\d/.test(key),
      hasLetters: /[a-zA-Z]/.test(key),
      hasSpecialChars: /[^a-zA-Z0-9:]/.test(key),
      keyPattern: this.getKeyPattern(key)
    };
  }

  private getKeyPattern(key: string): string {
    // Extract pattern from key (e.g., "user:123" -> "user:*")
    if (key.includes(':')) {
      const parts = key.split(':');
      return parts.slice(0, -1).join(':') + ':*';
    }
    return '*';
  }

  private calculateHourlyPattern(history: CacheEvent[]): number[] {
    const hourlyCounts = new Array(24).fill(0);
    
    for (const event of history) {
      const hour = event.timestamp.getHours();
      hourlyCounts[hour]++;
    }
    
    // Normalize to get distribution
    const total = hourlyCounts.reduce((sum, count) => sum + count, 0);
    return total > 0 ? hourlyCounts.map(count => count / total) : hourlyCounts;
  }

  private calculateWeeklyPattern(history: CacheEvent[]): number[] {
    const weeklyCounts = new Array(7).fill(0);
    
    for (const event of history) {
      const dayOfWeek = event.timestamp.getDay();
      weeklyCounts[dayOfWeek]++;
    }
    
    // Normalize to get distribution
    const total = weeklyCounts.reduce((sum, count) => sum + count, 0);
    return total > 0 ? weeklyCounts.map(count => count / total) : weeklyCounts;
  }

  private enhancePrediction(key: string, prediction: any, history: CacheEvent[]): CachePrediction {
    const basePrediction = {
      key,
      probability: prediction.probability || 0.5,
      nextAccess: new Date(prediction.nextAccess || Date.now() + 3600000),
      confidence: prediction.confidence || 0.5,
      recommendedTTL: this.calculateRecommendedTTL(prediction, history),
      recommendedPriority: this.calculateRecommendedPriority(prediction, history),
      riskLevel: this.calculateRiskLevel(prediction, history),
      strategy: this.determineStrategy(prediction, history)
    };

    // Apply business rules and constraints
    return this.applyBusinessRules(basePrediction);
  }

  private calculateRecommendedTTL(prediction: any, history: CacheEvent[]): number {
    const baseTTL = prediction.recommendedTTL || 3600;
    const accessFrequency = history.length;
    
    // Adjust TTL based on access frequency and confidence
    if (accessFrequency > 10 && prediction.confidence > 0.8) {
      return Math.min(baseTTL * 2, 86400); // Max 24 hours
    } else if (accessFrequency < 3 || prediction.confidence < 0.5) {
      return Math.max(baseTTL / 2, 300); // Min 5 minutes
    }
    
    return baseTTL;
  }

  private calculateRecommendedPriority(prediction: any, history: CacheEvent[]): number {
    const basePriority = prediction.priority || 5;
    const accessFrequency = history.length;
    
    // Higher priority for frequently accessed items with high confidence
    if (accessFrequency > 20 && prediction.confidence > 0.9) {
      return Math.min(basePriority + 3, 10);
    } else if (accessFrequency < 5 || prediction.confidence < 0.6) {
      return Math.max(basePriority - 2, 1);
    }
    
    return basePriority;
  }

  private calculateRiskLevel(prediction: any, history: CacheEvent[]): 'low' | 'medium' | 'high' {
    if (prediction.confidence < 0.3 || history.length < 2) {
      return 'high';
    } else if (prediction.confidence < 0.7 || history.length < 5) {
      return 'medium';
    }
    return 'low';
  }

  private determineStrategy(prediction: any, history: CacheEvent[]): 'cache' | 'bypass' | 'prefetch' {
    if (prediction.probability < 0.2) {
      return 'bypass';
    } else if (prediction.probability > 0.8 && prediction.confidence > 0.7) {
      return 'prefetch';
    }
    return 'cache';
  }

  private applyBusinessRules(prediction: CachePrediction): CachePrediction {
    // Apply minimum probability threshold
    if (prediction.probability < this.config.predictionThreshold) {
      prediction.probability = this.config.predictionThreshold;
    }
    
    // Ensure TTL is within reasonable bounds
    prediction.recommendedTTL = Math.max(300, Math.min(prediction.recommendedTTL, 86400));
    
    // Ensure priority is within bounds
    prediction.recommendedPriority = Math.max(1, Math.min(prediction.recommendedPriority, 10));
    
    return prediction;
  }

  private getDefaultPrediction(key: string): CachePrediction {
    return {
      key,
      probability: this.config.predictionThreshold,
      nextAccess: new Date(Date.now() + 3600000),
      confidence: 0.5,
      recommendedTTL: 3600,
      recommendedPriority: 5,
      riskLevel: 'medium',
      strategy: 'cache'
    };
  }

  private updatePattern(key: string, history: CacheEvent[]): void {
    const pattern: AccessPattern = {
      pattern: this.getKeyPattern(key),
      frequency: history.length,
      hourlyDistribution: this.calculateHourlyPattern(history),
      weeklyDistribution: this.calculateWeeklyPattern(history),
      seasonalTrend: this.detectSeasonalTrend(history),
      correlation: this.calculateCorrelation(history),
      prediction: {
        nextAccess: new Date(Date.now() + 3600000),
        confidence: 0.5,
        probability: 0.5
      }
    };
    
    this.patterns.set(key, pattern);
    this.emit('patternUpdated', { key, pattern });
  }

  private detectSeasonalTrend(history: CacheEvent[]): 'daily' | 'weekly' | 'monthly' | 'yearly' | 'none' {
    // Simplified seasonal trend detection
    // In a real implementation, this would use more sophisticated time series analysis
    const hourlyVariance = this.calculateVariance(this.calculateHourlyPattern(history));
    const weeklyVariance = this.calculateVariance(this.calculateWeeklyPattern(history));
    
    if (hourlyVariance > 0.3) {
      return 'daily';
    } else if (weeklyVariance > 0.3) {
      return 'weekly';
    }
    
    return 'none';
  }

  private calculateCorrelation(history: CacheEvent[]): number {
    // Simplified correlation calculation
    // In a real implementation, this would calculate autocorrelation
    if (history.length < 2) return 0;
    
    const intervals = history.slice(1).map((event, i) => 
      event.timestamp.getTime() - history[i].timestamp.getTime()
    );
    
    const mean = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - mean, 2), 0) / intervals.length;
    
    return variance > 0 ? 1 / (1 + variance) : 0;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    
    return variance;
  }

  private prepareTrainingData(): any {
    const trainingData = [];
    
    for (const [key, history] of this.accessHistory.entries()) {
      if (history.length >= 5) {
        for (let i = 0; i < history.length - 1; i++) {
          const features = this.extractFeatures(key, history.slice(0, i + 1));
          const target = {
            nextAccessTime: history[i + 1].timestamp.getTime(),
            accessed: history[i + 1].type === 'hit'
          };
          
          trainingData.push({ features, target });
        }
      }
    }
    
    return trainingData;
  }

  private startRetraining(): void {
    this.retrainingTimer = setInterval(async () => {
      try {
        await this.retrainModel();
      } catch (error) {
        this.logger.error('Automatic retraining failed', error);
      }
    }, this.config.retrainingInterval * 1000);
  }

  private initializeModelMetrics(): MLModelMetrics {
    return {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      confusionMatrix: [[0, 0], [0, 0]],
      trainingLoss: 0,
      validationLoss: 0,
      modelVersion: '1.0.0',
      lastTrained: new Date(),
      trainingDataSize: 0,
      validationDataSize: 0
    };
  }

  private generateModelVersion(): string {
    const timestamp = Date.now();
    const hash = Math.random().toString(36).substr(2, 9);
    return `v${timestamp}_${hash}`;
  }
}
