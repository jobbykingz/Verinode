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
import { proofSubscriptions, publishProofUpdated, publishProofCreated, publishProofStatusChanged } from './subscriptions/proofSubscription';
import { createAuthContext } from './middleware/auth';
import { applyRateLimit } from './middleware/rateLimit';
import { GraphQLContext } from '../types';

// Combine all resolvers
const resolvers = {
  Query: {
    ...userResolvers.Query,
    ...proofResolvers.Query,
  },
  Mutation: {
    ...userResolvers.Mutation,
    ...proofResolvers.Mutation,
  },
  Subscription: {
    ...proofSubscriptions,
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
  });

  return server;
};

// Create Express app with GraphQL
export const createGraphQLApp = async () => {
  const app = express();
  
  // Security middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  const apolloServer = createApolloServer();
  await apolloServer.start();

  // Apply Apollo middleware
  apolloServer.applyMiddleware({ 
    app, 
    path: '/graphql',
    cors: false // We handle CORS above
  });

  const httpServer = createServer(app);

  // Create subscription server
  const subscriptionServer = SubscriptionServer.create(
    {
      execute,
      subscribe,
      schema: apolloServer.schema,
      onConnect: async (connectionParams: any, webSocket: any, context: any) => {
        // Handle WebSocket authentication for subscriptions
        const token = connectionParams?.authorization || connectionParams?.Authorization;
        
        if (token && token.startsWith('Bearer ')) {
          // Mock authentication for subscriptions
          const jwtToken = token.substring(7);
          if (jwtToken.startsWith('mock-jwt-token-')) {
            const userId = jwtToken.replace('mock-jwt-token-', '');
            return { userId };
          }
        }
        
        return {};
      },
    },
    {
      server: httpServer,
      path: apolloServer.graphqlPath,
    }
  );

  // Graceful shutdown
  process.on('SIGTERM', () => {
    subscriptionServer.close();
    httpServer.close(() => {
      console.log('Server closed');
    });
  });

  return { app, httpServer, apolloServer };
};

// Export subscription helpers for use in resolvers
export { publishProofUpdated, publishProofCreated, publishProofStatusChanged };
