import AuditLog, { IAuditLog } from '../models/AuditLog.ts';

export class ComplianceManager {
  private static instance: ComplianceManager;

  private constructor() {}

  public static getInstance(): ComplianceManager {
    if (!ComplianceManager.instance) {
      ComplianceManager.instance = new ComplianceManager();
    }
    return ComplianceManager.instance;
  }

  public async handleGDPRDeleteRequest(userId: string): Promise<{ deletedLogs: number; status: string }> {
    // 1. GDPR Right to Erase/Forget
    // According to GDPR, we can't delete logs required for legal/security purposes, balance with privacy.
    const logs = await AuditLog.find({ 'actor.id': userId, 'compliance.gdprRelevant': true });
    
    // Instead of actual deletion, we redact/mask sensitive data for logs we must keep.
    const result = await AuditLog.updateMany(
      { 'actor.id': userId, 'compliance.gdprRelevant': true },
      { 
        $set: { 
          'actor.name': '[REDACTED]', 
          'actor.ipAddress': '0.0.0.0', 
          'eventData': { redacted: true },
          'compliance.isDeleted': true
        } 
      }
    );

    return { deletedLogs: result.modifiedCount, status: 'redacted' };
  }

  public async exportUserData(userId: string): Promise<IAuditLog[]> {
    return AuditLog.find({ 'actor.id': userId }).sort({ timestamp: -1 });
  }

  public async enforceRetentionPolicies(): Promise<{ logsPurged: number }> {
     const now = new Date();
     const result = await AuditLog.deleteMany({ 
       'compliance.retentionUntil': { $lt: now },
       'compliance.classification': { $ne: 'RESTRICTED' } // Specific classes we keep indefinitely
     });

     return { logsPurged: result.deletedCount };
  }

  public async getComplianceSummary(): Promise<{ totalLogs: number; classifiedLogs: Record<string, number> }> {
    const total = await AuditLog.countDocuments();
    const classifications = await AuditLog.aggregate([
      { $group: { _id: '$compliance.classification', count: { $sum: 1 } } }
    ]);

    const classifiedLogs: Record<string, number> = {};
    classifications.forEach(c => {
      classifiedLogs[c._id] = c.count;
    });

    return { totalLogs: total, classifiedLogs };
  }
}
