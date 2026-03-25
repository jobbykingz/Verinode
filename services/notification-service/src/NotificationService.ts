import express from 'express';
import helmet from 'helmet';
import cors from 'cors';

/**
 * Notification Service for Verinode Microservices Architecture.
 * Handles system alerts, tenant emails, and security notifications.
 */
class NotificationService {
  public app: express.Application;
  private port: number = 4005;

  constructor() {
    this.app = express();
    this.initializeMiddleware();
    this.initializeRouting();
  }

  /**
   * Local service policy for alert delivery and logging.
   */
  private initializeMiddleware() {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());
  }

  /**
   * Service endpoints specialized for Alerts.
   */
  private initializeRouting() {
    // Health Check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'up', service: 'notification-service', timestamp: new Date() });
    });

    // Send Alert
    this.app.post('/api/notifications/send', (req, res) => {
      const { type, recipient, message } = req.body;
      console.log(`[NOTIFICATION-SERVICE] Sending ${type} alert to: ${recipient}`);
      // Mocked alert delivery
      res.json({ success: true, messageId: 'MSG_9912X45', status: 'SENT' });
    });

    // Quota Alerts
    this.app.post('/api/notifications/quota-warning', (req, res) => {
      const { tenantId, usagePercent } = req.body;
      console.log(`[NOTIFICATION-SERVICE] QUOTA WARNING: Tenant ${tenantId} at ${usagePercent}%`);
      res.json({ status: 'delivered', priority: 'HIGH' });
    });
  }

  /**
   * Start the notification-service instance.
   */
  public start() {
    this.app.listen(this.port, () => {
      console.log(`NotificationService independent delivery instance operational on port ${this.port}`);
    });
  }
}

// Start instance
const service = new NotificationService();
service.start();

export default service;
