import { ThreatEvent } from '../models/ThreatEvent';
import { EventEmitter } from 'events';

export class SecurityMonitor extends EventEmitter {
  private events: ThreatEvent[] = [];
  
  constructor() {
    super();
  }

  public logEvent(event: ThreatEvent): void {
    this.events.push(event);
    this.emit('threatDetected', event);
    
    // Keep only the last 1000 events to prevent memory leaks
    if (this.events.length > 1000) {
      this.events.shift();
    }
  }

  public getRecentEvents(limit: number = 50): ThreatEvent[] {
    return this.events.slice(-limit).reverse();
  }

  public getStats() {
    const total = this.events.length;
    const critical = this.events.filter(e => e.severity === 'CRITICAL').length;
    const high = this.events.filter(e => e.severity === 'HIGH').length;
    return {
      totalThreats: total,
      criticalThreats: critical,
      highThreats: high,
      lastUpdated: new Date()
    };
  }
}
