import AuditLog, { IAuditLog } from '../models/AuditLog.ts';

export class ForensicAnalyzer {
  private static instance: ForensicAnalyzer;

  private constructor() {}

  public static getInstance(): ForensicAnalyzer {
    if (!ForensicAnalyzer.instance) {
      ForensicAnalyzer.instance = new ForensicAnalyzer();
    }
    return ForensicAnalyzer.instance;
  }

  public async analyzeLoginPatterns(userId: string): Promise<{ suspiciousActivities: number; details: any[] }> {
    const logs = await AuditLog.find({ 
      'actor.id': userId, 
      eventType: 'USER_LOGIN', 
      status: 'FAILURE' 
    }).sort({ timestamp: -1 }).limit(10);

    const suspiciousActivities = logs.length > 5 ? logs.length : 0;
    
    return {
      suspiciousActivities,
      details: logs.map(l => ({ 
        time: l.timestamp, 
        ip: l.actor.ipAddress, 
        ua: l.actor.userAgent 
      }))
    };
  }

  public async traceResourceAccess(resourceId: string): Promise<IAuditLog[]> {
    return AuditLog.find({ 'resource.id': resourceId }).sort({ timestamp: -1 });
  }

  public async detectAnomaly(windowInMinutes: number): Promise<{ alert: boolean; message: string; data?: any }> {
    const cutoff = new Date(Date.now() - windowInMinutes * 60 * 1000);
    const failures = await AuditLog.countDocuments({ 
      status: 'FAILURE', 
      timestamp: { $gte: cutoff } 
    });

    if (failures > 100) { // Example threshold
      return { 
        alert: true, 
        message: 'High frequency of authorization failures detected within the last ' + windowInMinutes + ' minutes.', 
        data: { failureCount: failures } 
      };
    }

    return { alert: false, message: 'Normal' };
  }

  public async correlateEvents(correlationId: string): Promise<IAuditLog[]> {
    return AuditLog.find({ correlationId }).sort({ timestamp: 1 });
  }
}
