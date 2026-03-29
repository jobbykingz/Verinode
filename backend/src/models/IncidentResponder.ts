import { ErrorReport, ErrorSeverity } from '../models/ErrorReport';
import { ErrorClassifier } from './ErrorClassifier';
import { RecoveryManager } from './RecoveryManager';

export class IncidentResponder {
  private incidentLog: ErrorReport[] = [];

  constructor(
    private classifier: ErrorClassifier,
    private recoveryManager: RecoveryManager
  ) {}

  public async handle(error: Error, context?: any): Promise<ErrorReport> {
    const { category, severity } = this.classifier.classify(error);
    
    const report: ErrorReport = {
      id: `err_${Date.now()}`,
      error,
      message: error.message,
      category,
      severity,
      timestamp: new Date(),
      context,
      recovered: false,
      correlationId: context?.correlationId
    };

    report.recovered = await this.recoveryManager.attemptRecovery(report);
    
    if (!report.recovered && severity === ErrorSeverity.CRITICAL) {
      this.triggerPagerDutyAlert(report);
    }

    this.incidentLog.push(report);
    return report;
  }

  private triggerPagerDutyAlert(report: ErrorReport): void {
    console.error(`[CRITICAL INCIDENT ALERT] - ${report.category}: ${report.message}`);
  }
}