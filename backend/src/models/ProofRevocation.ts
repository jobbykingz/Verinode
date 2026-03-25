import { v4 as uuidv4 } from 'uuid';

export enum RevocationReason {
  COMPROMISED = 'COMPROMISED',
  EXPIRED = 'EXPIRED',
  FRAUDULENT = 'FRAUDULENT',
  INVALIDATED = 'INVALIDATED',
  SUPERSEDED = 'SUPERSEDED',
  WITHDRAWN = 'WITHDRAWN'
}

export enum RevocationStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  RESTORED = 'RESTORED'
}

export interface RevocationEvidence {
  type: string;
  description: string;
  data: string;
  timestamp: Date;
  source: string;
}

export interface ProofRevocationData {
  id?: string;
  proofId: string;
  reason: RevocationReason;
  description: string;
  revokedBy: string;
  revokedAt: Date;
  status?: RevocationStatus;
  evidence?: RevocationEvidence[];
  bulkId?: string;
  restoredAt?: Date;
  restoredBy?: string;
  restoreReason?: string;
}

export class ProofRevocation {
  public id: string;
  public proofId: string;
  public reason: RevocationReason;
  public description: string;
  public revokedBy: string;
  public revokedAt: Date;
  public status: RevocationStatus;
  public evidence: RevocationEvidence[];
  public bulkId?: string;
  public restoredAt?: Date;
  public restoredBy?: string;
  public restoreReason?: string;

  constructor(data: ProofRevocationData) {
    this.id = data.id || uuidv4();
    this.proofId = data.proofId;
    this.reason = data.reason;
    this.description = data.description;
    this.revokedBy = data.revokedBy;
    this.revokedAt = data.revokedAt;
    this.status = data.status || RevocationStatus.ACTIVE;
    this.evidence = data.evidence || [];
    this.bulkId = data.bulkId;
    this.restoredAt = data.restoredAt;
    this.restoredBy = data.restoredBy;
    this.restoreReason = data.restoreReason;
  }

  /**
   * Check if the revocation is currently active
   */
  public isActive(): boolean {
    return this.status === RevocationStatus.ACTIVE;
  }

  /**
   * Check if the revocation has been restored
   */
  public isRestored(): boolean {
    return this.status === RevocationStatus.RESTORED;
  }

  /**
   * Check if the revocation has expired
   */
  public isExpired(): boolean {
    return this.status === RevocationStatus.EXPIRED;
  }

  /**
   * Restore the revocation
   */
  public restore(restoredBy: string, restoreReason: string): void {
    this.status = RevocationStatus.RESTORED;
    this.restoredAt = new Date();
    this.restoredBy = restoredBy;
    this.restoreReason = restoreReason;
  }

  /**
   * Mark revocation as expired
   */
  public expire(): void {
    this.status = RevocationStatus.EXPIRED;
  }

  /**
   * Add evidence to the revocation
   */
  public addEvidence(evidence: RevocationEvidence): void {
    this.evidence.push(evidence);
  }

  /**
   * Get evidence by type
   */
  public getEvidenceByType(type: string): RevocationEvidence[] {
    return this.evidence.filter(e => e.type === type);
  }

  /**
   * Get the age of the revocation in days
   */
  public getAgeInDays(): number {
    const now = new Date();
    const diffMs = now.getTime() - this.revokedAt.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Check if the revocation is part of a bulk operation
   */
  public isBulkRevocation(): boolean {
    return !!this.bulkId;
  }

  /**
   * Convert to JSON object
   */
  public toJSON(): any {
    return {
      id: this.id,
      proofId: this.proofId,
      reason: this.reason,
      description: this.description,
      revokedBy: this.revokedBy,
      revokedAt: this.revokedAt.toISOString(),
      status: this.status,
      evidence: this.evidence,
      bulkId: this.bulkId,
      restoredAt: this.restoredAt?.toISOString(),
      restoredBy: this.restoredBy,
      restoreReason: this.restoreReason
    };
  }

  /**
   * Create from JSON object
   */
  public static fromJSON(json: any): ProofRevocation {
    return new ProofRevocation({
      id: json.id,
      proofId: json.proofId,
      reason: json.reason as RevocationReason,
      description: json.description,
      revokedBy: json.revokedBy,
      revokedAt: new Date(json.revokedAt),
      status: json.status as RevocationStatus,
      evidence: json.evidence || [],
      bulkId: json.bulkId,
      restoredAt: json.restoredAt ? new Date(json.restoredAt) : undefined,
      restoredBy: json.restoredBy,
      restoreReason: json.restoreReason
    });
  }

  /**
   * Validate revocation data
   */
  public static validate(data: ProofRevocationData): string[] {
    const errors: string[] = [];

    if (!data.proofId || data.proofId.trim() === '') {
      errors.push('Proof ID is required');
    }

    if (!Object.values(RevocationReason).includes(data.reason)) {
      errors.push('Invalid revocation reason');
    }

    if (!data.description || data.description.trim() === '') {
      errors.push('Description is required');
    }

    if (!data.revokedBy || data.revokedBy.trim() === '') {
      errors.push('Revoked by is required');
    }

    if (!data.revokedAt || !(data.revokedAt instanceof Date)) {
      errors.push('Revoked at must be a valid date');
    }

    if (data.status && !Object.values(RevocationStatus).includes(data.status)) {
      errors.push('Invalid revocation status');
    }

    return errors;
  }

  /**
   * Get revocation reason description
   */
  public getReasonDescription(): string {
    switch (this.reason) {
      case RevocationReason.COMPROMISED:
        return 'The proof has been compromised and is no longer trustworthy';
      case RevocationReason.EXPIRED:
        return 'The proof has expired and is no longer valid';
      case RevocationReason.FRAUDULENT:
        return 'The proof has been identified as fraudulent';
      case RevocationReason.INVALIDATED:
        return 'The proof has been invalidated due to policy violation';
      case RevocationReason.SUPERSEDED:
        return 'The proof has been superseded by a newer version';
      case RevocationReason.WITHDRAWN:
        return 'The proof has been withdrawn by the issuer';
      default:
        return 'Unknown revocation reason';
    }
  }

  /**
   * Check if the revocation can be restored
   */
  public canBeRestored(): boolean {
    return this.status === RevocationStatus.ACTIVE && 
           this.reason !== RevocationReason.FRAUDULENT &&
           this.reason !== RevocationReason.COMPROMISED;
  }

  /**
   * Get revocation severity level
   */
  public getSeverity(): 'low' | 'medium' | 'high' | 'critical' {
    switch (this.reason) {
      case RevocationReason.WITHDRAWN:
        return 'low';
      case RevocationReason.EXPIRED:
      case RevocationReason.SUPERSEDED:
        return 'medium';
      case RevocationReason.INVALIDATED:
        return 'high';
      case RevocationReason.COMPROMISED:
      case RevocationReason.FRAUDULENT:
        return 'critical';
      default:
        return 'medium';
    }
  }

  /**
   * Get summary string
   */
  public getSummary(): string {
    const age = this.getAgeInDays();
    const ageText = age === 0 ? 'today' : age === 1 ? 'yesterday' : `${age} days ago`;
    
    return `Proof ${this.proofId} revoked ${ageText} due to ${this.reason.toLowerCase()}`;
  }
}
