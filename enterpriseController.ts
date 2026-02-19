import { Request, Response } from 'express';
import { RoleService } from '../services/roleService';
import { BillingService } from '../services/billingService';

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
            // Mock processing logic for bulk operations
            const processedCount = proofIds.length;
            res.json({ success: true, message: `Successfully processed ${processedCount} items with action: ${action}`, processedCount });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}