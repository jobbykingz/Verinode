import { User, GraphQLContext } from '../../types';

// Mock JWT verification - in real implementation, use jsonwebtoken library
export const authenticate = async (req: any): Promise<User | null> => {
  const authHeader = req.headers.authorization || '';
  
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  // Mock token verification
  if (token.startsWith('mock-jwt-token-')) {
    const userId = token.replace('mock-jwt-token-', '');
    
    // Mock user lookup - in real implementation, query database
    const mockUsers: User[] = [
      {
        id: '1',
        email: 'user1@example.com',
        username: 'user1',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      {
        id: '2',
        email: 'user2@example.com',
        username: 'user2',
        createdAt: new Date('2024-01-02'),
        updatedAt: new Date('2024-01-02'),
      },
    ];

    return mockUsers.find(u => u.id === userId) || null;
  }

  return null;
};

export const createAuthContext = async (req: any, res: any): Promise<GraphQLContext> => {
  const user = await authenticate(req);
  
  return {
    user: user || undefined,
    req,
    res,
  };
};

// Middleware for protecting specific resolvers
export const requireAuth = (resolver: any) => {
  return (_: any, args: any, context: GraphQLContext) => {
    if (!context.user) {
      throw new Error('Authentication required');
    }
    return resolver(_, args, context);
  };
};
