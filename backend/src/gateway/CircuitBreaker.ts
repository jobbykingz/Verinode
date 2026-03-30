import { EventEmitter } from 'events';

export interface CircuitState {
  closed: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastStateChange: number;
}

export interface CircuitConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  monitoringWindow: number;
  halfOpenMaxRequests: number;
}

/**
 * CircuitBreaker - Implements circuit breaker pattern for external services
 */
export class CircuitBreaker extends EventEmitter {
  private states: Map<string, CircuitState> = new Map();
  private config: CircuitConfig;
  private timers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config?: Partial<CircuitConfig>) {
    super();
    
    this.config = {
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 30000, // 30 seconds
      monitoringWindow: 60000, // 1 minute
      halfOpenMaxRequests: 3,
      ...config,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(serviceId: string, fn: () => Promise<T>): Promise<T> {
    const state = this.getState(serviceId);

    // Check if circuit is open
    if (state.closed === 'OPEN') {
      if (this.shouldAttemptReset(serviceId)) {
        this.transitionToHalfOpen(serviceId);
      } else {
        throw new Error(`Circuit breaker is OPEN for service: ${serviceId}`);
      }
    }

    // Check if in half-open state and at max requests
    if (state.closed === 'HALF_OPEN' && state.successCount >= this.config.halfOpenMaxRequests) {
      throw new Error(`Circuit breaker at max half-open requests for service: ${serviceId}`);
    }

    try {
      const result = await fn();
      this.recordSuccess(serviceId);
      return result;
    } catch (error) {
      this.recordFailure(serviceId);
      throw error;
    }
  }

  /**
   * Get circuit breaker state for a service
   */
  getState(serviceId: string): CircuitState {
    if (!this.states.has(serviceId)) {
      this.states.set(serviceId, {
        closed: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        lastStateChange: Date.now(),
      });
    }
    return this.states.get(serviceId)!;
  }

  /**
   * Check if circuit breaker should attempt reset
   */
  private shouldAttemptReset(serviceId: string): boolean {
    const state = this.getState(serviceId);
    
    if (state.closed !== 'OPEN' || !state.lastFailureTime) {
      return false;
    }

    const timeSinceFailure = Date.now() - state.lastFailureTime;
    return timeSinceFailure >= this.config.timeout;
  }

  /**
   * Transition circuit to half-open state
   */
  private transitionToHalfOpen(serviceId: string): void {
    const state = this.getState(serviceId);
    state.closed = 'HALF_OPEN';
    state.failureCount = 0;
    state.successCount = 0;
    state.lastStateChange = Date.now();

    console.log(`Circuit breaker for ${serviceId} transitioned to HALF_OPEN`);
    this.emit('stateChange', { serviceId, newState: 'HALF_OPEN' });
  }

  /**
   * Record a successful execution
   */
  private recordSuccess(serviceId: string): void {
    const state = this.getState(serviceId);
    state.successCount++;

    if (state.closed === 'HALF_OPEN') {
      if (state.successCount >= this.config.successThreshold) {
        this.transitionToClosed(serviceId);
      }
    } else if (state.closed === 'CLOSED') {
      // Reset failure count on success
      state.failureCount = 0;
    }
  }

  /**
   * Transition circuit to closed state
   */
  private transitionToClosed(serviceId: string): void {
    const state = this.getState(serviceId);
    state.closed = 'CLOSED';
    state.failureCount = 0;
    state.successCount = 0;
    state.lastStateChange = Date.now();

    console.log(`Circuit breaker for ${serviceId} transitioned to CLOSED`);
    this.emit('stateChange', { serviceId, newState: 'CLOSED' });
  }

  /**
   * Record a failed execution
   */
  private recordFailure(serviceId: string): void {
    const state = this.getState(serviceId);
    state.failureCount++;
    state.lastFailureTime = Date.now();

    if (state.closed === 'HALF_OPEN') {
      this.transitionToOpen(serviceId);
    } else if (state.closed === 'CLOSED') {
      if (state.failureCount >= this.config.failureThreshold) {
        this.transitionToOpen(serviceId);
      }
    }
  }

  /**
   * Transition circuit to open state
   */
  private transitionToOpen(serviceId: string): void {
    const state = this.getState(serviceId);
    state.closed = 'OPEN';
    state.lastStateChange = Date.now();

    console.log(`Circuit breaker for ${serviceId} transitioned to OPEN`);
    this.emit('stateChange', { serviceId, newState: 'OPEN' });

    // Set timer to check for reset
    if (this.timers.has(serviceId)) {
      clearTimeout(this.timers.get(serviceId));
    }

    const timer = setTimeout(() => {
      this.checkForReset(serviceId);
    }, this.config.timeout);

    this.timers.set(serviceId, timer);
  }

  /**
   * Check if circuit can be reset
   */
  private checkForReset(serviceId: string): void {
    if (this.shouldAttemptReset(serviceId)) {
      this.transitionToHalfOpen(serviceId);
    }
  }

  /**
   * Get statistics for a service
   */
  getStats(serviceId: string): {
    state: string;
    failureCount: number;
    successCount: number;
    uptime: number;
  } {
    const state = this.getState(serviceId);
    const uptime = Date.now() - state.lastStateChange;

    return {
      state: state.closed,
      failureCount: state.failureCount,
      successCount: state.successCount,
      uptime,
    };
  }

  /**
   * Get all circuit breaker states
   */
  getAllStates(): Map<string, CircuitState> {
    return new Map(this.states);
  }

  /**
   * Reset a specific circuit breaker
   */
  reset(serviceId: string): void {
    if (this.timers.has(serviceId)) {
      clearTimeout(this.timers.get(serviceId));
      this.timers.delete(serviceId);
    }

    this.states.set(serviceId, {
      closed: 'CLOSED',
      failureCount: 0,
      successCount: 0,
      lastStateChange: Date.now(),
    });

    console.log(`Circuit breaker for ${serviceId} manually reset`);
    this.emit('reset', { serviceId });
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const serviceId of this.states.keys()) {
      this.reset(serviceId);
    }
  }

  /**
   * Gracefully shutdown
   */
  shutdown(): void {
    for (const [serviceId, timer] of this.timers.entries()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.states.clear();
    console.log('CircuitBreaker shutdown complete');
  }
}

export const circuitBreaker = new CircuitBreaker();
