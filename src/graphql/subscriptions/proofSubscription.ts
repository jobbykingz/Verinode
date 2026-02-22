import { PubSub } from 'graphql-subscriptions';
import { Proof, ProofStatus } from '../../types';

const pubsub = new PubSub();

// Subscription event constants
export const PROOF_UPDATED = 'PROOF_UPDATED';
export const PROOF_CREATED = 'PROOF_CREATED';
export const PROOF_STATUS_CHANGED = 'PROOF_STATUS_CHANGED';

export const proofSubscriptions = {
  proofUpdated: {
    subscribe: (_: any, { userId }: { userId?: string }) => {
      return pubsub.asyncIterator([PROOF_UPDATED]);
    },
    resolve: (payload: any, args: { userId?: string }) => {
      // Filter by userId if provided
      if (args.userId && payload.proof.userId !== args.userId) {
        return null;
      }
      return payload.proof;
    },
  },

  proofCreated: {
    subscribe: () => {
      return pubsub.asyncIterator([PROOF_CREATED]);
    },
    resolve: (payload: any) => {
      return payload.proof;
    },
  },

  proofStatusChanged: {
    subscribe: (_: any, { status }: { status?: ProofStatus }) => {
      return pubsub.asyncIterator([PROOF_STATUS_CHANGED]);
    },
    resolve: (payload: any, args: { status?: ProofStatus }) => {
      // Filter by status if provided
      if (args.status && payload.proof.status !== args.status) {
        return null;
      }
      return payload.proof;
    },
  },
};

// Helper functions to publish events
export const publishProofUpdated = (proof: Proof) => {
  pubsub.publish(PROOF_UPDATED, { proof });
};

export const publishProofCreated = (proof: Proof) => {
  pubsub.publish(PROOF_CREATED, { proof });
};

export const publishProofStatusChanged = (proof: Proof) => {
  pubsub.publish(PROOF_STATUS_CHANGED, { proof });
};
