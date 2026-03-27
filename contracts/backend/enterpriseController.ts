import { Request, Response } from 'express';
import { RoleService } from '../services/roleService';
import { BillingService } from '../services/billingService';

const VALID_ROLES = ['admin', 'editor', 'viewer'];

export class EnterpriseController {
    static async getTeamMembers(req: Request, res: Response) {
        try {
            const { enterpriseId } = req.params;
            const members = await RoleService.getMembers(enterpriseId);
            res.json(members);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async addTeamMember(req: Request, res: Response) {
        try {
            const { enterpriseId } = req.params;
            const { user, role } = req.body;

            if (!user || !role) {
                return res.status(400).json({ error: 'User and role are required' });
            }

            if (!VALID_ROLES.includes(role)) {
                return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
            }

            const member = await RoleService.addMember(enterpriseId, user, role);
            res.status(201).json(member);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async updateMemberRole(req: Request, res: Response) {
        try {
            const { memberId } = req.params;
            const { role } = req.body;

            if (role && !VALID_ROLES.includes(role)) {
                return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
            }

            const member = await RoleService.updateRole(memberId, role);
            if (!member) return res.status(404).json({ error: 'Member not found' });
            res.json(member);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getBillingInfo(req: Request, res: Response) {
        try {
            const { enterpriseId } = req.params;
            const usage = await BillingService.getUsage(enterpriseId);
            const invoices = await BillingService.getInvoices(enterpriseId);
            res.json({ usage, invoices });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async bulkOperation(req: Request, res: Response) {
        try {
            const { proofIds, action } = req.body;

            if (!Array.isArray(proofIds) || proofIds.length === 0) {
                return res.status(400).json({ error: 'proofIds must be a non-empty array' });
            }

            if (proofIds.length > 5000) {
                return res.status(400).json({ error: 'Batch size exceeds limit of 5000 items' });
            }

            // Mock processing logic for bulk operations
            const processedCount = proofIds.length;
            res.json({ success: true, message: `Successfully processed ${processedCount} items with action: ${action}`, processedCount });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getAuditLogs(req: Request, res: Response) {
        try {
            // Mock audit logs response
            const logs = [
                { id: 1, action: 'User Added', actor: 'Alice Johnson', target: 'Bob Smith', timestamp: new Date().toISOString() },
                { id: 2, action: 'Role Updated', actor: 'Alice Johnson', target: 'Bob Smith (Editor)', timestamp: new Date().toISOString() }
            ];
            res.json(logs);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getAnalytics(req: Request, res: Response) {
        try {
            const { enterpriseId } = req.params;
            // Mock analytics data
            const analytics = {
                totalProofs: 1250,
                activeMembers: 8,
                apiUsage: 15400,
                usageLimit: 50000,
                activityTrend: [65, 59, 80, 81, 56, 55, 40]
            };
            res.json(analytics);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}