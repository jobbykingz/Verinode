import { Document, Schema, model } from 'mongoose';

export enum TransactionStatus {
  Pending = 'Pending',
  Confirmed = 'Confirmed',
  Completed = 'Completed',
  Failed = 'Failed',
  Refunded = 'Refunded',
}

export enum MultiTokenStatus {
  Pending = 'Pending',
  Processing = 'Processing',
  Completed = 'Completed',
  Failed = 'Failed',
  Refunded = 'Refunded',
  PartiallyCompleted = 'PartiallyCompleted',
}

export interface TokenTransfer {
  tokenAddress: string;
  amount: string;
  fee: string;
  isNative: boolean;
}

export interface IBridgeTransaction extends Document {
  transactionId: string;
  sourceChain: number;
  targetChain: number;
  tokenAddress: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  fee: string;
  nonce: string;
  status: TransactionStatus;
  timestamp: Date;
  gasUsed: number;
  relayerFee: string;
  metadata: string;
  createdAt: Date;
  updatedAt: Date;
  transactionHash?: string;
  confirmations?: number;
  blockNumber?: number;
  gasPrice?: string;
  errorMessage?: string;
  retryCount?: number;
  maxRetries?: number;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  notes?: string;
}

export interface IMultiTokenTransaction extends Document {
  transactionId: string;
  sourceChain: number;
  targetChain: number;
  tokens: TokenTransfer[];
  fromAddress: string;
  toAddress: string;
  totalFee: string;
  nonce: string;
  status: MultiTokenStatus;
  timestamp: Date;
  gasUsed: number;
  metadata: string;
  signature: string;
  createdAt: Date;
  updatedAt: Date;
  transactionHash?: string;
  confirmations?: number;
  blockNumber?: number;
  gasPrice?: string;
  errorMessage?: string;
  retryCount?: number;
  maxRetries?: number;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  notes?: string;
}

