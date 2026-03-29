import { gql } from 'apollo-server';

export const typeDefs = gql`
  extend type Query {
    proof(id: ID!): Proof
    proofs(filter: ProofFilter, limit: Int, offset: Int): ProofConnection
    myProofs(filter: ProofFilter, limit: Int, offset: Int): ProofConnection
    proofTemplates: [ProofTemplate!]!
  }

  extend type Mutation {
    createProof(input: CreateProofInput!): Proof!
    updateProof(input: UpdateProofInput!): Proof!
    deleteProof(id: ID!): Boolean!
    verifyProof(id: ID!, signature: String!): VerificationResult!
    revokeProof(id: ID!, reason: String!): Proof!
  }

  type Proof @key(fields: "id") {
    id: ID!
    title: String!
    description: String
    type: ProofType!
    status: ProofStatus!
    issuer: User! @external
    recipient: User! @external
    template: ProofTemplate!
    data: ProofData!
    metadata: ProofMetadata!
    verification: VerificationInfo!
    createdAt: DateTime!
    updatedAt: DateTime!
    expiresAt: DateTime
    revokedAt: DateTime
    revokedReason: String
    tags: [String!]!
    attachments: [Attachment!]!
    shareableLink: String
    views: Int!
    verifications: [Verification!]!
  }

  type ProofTemplate @key(fields: "id") {
    id: ID!
    name: String!
    description: String
    version: String!
    schema: ProofSchema!
    issuer: User! @external
    category: String!
    tags: [String!]!
    isActive: Boolean!
    createdAt: DateTime!
    updatedAt: DateTime!
    usageCount: Int!
  }

  type ProofData {
    fields: [ProofField!]!
    documents: [Document!]!
    signatures: [Signature!]!
    hashes: [Hash!]!
  }

  type ProofField {
    name: String!
    value: String!
    type: FieldType!
    required: Boolean!
    encrypted: Boolean!
    verified: Boolean!
  }

  type Document {
    id: ID!
    name: String!
    type: String!
    size: Int!
    url: String!
    hash: String!
    uploadedAt: DateTime!
  }

  type Signature {
    algorithm: String!
    value: String!
    signer: String!
    timestamp: DateTime!
    verified: Boolean!
  }

  type Hash {
    algorithm: String!
    value: String!
    timestamp: DateTime!
  }

  type ProofMetadata {
    version: String!
    schema: String!
    network: String!
    transactionHash: String
    blockNumber: Int
    gasUsed: Int
    confirmations: Int!
  }

  type VerificationInfo {
    verified: Boolean!
    verifiedAt: DateTime
    verifiedBy: User @external
    verificationMethod: VerificationMethod!
    score: Float!
    confidence: Float!
    details: [VerificationDetail!]!
  }

  type VerificationDetail {
    field: String!
    status: VerificationStatus!
    message: String
    timestamp: DateTime!
  }

  type Verification {
    id: ID!
    proof: Proof!
    verifier: User! @external
    method: VerificationMethod!
    result: VerificationResult!
    timestamp: DateTime!
    ipAddress: String!
    userAgent: String!
    blockchainTx: String
  }

  type VerificationResult {
    success: Boolean!
    score: Float!
    confidence: Float!
    issues: [VerificationIssue!]!
    recommendations: [String!]!
    verifiedAt: DateTime!
  }

  type VerificationIssue {
    severity: IssueSeverity!
    field: String!
    message: String!
    suggestion: String
  }

  type Attachment {
    id: ID!
    name: String!
    type: String!
    size: Int!
    url: String!
    hash: String!
    description: String
    uploadedAt: DateTime!
  }

  type ProofConnection {
    edges: [ProofEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ProofEdge {
    node: Proof!
    cursor: String!
  }

  type ProofSchema {
    version: String!
    fields: [SchemaField!]!
    validation: ValidationRules!
    encryption: EncryptionRules!
  }

  type SchemaField {
    name: String!
    type: FieldType!
    required: Boolean!
    encrypted: Boolean!
    validation: FieldValidation!
  }

  type FieldValidation {
    pattern: String
    minLength: Int
    maxLength: Int
    min: Float
    max: Float
    options: [String!]
  }

  type ValidationRules {
    required: [String!]!
    conditional: [ConditionalRule!]!
    custom: [CustomRule!]!
  }

  type ConditionalRule {
    field: String!
    condition: String!
    required: [String!]!
  }

  type CustomRule {
    name: String!
    pattern: String!
    message: String!
  }

  type EncryptionRules {
    fields: [String!]!
    algorithm: String!
    keyRotation: Int!
  }

  input CreateProofInput {
    title: String!
    description: String
    type: ProofType!
    recipientId: ID!
    templateId: ID!
    data: ProofDataInput!
    tags: [String!]
    expiresAt: DateTime
  }

  input ProofDataInput {
    fields: [ProofFieldInput!]!
    documentIds: [ID!]
    signatures: [SignatureInput!]!
  }

  input ProofFieldInput {
    name: String!
    value: String!
    encrypted: Boolean
  }

  input SignatureInput {
    algorithm: String!
    value: String!
  }

  input UpdateProofInput {
    id: ID!
    title: String
    description: String
    data: ProofDataInput
    tags: [String!]
    expiresAt: DateTime
  }

  input ProofFilter {
    type: ProofType
    status: ProofStatus
    issuerId: ID
    recipientId: ID
    templateId: ID
    tags: [String!]
    createdAfter: DateTime
    createdBefore: DateTime
    expiresAfter: DateTime
    expiresBefore: DateTime
    verified: Boolean
    search: String
  }

  enum ProofType {
    IDENTITY
    EDUCATION
    PROFESSIONAL
    FINANCIAL
    MEDICAL
    LEGAL
    TECHNICAL
    CUSTOM
  }

  enum ProofStatus {
    DRAFT
    PENDING
    ACTIVE
    EXPIRED
    REVOKED
    SUSPENDED
  }

  enum VerificationMethod {
    AUTOMATIC
    MANUAL
    BLOCKCHAIN
    ZERO_KNOWLEDGE
    MULTI_SIG
  }

  enum VerificationStatus {
    VALID
    INVALID
    PENDING
    ERROR
  }

  enum IssueSeverity {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  enum FieldType {
    STRING
    NUMBER
    BOOLEAN
    DATE
    EMAIL
    URL
    FILE
    ENCRYPTED
  }

  scalar DateTime
  scalar PageInfo
`;

