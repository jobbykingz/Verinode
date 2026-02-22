import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  scalar DateTime

  type User {
    id: ID!
    email: String!
    username: String!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Proof {
    id: ID!
    userId: ID!
    title: String!
    description: String!
    status: ProofStatus!
    createdAt: DateTime!
    updatedAt: DateTime!
    metadata: JSON
  }

  enum ProofStatus {
    PENDING
    VERIFIED
    REJECTED
  }

  scalar JSON

  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    # User queries
    me: User
    user(id: ID!): User
    users: [User!]!

    # Proof queries
    proof(id: ID!): Proof
    proofs(userId: ID, status: ProofStatus, first: Int, after: String): ProofConnection!
    myProofs(status: ProofStatus, first: Int, after: String): ProofConnection!
  }

  type Mutation {
    # Authentication
    login(email: String!, password: String!): AuthPayload!
    register(email: String!, username: String!, password: String!): AuthPayload!

    # Proof mutations
    createProof(title: String!, description: String!, metadata: JSON): Proof!
    updateProof(id: ID!, title: String, description: String, status: ProofStatus): Proof!
    deleteProof(id: ID!): Boolean!
  }

  type Subscription {
    # Real-time subscriptions
    proofUpdated(userId: ID): Proof!
    proofCreated: Proof!
    proofStatusChanged(status: ProofStatus): Proof!
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

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }
`;
