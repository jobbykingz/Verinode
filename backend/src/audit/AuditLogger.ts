import { createHash, createSign } from 'crypto';
import AuditLog, { IAuditLog, EventType } from '../models/AuditLog.ts';
import { v4 as uuidv4 } from 'uuid';

export class AuditLogger {
  private static instance: AuditLogger;
  private privateKey: string; // Loaded from env in production

  private constructor() {
    this.privateKey = process.env.AUDIT_SIGNING_KEY || 'mock-key';
  }

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  public async logEvent(params: {
    eventType: EventType;
    actor: { id: string; type: 'USER' | 'SYSTEM' | 'SERVICE' ; name?: string; ipAddress?: string; userAgent?: string };
    resource?: { id?: string; type?: string; name?: string };
    action: string;
    eventData?: any;
    status?: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
    compliance?: { gdprRelevant?: boolean; classification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED' };
  }): Promise<string> {
    const eventId = uuidv4();
    const timestamp = new Date();
    
    // Default retention: 7 years
    const retentionUntil = new Date();
    retentionUntil.setFullYear(retentionUntil.getFullYear() + 7);

    const logData: Partial<IAuditLog> = {
      eventId,
      eventType: params.eventType,
      actor: params.actor,
      resource: params.resource,
      action: params.action,
      eventData: params.eventData,
      status: params.status || 'SUCCESS',
      compliance: {
        gdprRelevant: params.compliance?.gdprRelevant || false,
        hipaaRelevant: false,
        soxRelevant: false,
        pciRelevant: false,
        classification: params.compliance?.classification || 'INTERNAL',
        retentionUntil
      },
      timestamp,
      isImmutable: true
    };

    // Calculate Digital Signature for integrity
    const payload = JSON.stringify({ eventId, eventType: params.eventType, timestamp, actor: params.actor.id });
    const signature = this.signData(payload);
    
    logData.digitalSignature = {
      signature,
      publicKey: 'system-public-key',
      signedAt: timestamp
    };

    const log = await AuditLog.create(logData);
    return log.eventId;
  }

  private signData(data: string): string {
    // Mock signature logic
    return createHash('sha256').update(data + this.privateKey).digest('hex');
  }

  public async verifyLogIntegrity(eventId: string): Promise<boolean> {
    const log = await AuditLog.findOne({ eventId });
    if (!log || !log.digitalSignature) return false;

    const payload = JSON.stringify({ 
      eventId: log.eventId, 
      eventType: log.eventType, 
      timestamp: log.timestamp, 
      actor: log.actor.id 
    });
    const calculatedSignature = this.signData(payload);
    return calculatedSignature === log.digitalSignature.signature;
  }
}
