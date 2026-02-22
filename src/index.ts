import { createGraphQLApp } from './graphql/server';

const PORT = process.env.PORT || 4000;

const startServer = async () => {
  try {
    const { app, httpServer } = await createGraphQLApp();
    
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
      console.log(`🚀 Subscriptions ready at ws://localhost:${PORT}/graphql`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
};

startServer();
