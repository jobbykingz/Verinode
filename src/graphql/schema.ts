import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  scalar DateTime
  scalar JSON

  # Compliance Types
  enum RequestType {
    ACCESS
    PORTABILITY
    ERASURE
    RECTIFICATION
    RESTRICTION
  }

  enum DataSubjectRequestStatus {
    PENDING
    IN_PROGRESS
    COMPLETED
    REJECTED
  }

  enum KYCLevel {
    BASIC
    ENHANCED
    PREMIUM
  }

  enum KYCStatus {
    NOT_STARTED
    INITIATED
    IN_PROGRESS
    APPROVED
    REJECTED
  }

  enum RiskLevel {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  enum ComplianceRegion {
    EU
    UK
    US
    CN
    IN
  }

  type DataSubjectRequest {
    requestId: ID!
    userId: ID!
    requestType: RequestType!
    status: DataSubjectRequestStatus!
    createdAt: DateTime!
    deadline: DateTime!
    completedAt: DateTime
    result: JSON
  }

  type ConsentRecord {
    consentId: ID!
    userId: ID!
    purpose: String!
    explicit: Boolean!
    grantedAt: DateTime!
    withdrawn: Boolean!
    withdrawnAt: DateTime
    expirationDate: DateTime
  }

  type KYCSession {
    verificationId: ID!
    userId: ID!
    provider: String!
    level: KYCLevel!
    status: String!
    applicantUrl: String
    completedAt: DateTime
    riskLevel: RiskLevel
  }

  type AMLScreeningResult {
    screeningId: ID!
    matches: [AMLMatch!]!
    riskScore: Int!
    riskLevel: RiskLevel!
    cleared: Boolean!
  }

  type AMLMatch {
    name: String!
    type: String!
    source: String!
    matchStrength: Float!
    details: JSON
  }

  type ResidencyInfo {
    region: ComplianceRegion!
    dataCenters: [String!]!
    regulations: [String!]!
    restrictions: ResidencyRestrictions!
  }

  type ResidencyRestrictions {
    requireLocalStorage: Boolean!
    allowCrossBorderTransfer: Boolean!
    requireAdequacyDecision: Boolean
  }

  type ComplianceDashboard {
    timestamp: DateTime!
    timeRange: String!
    overview: ComplianceOverview!
    gdprMetrics: GDPRMetrics!
    kycAmlMetrics: KYCAMLMetrics!
    residencyMetrics: ResidencyMetrics!
    alerts: ComplianceAlerts!
    trends: ComplianceTrends!
  }

  type ComplianceOverview {
    totalRequests: Int!
    completedRequests: Int!
    pendingRequests: Int!
    averageCompletionTime: Float!
    complianceRate: Float!
  }

  type GDPRMetrics {
    dataSubjectRequests: Int!
    averageResponseTime: Float!
    slaComplianceRate: Float!
    consentsGranted: Int!
    consentsWithdrawn: Int!
    erasureRequestsCompleted: Int!
  }

  type KYCAMLMetrics {
    kycVerificationsCompleted: Int!
    averageVerificationTime: Float!
    approvalRate: Float!
    amlScreeningsPerformed: Int!
    highRiskMatches: Int!
    ongoingMonitoringAlerts: Int!
  }

  type ResidencyMetrics {
    usersByRegion: JSON!
    dataByRegion: JSON!
    crossBorderTransfers: Int!
    residencyViolations: Int!
    complianceRate: Float!
  }

  type ComplianceAlerts {
    critical: Int!
    high: Int!
    medium: Int!
    openInvestigations: Int!
  }

  type ComplianceTrends {
    requestVolume: [DataPoint!]!
    complianceScores: [DataPoint!]!
    responseTimes: [DataPoint!]!
    violationRates: [DataPoint!]!
  }

  type DataPoint {
    timestamp: DateTime!
    value: Float!
  }

  type ComplianceReport {
    reportId: ID!
    reportType: String!
    period: JSON!
    scope: String!
    generatedAt: DateTime!
    overallScore: Float!
    executiveSummary: JSON!
    detailedFindings: [Finding!]!
    metrics: JSON!
    recommendations: [String!]!
  }

  type Finding {
    category: String!
    severity: String!
    description: String!
    evidence: [String!]!
    recommendation: String!
    status: String!
  }

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

    # Compliance queries
    getDataSubjectRequest(requestId: ID!): DataSubjectRequest
    myDataSubjectRequests: [DataSubjectRequest!]!
    kycStatus: KYCSession
    consentStatus(purpose: String!): Boolean!
    dataResidencyInfo: ResidencyInfo
    complianceDashboard(timeRange: String, includeDetails: Boolean): ComplianceDashboard!
    complianceKPIs: JSON!
    complianceReports(first: Int, after: String): [ComplianceReport!]!
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

    # Compliance mutations
    createDataSubjectRequest(requestType: RequestType!, requestData: JSON): DataSubjectRequest!
    initiateKYC(level: KYCLevel, provider: String): KYCSession!
    submitKYCDocuments(documentType: String!, documentImages: [String!]!): AMLScreeningResult!
    performAMLScreening(personalData: JSON!): AMLScreeningResult!
    recordConsent(purpose: String!, explicit: Boolean, expirationDate: DateTime): ConsentRecord!
    withdrawConsent(purpose: String!): ConsentRecord!
    requestDataMigration(targetRegion: ComplianceRegion!): JSON!
    generateComplianceReport(reportType: String!, period: JSON!, scope: String): ComplianceReport!
    exportComplianceData(format: String!, period: JSON!, options: JSON): JSON!
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
