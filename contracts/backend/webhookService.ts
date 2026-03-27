import { GitHubWebhookHandler } from '../../integrations/github/webhookHandler';

export class WebhookService {
    static async processWebhook(source: string, event: string, payload: any) {
        switch (source) {
            case 'github':
                if (event === 'push') {
                    return await GitHubWebhookHandler.handlePushEvent(payload);
                }
                break;
            default:
                console.log(`Unknown webhook source: ${source}`);
        }
        return { processed: false };
    }
}