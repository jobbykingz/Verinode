import { Request, Response } from 'express';
import { VersioningService } from '../services/versioningService';
import { AuditService } from '../services/auditService';

export class VersionController {
    static async createVersion(req: Request, res: Response) {
        try {
            const { proofId } = req.params;
            const { eventData, hash, author, message, branch, previousVersionId } = req.body;
            
            const prevVersionId = previousVersionId ? parseInt(previousVersionId) : undefined;
            const version = await VersioningService.createVersion(parseInt(proofId), { eventData, hash }, author, message, branch, prevVersionId);
            await AuditService.logChange(parseInt(proofId), version.id, 'UPDATE', author, message);
            
            res.status(201).json(version);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getHistory(req: Request, res: Response) {
        try {
            const { proofId } = req.params;
            const history = await VersioningService.getHistory(parseInt(proofId));
            res.json(history);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async rollback(req: Request, res: Response) {
        try {
            const { proofId, version } = req.params;
            const { author } = req.body;
            
            const newVersion = await VersioningService.rollback(parseInt(proofId), parseInt(version), author);
            await AuditService.logChange(parseInt(proofId), newVersion.id, 'ROLLBACK', author, `Rolled back to version ${version}`);
            
            res.json(newVersion);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
    
    static async getAuditTrail(req: Request, res: Response) {
        try {
            const { proofId } = req.params;
            const trail = await AuditService.getAuditTrail(parseInt(proofId));
            res.json(trail);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}