export const resolvers = {
  Query: {
    proof: async (_: any, { id }: { id: string }, { dataSources }: any) => {
      return dataSources.proofAPI.getProofById(id);
    },
    proofs: async (_: any, { filter, limit = 20, offset = 0 }: any, { dataSources }: any) => {
      return dataSources.proofAPI.getProofs(filter, limit, offset);
    },
    myProofs: async (_: any, { filter, limit = 20, offset = 0 }: any, { dataSources }: any) => {
      return dataSources.proofAPI.getMyProofs(filter, limit, offset);
    },
    proofTemplates: async (_: any, __: any, { dataSources }: any) => {
      return dataSources.proofAPI.getProofTemplates();
    }
  },

  Mutation: {
    createProof: async (_: any, { input }: any, { dataSources }: any) => {
      return dataSources.proofAPI.createProof(input);
    },
    updateProof: async (_: any, { input }: any, { dataSources }: any) => {
      return dataSources.proofAPI.updateProof(input);
    },
    deleteProof: async (_: any, { id }: { id: string }, { dataSources }: any) => {
      return dataSources.proofAPI.deleteProof(id);
    },
    verifyProof: async (_: any, { id, signature }: any, { dataSources }: any) => {
      return dataSources.proofAPI.verifyProof(id, signature);
    },
    revokeProof: async (_: any, { id, reason }: any, { dataSources }: any) => {
      return dataSources.proofAPI.revokeProof(id, reason);
    }
  },

  Proof: {
    __resolveReference: async (proof: { id: string }, { dataSources }: any) => {
      return dataSources.proofAPI.getProofById(proof.id);
    },

    issuer: async (proof: any, _: any, { dataSources }: any) => {
      return { __typename: 'User', id: proof.issuerId };
    },

    recipient: async (proof: any, _: any, { dataSources }: any) => {
      return { __typename: 'User', id: proof.recipientId };
    },

    template: async (proof: any, _: any, { dataSources }: any) => {
      return dataSources.proofAPI.getProofTemplate(proof.templateId);
    },

    verifications: async (proof: any, _: any, { dataSources }: any) => {
      return dataSources.proofAPI.getProofVerifications(proof.id);
    }
  },

  ProofTemplate: {
    __resolveReference: async (template: { id: string }, { dataSources }: any) => {
      return dataSources.proofAPI.getProofTemplate(template.id);
    },

    issuer: async (template: any, _: any, { dataSources }: any) => {
      return { __typename: 'User', id: template.issuerId };
    }
  }
};
