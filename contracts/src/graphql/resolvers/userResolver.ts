import { User } from '../../types';

// Mock data for demonstration
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

export const userResolvers = {
  Query: {
    me: (_: any, __: any, { user }: { user?: User }) => {
      if (!user) {
        throw new Error('Not authenticated');
      }
      return user;
    },

    user: (_: any, { id }: { id: string }) => {
      return mockUsers.find(u => u.id === id);
    },

    users: () => {
      return mockUsers;
    },
  },

  Mutation: {
    login: async (_: any, { email, password }: { email: string; password: string }) => {
      // Mock authentication - in real implementation, verify password
      const user = mockUsers.find(u => u.email === email);
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Mock JWT token
      const token = `mock-jwt-token-${user.id}`;
      
      return {
        token,
        user,
      };
    },

    register: async (_: any, { email, username, password }: { email: string; username: string; password: string }) => {
      // Check if user already exists
      const existingUser = mockUsers.find(u => u.email === email || u.username === username);
      if (existingUser) {
        throw new Error('User already exists');
      }

      // Create new user
      const newUser: User = {
        id: String(mockUsers.length + 1),
        email,
        username,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUsers.push(newUser);

      // Mock JWT token
      const token = `mock-jwt-token-${newUser.id}`;
      
      return {
        token,
        user: newUser,
      };
    },
  },
};
