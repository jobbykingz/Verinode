import { ProofAPI } from '../datasources/proofAPI';

export const resolvers = {
  Query: {
    proof: async (_: any, { id }: { id: string }, { dataSources }: { dataSources: { proofAPI: ProofAPI } }) => {
      return dataSources.proofAPI.getProofById(id);
    },
    proofs: async (
      _: any, 
      { filter, limit = 20, offset = 0 }: any, 
      { dataSources }: { dataSources: { proofAPI: ProofAPI } }
    ) => {
      return dataSources.proofAPI.getProofs(filter, limit, offset);
    },
    myProofs: async (
      _: any, 
      { filter, limit = 20, offset = 0 }: any, 
      { dataSources }: { dataSources: { proofAPI: ProofAPI } }
    ) => {
      return dataSources.proofAPI.getMyProofs(filter, limit, offset);
    },
    proofTemplates: async (_: any, __: any, { dataSources }: { dataSources: { proofAPI: ProofAPI } }) => {
      return dataSources.proofAPI.getProofTemplates();
    }
  },

  Mutation: {
    createProof: async (
      _: any, 
      { input }: any, 
      { dataSources }: { dataSources: { proofAPI: ProofAPI } }
    ) => {
      return dataSources.proofAPI.createProof(input);
    },
    updateProof: async (
      _: any, 
      { input }: any, 
      { dataSources }: { dataSources: { proofAPI: ProofAPI } }
    ) => {
      return dataSources.proofAPI.updateProof(input);
    },
    deleteProof: async (
      _: any, 
      { id }: { id: string }, 
      { dataSources }: { dataSources: { proofAPI: ProofAPI } }
    ) => {
      return dataSources.proofAPI.deleteProof(id);
    },
    verifyProof: async (
      _: any, 
      { id, signature }: any, 
      { dataSources }: { dataSources: { proofAPI: ProofAPI } }
    ) => {
      return dataSources.proofAPI.verifyProof(id, signature);
    },
    revokeProof: async (
      _: any, 
      { id, reason }: any, 
      { dataSources }: { dataSources: { proofAPI: ProofAPI } }
    ) => {
      return dataSources.proofAPI.revokeProof(id, reason);
    }
  },

  Proof: {
    __resolveReference: async (
      proof: { id: string }, 
      { dataSources }: { dataSources: { proofAPI: ProofAPI } }
    ) => {
      return dataSources.proofAPI.getProofById(proof.id);
    },

    issuer: async (proof: any, _: any, { dataSources }: { dataSources: { proofAPI: ProofAPI } }) => {
      return { __typename: 'User', id: proof.issuerId };
    },

    recipient: async (proof: any, _: any, { dataSources }: { dataSources: { proofAPI: ProofAPI } }) => {
      return { __typename: 'User', id: proof.recipientId };
    },

    template: async (proof: any, _: any, { dataSources }: { dataSources: { proofAPI: ProofAPI } }) => {
      return dataSources.proofAPI.getProofTemplate(proof.templateId);
    },

    verification: async (proof: any, _: any, { dataSources }: { dataSources: { proofAPI: ProofAPI } }) => {
      return dataSources.proofAPI.getVerificationInfo(proof.id);
    },

    verifications: async (proof: any, _: any, { dataSources }: { dataSources: { proofAPI: ProofAPI } }) => {
      return dataSources.proofAPI.getProofVerifications(proof.id);
    },

    attachments: async (proof: any, _: any, { dataSources }: { dataSources: { proofAPI: ProofAPI } }) => {
      return dataSources.proofAPI.getProofAttachments(proof.id);
    }
  },

  ProofTemplate: {
    __resolveReference: async (
      template: { id: string }, 
      { dataSources }: { dataSources: { proofAPI: ProofAPI } }
    ) => {
      return dataSources.proofAPI.getProofTemplate(template.id);
    },

    issuer: async (template: any, _: any, { dataSources }: { dataSources: { proofAPI: ProofAPI } }) => {
      return { __typename: 'User', id: template.issuerId };
    }
  },

  Verification: {
    verifier: async (verification: any, _: any, { dataSources }: { dataSources: { proofAPI: ProofAPI } }) => {
      return { __typename: 'User', id: verification.verifierId };
    },

    proof: async (verification: any, _: any, { dataSources }: { dataSources: { proofAPI: ProofAPI } }) => {
      return { __typename: 'Proof', id: verification.proofId };
    }
  }
};