export interface IChainConfiguration extends Document {
  chainId: number;
  chainName: string;
  nativeToken: string;
  bridgeContract: string;
  confirmations: number;
  gasLimit: number;
  active: boolean;
  minimumFee: string;
  maximumFee: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRelayerInfo extends Document {
  address: string;
  stake: string;
  reputation: number;
  active: boolean;
  totalTransactions: number;
  successRate: number;
  createdAt: Date;
  updatedAt: Date;
  lastActive?: Date;
  totalEarnings?: string;
  averageResponseTime?: number;
  disputes?: number;
  resolvedDisputes?: number;
}

export interface IFeeTier extends Document {
  tierName: string;
  minAmount: string;
  maxAmount: string;
  feePercentage: number;
  fixedFee: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILiquidityPool extends Document {
  poolId: string;
  tokenA: string;
  tokenB: string;
  reserveA: string;
  reserveB: string;
  totalLiquidity: string;
  feeRate: number;
  active: boolean;
  createdAt: Date;
  lastUpdated: Date;
  apr: number;
  volume24h?: string;
  fees24h?: string;
  liquidityProviders?: number;
}

export interface ILiquidityPosition extends Document {
  positionId: string;
  user: string;
  poolId: string;
  liquidityAmount: string;
  tokenAAmount: string;
  tokenBAmount: string;
  rewardsEarned: string;
  createdAt: Date;
  lastClaimed: Date;
  active: boolean;
}

export interface ILiquidityReward extends Document {
  rewardId: string;
  poolId: string;
  user: string;
  amount: string;
  rewardType: 'TradingFee' | 'LiquidityMining' | 'Bonus';
  createdAt: Date;
  claimed: boolean;
  claimedAt?: Date;
}

export interface ISecurityEvent extends Document {
  eventId: string;
  transactionId: string;
  userAddress: string;
  ruleType: string;
  action: string;
  details: string;
  timestamp: Date;
  resolved: boolean;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
}

export interface IBridgeAnalytics extends Document {
  dataId: string;
  timestamp: Date;
  metricType: string;
  value: string;
  chainId: number;
  tokenAddress?: string;
  userAddress?: string;
  metadata: string;
}

export interface IBridgeRoute extends Document {
  routeId: string;
  sourceChain: number;
  targetChain: number;
  tokens: string[];
  fees: string[];
  active: boolean;
  priority: number;
  maxAmount: string;
  minAmount: string;
  createdAt: Date;
  updatedAt: Date;
  usageCount?: number;
  successRate?: number;
}

// Schemas
const TokenTransferSchema = new Schema({
  tokenAddress: { type: String, required: true },
  amount: { type: String, required: true },
  fee: { type: String, required: true },
  isNative: { type: Boolean, default: false }
}, { _id: false });

const BridgeTransactionSchema = new Schema({
  transactionId: { type: String, required: true, unique: true, index: true },
  sourceChain: { type: Number, required: true, index: true },
  targetChain: { type: Number, required: true, index: true },
  tokenAddress: { type: String, required: true, index: true },
  fromAddress: { type: String, required: true, index: true },
  toAddress: { type: String, required: true, index: true },
  amount: { type: String, required: true },
  fee: { type: String, required: true },
  nonce: { type: String, required: true },
  status: { 
    type: String, 
    enum: Object.values(TransactionStatus), 
    default: TransactionStatus.Pending,
    index: true 
  },
  timestamp: { type: Date, required: true, index: true },
  gasUsed: { type: Number, default: 0 },
  relayerFee: { type: String, default: '0' },
  metadata: { type: String, default: '' },
  transactionHash: { type: String, index: true },
  confirmations: { type: Number, default: 0 },
  blockNumber: { type: Number },
  gasPrice: { type: String },
  errorMessage: { type: String },
  retryCount: { type: Number, default: 0 },
  maxRetries: { type: Number, default: 3 },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high'], 
    default: 'medium',
    index: true 
  },
  tags: [{ type: String }],
  notes: { type: String }
}, {
  timestamps: true,
  collection: 'bridge_transactions'
});

const MultiTokenTransactionSchema = new Schema({
  transactionId: { type: String, required: true, unique: true, index: true },
  sourceChain: { type: Number, required: true, index: true },
  targetChain: { type: Number, required: true, index: true },
  tokens: [TokenTransferSchema],
  fromAddress: { type: String, required: true, index: true },
  toAddress: { type: String, required: true, index: true },
  totalFee: { type: String, required: true },
  nonce: { type: String, required: true },
  status: { 
    type: String, 
    enum: Object.values(MultiTokenStatus), 
    default: MultiTokenStatus.Pending,
    index: true 
  },
  timestamp: { type: Date, required: true, index: true },
  gasUsed: { type: Number, default: 0 },
  metadata: { type: String, default: '' },
  signature: { type: String, required: true },
  transactionHash: { type: String, index: true },
  confirmations: { type: Number, default: 0 },
  blockNumber: { type: Number },
  gasPrice: { type: String },
  errorMessage: { type: String },
  retryCount: { type: Number, default: 0 },
  maxRetries: { type: Number, default: 3 },
  priority: { 
    type: String, 
    enum: ['low', 'medium', 'high'], 
    default: 'medium',
    index: true 
  },
  tags: [{ type: String }],
  notes: { type: String }
}, {
  timestamps: true,
  collection: 'multi_token_transactions'
});

const ChainConfigurationSchema = new Schema({
  chainId: { type: Number, required: true, unique: true, index: true },
  chainName: { type: String, required: true },
  nativeToken: { type: String, required: true },
  bridgeContract: { type: String, required: true },
  confirmations: { type: Number, required: true, default: 12 },
  gasLimit: { type: Number, required: true, default: 200000 },
  active: { type: Boolean, required: true, default: true },
  minimumFee: { type: String, required: true },
  maximumFee: { type: String, required: true }
}, {
  timestamps: true,
  collection: 'chain_configurations'
});

const RelayerInfoSchema = new Schema({
  address: { type: String, required: true, unique: true, index: true },
  stake: { type: String, required: true },
  reputation: { type: Number, required: true, default: 100 },
  active: { type: Boolean, required: true, default: true },
  totalTransactions: { type: Number, required: true, default: 0 },
  successRate: { type: Number, required: true, default: 100 },
  lastActive: { type: Date },
  totalEarnings: { type: String, default: '0' },
  averageResponseTime: { type: Number, default: 0 },
  disputes: { type: Number, default: 0 },
  resolvedDisputes: { type: Number, default: 0 }
}, {
  timestamps: true,
  collection: 'relayer_infos'
});

const FeeTierSchema = new Schema({
  tierName: { type: String, required: true, unique: true },
  minAmount: { type: String, required: true },
  maxAmount: { type: String, required: true },
  feePercentage: { type: Number, required: true },
  fixedFee: { type: String, required: true },
  active: { type: Boolean, required: true, default: true }
}, {
  timestamps: true,
  collection: 'fee_tiers'
});

const LiquidityPoolSchema = new Schema({
  poolId: { type: String, required: true, unique: true, index: true },
  tokenA: { type: String, required: true, index: true },
  tokenB: { type: String, required: true, index: true },
  reserveA: { type: String, required: true },
  reserveB: { type: String, required: true },
  totalLiquidity: { type: String, required: true },
  feeRate: { type: Number, required: true },
  active: { type: Boolean, required: true, default: true },
  apr: { type: Number, required: true, default: 0 },
  volume24h: { type: String, default: '0' },
  fees24h: { type: String, default: '0' },
  liquidityProviders: { type: Number, default: 0 }
}, {
  timestamps: true,
  collection: 'liquidity_pools'
});

const LiquidityPositionSchema = new Schema({
  positionId: { type: String, required: true, unique: true, index: true },
  user: { type: String, required: true, index: true },
  poolId: { type: String, required: true, index: true },
  liquidityAmount: { type: String, required: true },
  tokenAAmount: { type: String, required: true },
  tokenBAmount: { type: String, required: true },
  rewardsEarned: { type: String, default: '0' },
  lastClaimed: { type: Date, required: true },
  active: { type: Boolean, required: true, default: true }
}, {
  timestamps: true,
  collection: 'liquidity_positions'
});

const LiquidityRewardSchema = new Schema({
  rewardId: { type: String, required: true, unique: true, index: true },
  poolId: { type: String, required: true, index: true },
  user: { type: String, required: true, index: true },
  amount: { type: String, required: true },
  rewardType: { 
    type: String, 
    enum: ['TradingFee', 'LiquidityMining', 'Bonus'], 
    required: true 
  },
  claimed: { type: Boolean, required: true, default: false },
  claimedAt: { type: Date }
}, {
  timestamps: true,
  collection: 'liquidity_rewards'
});

const SecurityEventSchema = new Schema({
  eventId: { type: String, required: true, unique: true, index: true },
  transactionId: { type: String, required: true, index: true },
  userAddress: { type: String, required: true, index: true },
  ruleType: { type: String, required: true },
  action: { type: String, required: true },
  details: { type: String, required: true },
  timestamp: { type: Date, required: true, index: true },
  resolved: { type: Boolean, required: true, default: false },
  severity: { 
    type: String, 
    enum: ['Low', 'Medium', 'High', 'Critical'], 
    required: true 
  },
  resolvedAt: { type: Date },
  resolvedBy: { type: String },
  resolutionNotes: { type: String }
}, {
  timestamps: true,
  collection: 'security_events'
});

const BridgeAnalyticsSchema = new Schema({
  dataId: { type: String, required: true, unique: true, index: true },
  timestamp: { type: Date, required: true, index: true },
  metricType: { type: String, required: true, index: true },
  value: { type: String, required: true },
  chainId: { type: Number, required: true, index: true },
  tokenAddress: { type: String, index: true },
  userAddress: { type: String, index: true },
  metadata: { type: String, default: '' }
}, {
  timestamps: true,
  collection: 'bridge_analytics'
});

const BridgeRouteSchema = new Schema({
  routeId: { type: String, required: true, unique: true, index: true },
  sourceChain: { type: Number, required: true, index: true },
  targetChain: { type: Number, required: true, index: true },
  tokens: [{ type: String, required: true }],
  fees: [{ type: String, required: true }],
  active: { type: Boolean, required: true, default: true },
  priority: { type: Number, required: true, default: 0 },
  maxAmount: { type: String, required: true },
  minAmount: { type: String, required: true },
  usageCount: { type: Number, default: 0 },
  successRate: { type: Number, default: 100 }
}, {
  timestamps: true,
  collection: 'bridge_routes'
});

// Indexes for better query performance
BridgeTransactionSchema.index({ fromAddress: 1, timestamp: -1 });
BridgeTransactionSchema.index({ toAddress: 1, timestamp: -1 });
BridgeTransactionSchema.index({ status: 1, timestamp: -1 });
BridgeTransactionSchema.index({ sourceChain: 1, targetChain: 1, timestamp: -1 });

MultiTokenTransactionSchema.index({ fromAddress: 1, timestamp: -1 });
MultiTokenTransactionSchema.index({ toAddress: 1, timestamp: -1 });
MultiTokenTransactionSchema.index({ status: 1, timestamp: -1 });
MultiTokenTransactionSchema.index({ sourceChain: 1, targetChain: 1, timestamp: -1 });

LiquidityPoolSchema.index({ tokenA: 1, tokenB: 1 });
LiquidityPoolSchema.index({ active: 1, apr: -1 });

LiquidityPositionSchema.index({ user: 1, poolId: 1 });
LiquidityPositionSchema.index({ poolId: 1, active: 1 });

SecurityEventSchema.index({ userAddress: 1, timestamp: -1 });
SecurityEventSchema.index({ severity: 1, resolved: 1, timestamp: -1 });

BridgeAnalyticsSchema.index({ metricType: 1, timestamp: -1 });
BridgeAnalyticsSchema.index({ chainId: 1, metricType: 1, timestamp: -1 });

BridgeRouteSchema.index({ sourceChain: 1, targetChain: 1, active: 1 });
BridgeRouteSchema.index({ priority: -1, active: 1 });

// Models
export const BridgeTransaction = model<IBridgeTransaction>('BridgeTransaction', BridgeTransactionSchema);
export const MultiTokenTransaction = model<IMultiTokenTransaction>('MultiTokenTransaction', MultiTokenTransactionSchema);
export const ChainConfiguration = model<IChainConfiguration>('ChainConfiguration', ChainConfigurationSchema);
export const RelayerInfo = model<IRelayerInfo>('RelayerInfo', RelayerInfoSchema);
export const FeeTier = model<IFeeTier>('FeeTier', FeeTierSchema);
export const LiquidityPool = model<ILiquidityPool>('LiquidityPool', LiquidityPoolSchema);
export const LiquidityPosition = model<ILiquidityPosition>('LiquidityPosition', LiquidityPositionSchema);
export const LiquidityReward = model<ILiquidityReward>('LiquidityReward', LiquidityRewardSchema);
export const SecurityEvent = model<ISecurityEvent>('SecurityEvent', SecurityEventSchema);
export const BridgeAnalytics = model<IBridgeAnalytics>('BridgeAnalytics', BridgeAnalyticsSchema);
export const BridgeRoute = model<IBridgeRoute>('BridgeRoute', BridgeRouteSchema);
