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

  type ChainConfig {
    chainId: Int!
    name: String!
    rpcUrl: String!
    bridgeAddress: String!
    gasPrice: BigInt!
    blockTime: Int!
    nativeCurrency: NativeCurrency!
  }

  type NativeCurrency {
    name: String!
    symbol: String!
    decimals: Int!
  }

  type CrossChainTransfer {
    transferId: String!
    fromChain: Int!
    toChain: Int!
    sender: String!
    recipient: String!
    amount: String!
    tokenAddress: String!
    timestamp: DateTime!
    status: TransferStatus!
    proofHash: String!
    gasUsed: String
    txHash: String
    fees: String
  }

  type CrossChainProof {
    proofId: String!
    chainId: Int!
    blockNumber: Int!
    transactionHash: String!
    proofData: String!
    merkleRoot: String!
    merkleProof: [String!]!
    timestamp: DateTime!
    verificationResult: VerificationResult!
  }

  type WalletInfo {
    address: String!
    chainId: Int!
    balance: String!
    connected: Boolean!
  }

  type AtomicSwap {
    swapId: String!
    initiator: String!
    participant: String
    initiatorChain: Int!
    participantChain: Int!
    initiatorAsset: AssetInfo!
    participantAsset: AssetInfo!
    status: SwapStatus!
    secretHash: String!
    timelock: Int!
    createdAt: DateTime!
    expiresAt: DateTime!
  }

  type AssetInfo {
    tokenAddress: String!
    amount: String!
    decimals: Int!
  }

  type GasOptimization {
    gasLimit: String!
    gasPrice: String!
    maxFeePerGas: String
    maxPriorityFeePerGas: String
    estimatedCost: String!
    optimizedCost: String!
    savings: String!
    savingsPercentage: Float!
  }

  enum TransferStatus {
    PENDING
    IN_PROGRESS
    COMPLETED
    FAILED
    REFUNDED
  }

  enum VerificationResult {
    VALID
    INVALID
    PENDING
    EXPIRED
    INSUFFICIENT_CONFIRMATIONS
    MALFORMED_PROOF
  }

  enum SwapStatus {
    INITIATED
    DEPOSITED
    REDEEMED
    REFUNDED
    EXPIRED
    CANCELLED
  }

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

    # Cross-chain queries
    supportedChains: [ChainConfig!]!
    walletInfo(address: String!, chainId: Int!): WalletInfo!
    crossChainTransfer(transferId: String!): CrossChainTransfer
    crossChainTransfers(status: TransferStatus, first: Int, after: String): [CrossChainTransfer!]!
    crossChainProof(proofId: String!): CrossChainProof
    atomicSwap(swapId: String!): AtomicSwap
    atomicSwaps(status: SwapStatus, first: Int, after: String): [AtomicSwap!]!
    optimizeGas(fromChain: Int!, toChain: Int!, amount: String!): GasOptimization!
  }

  type Mutation {
    # Authentication
    login(email: String!, password: String!): AuthPayload!
    register(email: String!, username: String!, password: String!): AuthPayload!

    # Proof mutations
    createProof(title: String!, description: String!, metadata: JSON): Proof!
    updateProof(id: ID!, title: String, description: String, status: ProofStatus): Proof!
    deleteProof(id: ID!): Boolean!

    # Cross-chain mutations
    initiateCrossChainTransfer(
      transferId: String!
      fromChain: Int!
      toChain: Int!
      recipient: String!
      amount: String!
      tokenAddress: String!
    ): CrossChainTransfer!
    
    completeCrossChainTransfer(transferId: String!): CrossChainTransfer!
    
    verifyCrossChainProof(
      proofId: String!
      chainId: Int!
      blockNumber: Int!
      transactionHash: String!
      proofData: String!
      merkleRoot: String!
      merkleProof: [String!]!
    ): CrossChainProof!
    
    initiateAtomicSwap(
      swapId: String!
      participantChain: Int!
      participantAsset: AssetInfo!
      secretHash: String!
      timelock: Int!
    ): AtomicSwap!
    
    participateAtomicSwap(swapId: String!, participant: String!): AtomicSwap!
    
    redeemAtomicSwap(swapId: String!, secret: String!): AtomicSwap!
    
    refundAtomicSwap(swapId: String!): AtomicSwap!
    
    switchChain(targetChainId: Int!): WalletInfo!
  }

  type Subscription {
    # Real-time subscriptions
    proofUpdated(userId: ID): Proof!
    proofCreated: Proof!
    proofStatusChanged(status: ProofStatus): Proof!
    
    # Cross-chain subscriptions
    crossChainTransferUpdated(transferId: String): CrossChainTransfer!
    crossChainProofVerified(proofId: String): CrossChainProof!
    atomicSwapUpdated(swapId: String): AtomicSwap!
    chainStatusUpdated(chainId: Int): ChainConfig!
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
