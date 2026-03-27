import { Request, Response } from 'express';
import { OAuthService } from '../../integrations/oauth/authService';
import { WebhookService } from '../services/webhookService';
import { NotificationService } from '../services/notificationService';

export class IntegrationController {
    static async getAuthUrl(req: Request, res: Response) {
        try {
            const { provider } = req.params;
            const url = OAuthService.generateAuthUrl(provider as any);
            res.json({ url });
        } catch (error: any) {
            res.status(400).json({ error: error.message });
        }
    }

    static async handleOAuthCallback(req: Request, res: Response) {
        try {
            const { provider } = req.params;
            const { code } = req.query;
            const tokens = await OAuthService.exchangeCode(provider, code as string);
            res.json({ success: true, tokens });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async handleWebhook(req: Request, res: Response) {
        try {
            const { source } = req.params;
            const event = req.headers['x-github-event'] || req.headers['x-event-key'] || 'unknown';
            const result = await WebhookService.processWebhook(source, event as string, req.body);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async sendTestNotification(req: Request, res: Response) {
        try {
            const { platform, target, message } = req.body;
            if (platform === 'slack') {
                await NotificationService.sendSlackNotification(target, message);
            } else if (platform === 'discord') {
                await NotificationService.sendDiscordNotification(target, message);
            }
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }
}