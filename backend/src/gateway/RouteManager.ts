import express, { Router } from 'express';
import axios from 'axios';

/**
 * Route Manager for the API Gateway.
 * Maps incoming requests to the appropriate microservices.
 */
class RouteManager {
  private serviceMap: Map<string, string> = new Map();

  constructor() {
    this.initializeRoutes();
  }

  /**
   * Defines the internal service discovery and endpoint mapping.
   */
  private initializeRoutes() {
    // Port mappings (development/docker values)
    this.serviceMap.set('/api/auth', 'http://auth-service:4001');
    this.serviceMap.set('/api/users', 'http://user-service:4002');
    this.serviceMap.set('/api/proofs', 'http://proof-service:4003');
    this.serviceMap.set('/api/verify', 'http://verification-service:4004');
    this.serviceMap.set('/api/notifications', 'http://notification-service:4005');
  }

  /**
   * Proxy request to the specified service.
   */
  public getProxyMiddleware(servicePath: string) {
    const targetBase = this.serviceMap.get(servicePath);
    if (!targetBase) throw new Error(`Service mapping not found for ${servicePath}`);

    return async (req: express.Request, res: express.Response) => {
      const url = `${targetBase}${req.originalUrl}`;
      
      try {
        const response = await axios({
          method: req.method,
          url: url,
          data: req.body,
          headers: {
            ...req.headers,
            host: new URL(targetBase).host
          },
          params: req.query
        });

        res.status(response.status).json(response.data);
      } catch (error: any) {
        if (error.response) {
          res.status(error.response.status).json(error.response.data);
        } else {
          res.status(502).json({ 
            error: 'Service Unavailable',
            service: servicePath,
            message: error.message 
          });
        }
      }
    };
  }

  /**
   * Registers all routes on the provided express router.
   */
  public registerRoutes(router: Router) {
    this.serviceMap.forEach((_, path) => {
      router.all(`${path}*`, this.getProxyMiddleware(path));
    });
  }
}

export default new RouteManager();
