import { ThreatEvent, ThreatSeverity, ThreatType } from '../models/ThreatEvent';
import { v4 as uuidv4 } from 'uuid';

export class ThreatDetector {
  private knownMaliciousIps: Set<string>;
  private rateLimitRules: Map<string, number>;

  constructor() {
    this.knownMaliciousIps = new Set(['192.168.1.100', '10.0.0.50']); // Example
    this.rateLimitRules = new Map();
  }

  public analyzeRequest(ip: string, path: string, headers: Record<string, string>): ThreatEvent | null {
    if (this.knownMaliciousIps.has(ip)) {
      return this.createThreatEvent(
        ThreatType.MALWARE,
        ThreatSeverity.CRITICAL,
        ip,
        undefined,
        'Request from known malicious IP address'
      );
    }

    // Basic SQL Injection detection in path or headers
    const sqlInjectionPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|OR)\b)|(--)/i;
    if (sqlInjectionPattern.test(path) || Object.values(headers).some(v => sqlInjectionPattern.test(v))) {
      return this.createThreatEvent(
        ThreatType.UNAUTHORIZED_ACCESS,
        ThreatSeverity.HIGH,
        ip,
        undefined,
        'Potential SQL Injection attempt detected'
      );
    }

    return null;
  }

  private createThreatEvent(type: ThreatType, severity: ThreatSeverity, sourceIp?: string, userId?: string, description: string = ''): ThreatEvent {
    return {
      id: uuidv4(),
      timestamp: new Date(),
      type,
      severity,
      sourceIp,
      userId,
      description,
      actionTaken: false
    };
  }
}
