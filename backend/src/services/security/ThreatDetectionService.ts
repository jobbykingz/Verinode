import { ThreatDetector } from '../../security/ThreatDetector';
import { AnomalyDetector } from '../../security/AnomalyDetector';
import { SecurityMonitor } from '../../security/SecurityMonitor';
import { AutoResponder } from '../../security/AutoResponder';
import { ThreatEvent } from '../../models/ThreatEvent';

export class ThreatDetectionService {
  private threatDetector: ThreatDetector;
  private anomalyDetector: AnomalyDetector;
  private securityMonitor: SecurityMonitor;
  private autoResponder: AutoResponder;

  constructor() {
    this.threatDetector = new ThreatDetector();
    this.anomalyDetector = new AnomalyDetector();
    this.securityMonitor = new SecurityMonitor();
    this.autoResponder = new AutoResponder();

    // Wire up the monitor to the responder
    this.securityMonitor.on('threatDetected', async (event: ThreatEvent) => {
      const actionTaken = await this.autoResponder.handleThreat(event);
      if (actionTaken) {
        console.log(`Automated response executed for threat: ${event.id}`);
      }
    });
  }

  public async analyzeIncomingRequest(ip: string, path: string, headers: Record<string, string>, userData?: any): Promise<void> {
    // 1. Rule-based detection
    const ruleBasedThreat = this.threatDetector.analyzeRequest(ip, path, headers);
    if (ruleBasedThreat) {
      this.securityMonitor.logEvent(ruleBasedThreat);
    }

    // 2. AI Anomaly detection (if user data is provided)
    if (userData) {
      const anomalyThreat = await this.anomalyDetector.detectAnomaly(userData);
      if (anomalyThreat) {
        this.securityMonitor.logEvent(anomalyThreat);
      }
    }
  }

  public getDashboardData() {
    return {
      stats: this.securityMonitor.getStats(),
      recentAlerts: this.securityMonitor.getRecentEvents()
    };
  }
}

export const threatDetectionService = new ThreatDetectionService();
