export enum ProofStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected'
}

export interface User {
  id: string;
  email: string;
  username: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Proof {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: ProofStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

// ─── Issue #31: Proof expiration and renewal system ───────────────────────────

export interface ProofExpiration {
  proofId: string;
  expiresAt: Date;
  gracePeriodEndsAt: Date;
  isExpired: boolean;
  isInGracePeriod: boolean;
  lastRenewedAt: Date | null;
  renewalCount: number;
}

export interface RenewalRecord {
  id: string;
  proofId: string;
  renewedAt: Date;
  renewedBy: string;
  previousExpiry: Date;
  newExpiry: Date;
  duration: number; // days added
}

export interface ExpirationNotification {
  id: string;
  proofId: string;
  userId: string;
  type: 'reminder' | 'expired' | 'grace_period' | 'renewed';
  message: string;
  sentAt: Date;
  read: boolean;
}

export interface ExpirationAnalytics {
  totalProofs: number;
  activeProofs: number;
  expiringSoon: number;
  inGracePeriod: number;
  expired: number;
  renewedThisMonth: number;
  averageRenewalTime: number;
}

export interface RenewalOptions {
  durationDays: number;
  notifyUser: boolean;
}

export interface BulkRenewalResult {
  successful: string[];
  failed: { proofId: string; error: string }[];
  totalProcessed: number;
}

export interface AuthPayload {
  token: string;
  user: User;
}

export interface GraphQLContext {
  user?: User;
  req: any;
  res: any;
}
