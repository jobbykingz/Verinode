import { PubSub } from 'graphql-subscriptions';
import { proofSubscriptions, PROOF_UPDATED, PROOF_CREATED, PROOF_STATUS_CHANGED } from '../subscriptions/proofSubscription';
import { Proof, ProofStatus } from '../../types';

// Mock PubSub for testing
jest.mock('graphql-subscriptions', () => ({
  PubSub: jest.fn().mockImplementation(() => ({
    asyncIterator: jest.fn(),
    publish: jest.fn(),
  })),
}));

describe('Proof Subscriptions', () => {
  let mockPubSub: jest.Mocked<PubSub>;
  let mockAsyncIterator: jest.Mock;

  beforeEach(() => {
    mockPubSub = new (PubSub as jest.MockedClass<typeof PubSub>)();
    mockAsyncIterator = mockPubSub.asyncIterator as jest.Mock;
    mockAsyncIterator.mockReturnValue(Symbol('iterator'));
  });

  describe('proofUpdated subscription', () => {
    it('should subscribe to proof updates', async () => {
      const result = proofSubscriptions.proofUpdated.subscribe(null, {});
      
      expect(mockAsyncIterator).toHaveBeenCalledWith([PROOF_UPDATED]);
      expect(result).toBeDefined();
    });

    it('should filter by userId when provided', async () => {
      const mockProof: Proof = {
        id: '1',
        userId: '1',
        title: 'Test Proof',
        description: 'Test Description',
        status: ProofStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = proofSubscriptions.proofUpdated.resolve(
        { proof: mockProof },
        { userId: '1' }
      );

      expect(result).toEqual(mockProof);
    });

    it('should return null when userId filter does not match', async () => {
      const mockProof: Proof = {
        id: '1',
        userId: '1',
        title: 'Test Proof',
        description: 'Test Description',
        status: ProofStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = proofSubscriptions.proofUpdated.resolve(
        { proof: mockProof },
        { userId: '2' }
      );

      expect(result).toBeNull();
    });
  });

  describe('proofCreated subscription', () => {
    it('should subscribe to proof creation', async () => {
      const result = proofSubscriptions.proofCreated.subscribe(null, {});
      
      expect(mockAsyncIterator).toHaveBeenCalledWith([PROOF_CREATED]);
      expect(result).toBeDefined();
    });

    it('should resolve proof creation events', async () => {
      const mockProof: Proof = {
        id: '1',
        userId: '1',
        title: 'Test Proof',
        description: 'Test Description',
        status: ProofStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = proofSubscriptions.proofCreated.resolve({ proof: mockProof });

      expect(result).toEqual(mockProof);
    });
  });

  describe('proofStatusChanged subscription', () => {
    it('should subscribe to proof status changes', async () => {
      const result = proofSubscriptions.proofStatusChanged.subscribe(null, {});
      
      expect(mockAsyncIterator).toHaveBeenCalledWith([PROOF_STATUS_CHANGED]);
      expect(result).toBeDefined();
    });

    it('should filter by status when provided', async () => {
      const mockProof: Proof = {
        id: '1',
        userId: '1',
        title: 'Test Proof',
        description: 'Test Description',
        status: ProofStatus.VERIFIED,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = proofSubscriptions.proofStatusChanged.resolve(
        { proof: mockProof },
        { status: ProofStatus.VERIFIED }
      );

      expect(result).toEqual(mockProof);
    });

    it('should return null when status filter does not match', async () => {
      const mockProof: Proof = {
        id: '1',
        userId: '1',
        title: 'Test Proof',
        description: 'Test Description',
        status: ProofStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = proofSubscriptions.proofStatusChanged.resolve(
        { proof: mockProof },
        { status: ProofStatus.VERIFIED }
      );

      expect(result).toBeNull();
    });
  });
});
