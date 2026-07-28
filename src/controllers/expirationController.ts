// Issue #31: Proof expiration and renewal system
// expirationController.ts — API endpoints for expiration management

import { Request, Response } from 'express';
import { expirationService } from '../services/expirationService';
import { renewalService } from '../services/renewalService';
import { notificationService } from '../services/notificationService';

export class ExpirationController {
  async getExpiration(req: Request, res: Response) {
    const { proofId } = req.params;
    const expiration = expirationService.getExpiration(proofId);
    if (!expiration) return res.status(404).json({ error: 'Expiration record not found' });
    res.json(expiration);
  }

  async setExpiration(req: Request, res: Response) {
    const { proofId } = req.params;
    const { durationDays } = req.body;
    const expiration = expirationService.setExpiration(proofId, durationDays);
    res.status(201).json(expiration);
  }

  async renewProof(req: Request, res: Response) {
    const { proofId } = req.params;
    const { durationDays = 365, notifyUser = true } = req.body;
    const renewedBy = req.user?.id ?? 'system';
    const renewal = renewalService.renewProof(proofId, renewedBy, { durationDays, notifyUser });
    if (notifyUser) {
      const expiration = expirationService.getExpiration(proofId);
      if (expiration) notificationService.sendRenewalConfirmation(proofId, req.user?.id ?? '', expiration.expiresAt);
    }
    res.json(renewal);
  }

  async bulkRenew(req: Request, res: Response) {
    const { proofIds, durationDays = 365, notifyUser = true } = req.body;
    if (!Array.isArray(proofIds) || proofIds.length === 0) return res.status(400).json({ error: 'proofIds must be a non-empty array' });
    const result = renewalService.bulkRenew(proofIds, req.user?.id ?? 'system', { durationDays, notifyUser });
    res.json(result);
  }

  async getAnalytics(req: Request, res: Response) {
    const analytics = expirationService.getAnalytics([]);
    res.json(analytics);
  }

  async getNotifications(req: Request, res: Response) {
    res.json(notificationService.getNotifications(req.user?.id ?? ''));
  }

  async getUnreadNotifications(req: Request, res: Response) {
    res.json(notificationService.getUnreadNotifications(req.user?.id ?? ''));
  }

  async markNotificationRead(req: Request, res: Response) {
    notificationService.markAsRead(req.params.notificationId, req.user?.id ?? '');
    res.json({ success: true });
  }
}

export const expirationController = new ExpirationController();
