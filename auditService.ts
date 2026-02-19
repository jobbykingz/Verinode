import { ChangeLog } from '../models/ChangeLog';

let logs: ChangeLog[] = [];

export class AuditService {
    static async logChange(
        proofId: number, 
        versionId: number, 
        action: 'CREATE' | 'UPDATE' | 'ROLLBACK', 
        actor: string, 
        details: string
    ) {
        const log: ChangeLog = {
            id: logs.length + 1,
            proofId,
            versionId,
            action,
            timestamp: new Date().toISOString(),
            actor,
            details
        };
        logs.push(log);
        return log;
    }

    static async getAuditTrail(proofId: number): Promise<ChangeLog[]> {
        return logs
            .filter(l => l.proofId === proofId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
}