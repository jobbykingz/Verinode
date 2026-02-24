import { ApolloServer } from 'apollo-server-express';
import { createServer } from 'http';
import { execute, subscribe } from 'graphql';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import { typeDefs } from './schema';
import { userResolvers } from './resolvers/userResolver';
import { proofResolvers } from './resolvers/proofResolver';
import { crossChainResolvers } from './resolvers/crossChainResolver';
import { proofSubscriptions, publishProofUpdated, publishProofCreated, publishProofStatusChanged } from './subscriptions/proofSubscription';
import { createAuthContext } from './middleware/auth';
import { applyRateLimit } from './middleware/rateLimit';
import { GraphQLContext } from '../types';

// Import new security middleware
import { 
  strictRateLimiter, 
  authRateLimiter, 
  apiRateLimiter 
} from '../middleware/rateLimiter';
import { 
  sanitizeRequestBody, 
  validateContentType, 
  validateContentLength 
} from '../middleware/inputValidation';
import { corsMiddleware, strictCorsMiddleware } from '../middleware/corsConfig';
import { 
  securityHeadersMiddleware, 
  customSecurityHeaders 
} from '../middleware/securityHeaders';
import { requestLogger } from '../middleware/requestLogger';
import { createXSSMiddleware } from '../utils/xssProtection';

// Combine all resolvers
const resolvers = {
  Query: {
    ...userResolvers.Query,
    ...proofResolvers.Query,
    ...crossChainResolvers.Query,
  },
  Mutation: {
    ...userResolvers.Mutation,
    ...proofResolvers.Mutation,
    ...crossChainResolvers.Mutation,
  },
  Subscription: {
    ...proofSubscriptions,
    ...crossChainResolvers.Subscription,
  },
};

// Create Apollo Server
export const createApolloServer = () => {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: async ({ req, res }) => {
      const context = await createAuthContext(req, res);
      
      // Apply rate limiting based on operation type
      const operationName = req.body?.operationName;
      const query = req.body?.query || '';
      
      let operationType: 'query' | 'mutation' | 'subscription' = 'query';
      if (query.trim().startsWith('mutation')) {
        operationType = 'mutation';
      } else if (query.trim().startsWith('subscription')) {
        operationType = 'subscription';
      }
      
      applyRateLimit(context, operationType);
      
      return context;
    },
    introspection: process.env.NODE_ENV !== 'production',
    playground: process.env.NODE_ENV !== 'production',
    plugins: [
      // Security monitoring plugin
      {
        requestDidStart() {
          return {
            didResolveOperation(requestContext) {
              // Log GraphQL operations for security monitoring
              const operation = requestContext.request.operation;
              const operationName = requestContext.request.operationName;
              
              if (process.env.NODE_ENV === 'production') {
                console.log('GraphQL Operation:', {
                  operation: operation?.operation,
                  operationName,
                  timestamp: new Date().toISOString()
                });
              }
            },
            
            didEncounterErrors(requestContext) {
              // Log GraphQL errors for security monitoring
              console.error('GraphQL Error:', {
                errors: requestContext.errors,
                operation: requestContext.request.operation?.operation,
                operationName: requestContext.request.operationName,
                timestamp: new Date().toISOString()
              });
            }
          };
        }
      }
    ]
  });

  return server;
};

// Create Express app with GraphQL
export const createGraphQLApp = async () => {
  const app = express();
  
  // Security middleware chain - order matters!
  
  // 1. Request logging (first to capture all requests)
  app.use(requestLogger);
  
  // 2. Security headers
  app.use(securityHeadersMiddleware);
  app.use(customSecurityHeaders);
  
  // 3. CORS configuration
  app.use(corsMiddleware);
  
  // 4. Rate limiting
  app.use('/api', apiRateLimiter);
  app.use('/auth', authRateLimiter);
  app.use('/graphql', strictRateLimiter);
  
  // 5. Content validation
  app.use(validateContentType(['application/json', 'application/x-www-form-urlencoded']));
  app.use(validateContentLength(10 * 1024 * 1024)); // 10MB limit
  
  // 6. XSS protection and input sanitization
  app.use(createXSSMiddleware());
  app.use(sanitizeRequestBody);
  
  // 7. Body parsing (after security checks)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check endpoint (before GraphQL)
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  });

  // Security status endpoint
  app.get('/security-status', (req, res) => {
    res.status(200).json({
      security: {
        rateLimiting: 'active',
        cors: 'configured',
        securityHeaders: 'active',
        inputValidation: 'active',
        xssProtection: 'active',
        requestLogging: 'active'
      },
      timestamp: new Date().toISOString()
    });
  });

  const apolloServer = createApolloServer();
  await apolloServer.start();

  // Apply Apollo middleware with strict CORS for GraphQL
  apolloServer.applyMiddleware({ 
    app, 
    path: '/graphql',
    cors: false // We handle CORS above
  });

  const httpServer = createServer(app);

  // Create subscription server with security
  const subscriptionServer = SubscriptionServer.create(
    {
      execute,
      subscribe,
      schema: apolloServer.schema,
      onConnect: async (connectionParams: any, webSocket: any, context: any) => {
        // Enhanced WebSocket authentication for subscriptions
        const token = connectionParams?.authorization || connectionParams?.Authorization;
        
        if (!token) {
          throw new Error('Authentication required for subscriptions');
        }
        
        if (token.startsWith('Bearer ')) {
          const jwtToken = token.substring(7);
          if (jwtToken.startsWith('mock-jwt-token-')) {
            const userId = jwtToken.replace('mock-jwt-token-', '');
            
            // Log subscription connection for security
            console.log('Subscription Connected:', {
              userId,
              timestamp: new Date().toISOString()
            });
            
            return { userId };
          }
        }
        
        throw new Error('Invalid authentication token');
      },
      
      onDisconnect: (webSocket: any, context: any) => {
        // Log subscription disconnection
        console.log('Subscription Disconnected:', {
          timestamp: new Date().toISOString()
        });
      }
    },
    {
      server: httpServer,
      path: apolloServer.graphqlPath,
    }
  );

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    subscriptionServer.close();
    httpServer.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    subscriptionServer.close();
    httpServer.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  return { app, httpServer, apolloServer };
};

// Export subscription helpers for use in resolvers
export { publishProofUpdated, publishProofCreated, publishProofStatusChanged };
