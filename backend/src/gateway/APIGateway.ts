import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import routeManager from './RouteManager';
import loadBalancer from './LoadBalancer';

/**
 * API Gateway for Verinode Microservices Architecture.
 * Handles security, monitoring, and cross-cutting concerns.
 */
class APIGateway {
  public app: express.Application;
  private port: number = Number(process.env.GATEWAY_PORT) || 4000;

  constructor() {
    this.app = express();
    this.initializeMiddleware();
    this.initializeRouting();
    this.initializeHealthCheck();
  }

  /**
   * Global policies for security, performance, and monitoring.
   */
  private initializeMiddleware() {
    this.app.use(helmet()); // Security headers
    this.app.use(cors()); // Allow cross-domain
    this.app.use(express.json()); // Body parsing
    
    // Centralized rate limiting per client
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    });
    this.app.use(limiter);

    // Logging middleware
    this.app.use((req, res, next) => {
      console.log(`[GATEWAY LOG] ${new Date().toISOString()} - ${req.method} ${req.url}`);
      next();
    });
  }

  /**
   * Routing logic delegating to RouteManager.
   */
  private initializeRouting() {
    routeManager.registerRoutes(this.app);
  }

  /**
   * Health endpoint for service monitoring.
   */
  private initializeHealthCheck() {
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', timestamp: new Date(), service: 'gateway' });
    });
  }

  /**
   * Start the gateway server.
   */
  public start() {
    this.app.listen(this.port, () => {
      console.log(`APIGateway operational on port ${this.port} (Verinode v2.0 Microservices)`);
    });
  }
}

// Start instance
const gateway = new APIGateway();
gateway.start();

export default gateway;
