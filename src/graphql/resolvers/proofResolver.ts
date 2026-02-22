import { Proof, ProofStatus } from '../../types';
import { publishProofCreated, publishProofUpdated, publishProofStatusChanged } from '../subscriptions/proofSubscription';

// Mock data for demonstration
const mockProofs: Proof[] = [
  {
    id: '1',
    userId: '1',
    title: 'First Proof',
    description: 'This is the first proof',
    status: ProofStatus.PENDING,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    metadata: { type: 'document' },
  },
  {
    id: '2',
    userId: '1',
    title: 'Second Proof',
    description: 'This is the second proof',
    status: ProofStatus.VERIFIED,
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-03'),
    metadata: { type: 'image' },
  },
  {
    id: '3',
    userId: '2',
    title: 'Third Proof',
    description: 'This is the third proof',
    status: ProofStatus.REJECTED,
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-04'),
    metadata: { type: 'video' },
  },
];

export const proofResolvers = {
  Query: {
    proof: (_: any, { id }: { id: string }) => {
      return mockProofs.find(p => p.id === id);
    },

    proofs: (_: any, { userId, status, first = 10, after }: { userId?: string; status?: ProofStatus; first?: number; after?: string }) => {
      let filteredProofs = mockProofs;

      if (userId) {
        filteredProofs = filteredProofs.filter(p => p.userId === userId);
      }

      if (status) {
        filteredProofs = filteredProofs.filter(p => p.status === status);
      }

      // Simple pagination implementation
      const startIndex = after ? parseInt(after) + 1 : 0;
      const endIndex = startIndex + first;
      const paginatedProofs = filteredProofs.slice(startIndex, endIndex);

      return {
        edges: paginatedProofs.map((proof, index) => ({
          node: proof,
          cursor: String(startIndex + index),
        })),
        pageInfo: {
          hasNextPage: endIndex < filteredProofs.length,
          hasPreviousPage: startIndex > 0,
          startCursor: startIndex < filteredProofs.length ? String(startIndex) : null,
          endCursor: endIndex - 1 < filteredProofs.length ? String(endIndex - 1) : null,
        },
        totalCount: filteredProofs.length,
      };
    },

    myProofs: (_: any, { status, first = 10, after }: { status?: ProofStatus; first?: number; after?: string }, { user }: { user?: any }) => {
      if (!user) {
        throw new Error('Not authenticated');
      }

      let userProofs = mockProofs.filter(p => p.userId === user.id);

      if (status) {
        userProofs = userProofs.filter(p => p.status === status);
      }

      // Simple pagination implementation
      const startIndex = after ? parseInt(after) + 1 : 0;
      const endIndex = startIndex + first;
      const paginatedProofs = userProofs.slice(startIndex, endIndex);

      return {
        edges: paginatedProofs.map((proof, index) => ({
          node: proof,
          cursor: String(startIndex + index),
        })),
        pageInfo: {
          hasNextPage: endIndex < userProofs.length,
          hasPreviousPage: startIndex > 0,
          startCursor: startIndex < userProofs.length ? String(startIndex) : null,
          endCursor: endIndex - 1 < userProofs.length ? String(endIndex - 1) : null,
        },
        totalCount: userProofs.length,
      };
    },
  },

  Mutation: {
    createProof: (_: any, { title, description, metadata }: { title: string; description: string; metadata?: any }, { user }: { user?: any }) => {
      if (!user) {
        throw new Error('Not authenticated');
      }

      const newProof: Proof = {
        id: String(mockProofs.length + 1),
        userId: user.id,
        title,
        description,
        status: ProofStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata,
      };

      mockProofs.push(newProof);
      
      // Publish subscription events
      publishProofCreated(newProof);
      
      return newProof;
    },

    updateProof: (_: any, { id, title, description, status }: { id: string; title?: string; description?: string; status?: ProofStatus }, { user }: { user?: any }) => {
      if (!user) {
        throw new Error('Not authenticated');
      }

      const proofIndex = mockProofs.findIndex(p => p.id === id && p.userId === user.id);
      if (proofIndex === -1) {
        throw new Error('Proof not found or access denied');
      }

      const proof = mockProofs[proofIndex];
      if (title !== undefined) proof.title = title;
      if (description !== undefined) proof.description = description;
      if (status !== undefined) {
        const oldStatus = proof.status;
        proof.status = status;
        
        // Publish status change event if status actually changed
        if (oldStatus !== status) {
          publishProofStatusChanged(proof);
        }
      }
      proof.updatedAt = new Date();

      // Publish general proof update event
      publishProofUpdated(proof);

      return proof;
    },

    deleteProof: (_: any, { id }: { id: string }, { user }: { user?: any }) => {
      if (!user) {
        throw new Error('Not authenticated');
      }

      const proofIndex = mockProofs.findIndex(p => p.id === id && p.userId === user.id);
      if (proofIndex === -1) {
        throw new Error('Proof not found or access denied');
      }

      mockProofs.splice(proofIndex, 1);
      return true;
    },
  },
};
