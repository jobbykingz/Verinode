import { userResolvers } from '../resolvers/userResolver';
import { proofResolvers } from '../resolvers/proofResolver';
import { User, ProofStatus } from '../../types';

describe('User Resolvers', () => {
  const mockUser: User = {
    id: '1',
    email: 'user1@example.com',
    username: 'user1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  describe('Query.me', () => {
    it('should return the authenticated user', async () => {
      const result = await userResolvers.Query.me(null, null, { user: mockUser });
      expect(result).toEqual(mockUser);
    });

    it('should throw error when not authenticated', async () => {
      await expect(userResolvers.Query.me(null, null, { user: undefined }))
        .rejects.toThrow('Not authenticated');
    });
  });

  describe('Query.user', () => {
    it('should return user by ID', async () => {
      const result = await userResolvers.Query.user(null, { id: '1' });
      expect(result).toEqual(mockUser);
    });

    it('should return null for non-existent user', async () => {
      const result = await userResolvers.Query.user(null, { id: '999' });
      expect(result).toBeUndefined();
    });
  });

  describe('Query.users', () => {
    it('should return all users', async () => {
      const result = await userResolvers.Query.users();
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('email');
      expect(result[0]).toHaveProperty('username');
    });
  });

  describe('Mutation.login', () => {
    it('should login with valid credentials', async () => {
      const result = await userResolvers.Mutation.login(null, {
        email: 'user1@example.com',
        password: 'password'
      });
      
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe('user1@example.com');
    });

    it('should throw error with invalid credentials', async () => {
      await expect(userResolvers.Mutation.login(null, {
        email: 'invalid@example.com',
        password: 'wrong'
      })).rejects.toThrow('Invalid credentials');
    });
  });

  describe('Mutation.register', () => {
    it('should register new user', async () => {
      const result = await userResolvers.Mutation.register(null, {
        email: 'newuser@example.com',
        username: 'newuser',
        password: 'password'
      });
      
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe('newuser@example.com');
      expect(result.user.username).toBe('newuser');
    });

    it('should throw error when user already exists', async () => {
      await expect(userResolvers.Mutation.register(null, {
        email: 'user1@example.com',
        username: 'user1',
        password: 'password'
      })).rejects.toThrow('User already exists');
    });
  });
});

describe('Proof Resolvers', () => {
  const mockUser: User = {
    id: '1',
    email: 'user1@example.com',
    username: 'user1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  describe('Query.proof', () => {
    it('should return proof by ID', async () => {
      const result = await proofResolvers.Query.proof(null, { id: '1' });
      expect(result).toHaveProperty('id', '1');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('description');
    });

    it('should return null for non-existent proof', async () => {
      const result = await proofResolvers.Query.proof(null, { id: '999' });
      expect(result).toBeUndefined();
    });
  });

  describe('Query.proofs', () => {
    it('should return paginated proofs', async () => {
      const result = await proofResolvers.Query.proofs(null, { first: 2 });
      
      expect(result).toHaveProperty('edges');
      expect(result).toHaveProperty('pageInfo');
      expect(result).toHaveProperty('totalCount');
      expect(result.edges).toHaveLength(2);
      expect(result.totalCount).toBe(3);
    });

    it('should filter proofs by userId', async () => {
      const result = await proofResolvers.Query.proofs(null, { userId: '1' });
      expect(result.totalCount).toBe(2);
    });

    it('should filter proofs by status', async () => {
      const result = await proofResolvers.Query.proofs(null, { status: ProofStatus.PENDING });
      expect(result.totalCount).toBe(1);
    });
  });

  describe('Query.myProofs', () => {
    it('should return authenticated user\'s proofs', async () => {
      const result = await proofResolvers.Query.myProofs(null, {}, { user: mockUser });
      expect(result.totalCount).toBe(2);
    });

    it('should throw error when not authenticated', async () => {
      await expect(proofResolvers.Query.myProofs(null, {}, { user: undefined }))
        .rejects.toThrow('Not authenticated');
    });
  });

  describe('Mutation.createProof', () => {
    it('should create new proof', async () => {
      const result = await proofResolvers.Mutation.createProof(
        null,
        {
          title: 'New Proof',
          description: 'This is a new proof',
          metadata: { type: 'document' }
        },
        { user: mockUser }
      );
      
      expect(result).toHaveProperty('id');
      expect(result.title).toBe('New Proof');
      expect(result.description).toBe('This is a new proof');
      expect(result.status).toBe(ProofStatus.PENDING);
      expect(result.userId).toBe(mockUser.id);
    });

    it('should throw error when not authenticated', async () => {
      await expect(proofResolvers.Mutation.createProof(
        null,
        { title: 'New Proof', description: 'Description' },
        { user: undefined }
      )).rejects.toThrow('Not authenticated');
    });
  });

  describe('Mutation.updateProof', () => {
    it('should update existing proof', async () => {
      const result = await proofResolvers.Mutation.updateProof(
        null,
        {
          id: '1',
          title: 'Updated Title',
          status: ProofStatus.VERIFIED
        },
        { user: mockUser }
      );
      
      expect(result.title).toBe('Updated Title');
      expect(result.status).toBe(ProofStatus.VERIFIED);
    });

    it('should throw error for non-existent proof', async () => {
      await expect(proofResolvers.Mutation.updateProof(
        null,
        { id: '999', title: 'Updated' },
        { user: mockUser }
      )).rejects.toThrow('Proof not found or access denied');
    });
  });

  describe('Mutation.deleteProof', () => {
    it('should delete existing proof', async () => {
      const result = await proofResolvers.Mutation.deleteProof(
        null,
        { id: '1' },
        { user: mockUser }
      );
      
      expect(result).toBe(true);
    });

    it('should throw error for non-existent proof', async () => {
      await expect(proofResolvers.Mutation.deleteProof(
        null,
        { id: '999' },
        { user: mockUser }
      )).rejects.toThrow('Proof not found or access denied');
    });
  });
});
