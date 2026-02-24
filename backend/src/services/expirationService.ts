import { expirationNotificationService } from './notificationService';

export type ExpirationStatus = 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'RENEWED';

export interface ExpirationRecord {
  proofId: number;
  expiresAt: number;
  gracePeriodMs: number;
  remindersMs: number[];
  status: ExpirationStatus;
  lastReminderIndex: number;
  renewedAt?: number;
}

class ExpirationService {
  private records: Map<number, ExpirationRecord> = new Map();
  private schedulerStarted = false;
  private intervalId: NodeJS.Timeout | null = null;

  configureExpiration(proofId: number, opts: { expiresAt: number; gracePeriodMs?: number; remindersMs?: number[] }) {
    const record: ExpirationRecord = {
      proofId,
      expiresAt: opts.expiresAt,
      gracePeriodMs: opts.gracePeriodMs ?? 0,
      remindersMs: (opts.remindersMs ?? []).sort((a, b) => a - b),
      status: 'ACTIVE',
      lastReminderIndex: -1,
    };
    this.records.set(proofId, record);
    return record;
  }

  getStatus(proofId: number) {
    const rec = this.records.get(proofId);
    if (!rec) return null;
    const now = Date.now();
    const inGrace = now >= rec.expiresAt && now < rec.expiresAt + rec.gracePeriodMs;
    let status: ExpirationStatus = rec.status;
    if (rec.status !== 'RENEWED') {
      if (now < rec.expiresAt) status = 'ACTIVE';
      else if (inGrace) status = 'GRACE';
      else status = 'EXPIRED';
      rec.status = status;
    }
    const timeLeft = Math.max(0, rec.expiresAt - now);
    const graceLeft = inGrace ? rec.expiresAt + rec.gracePeriodMs - now : 0;
    return { proofId, status, expiresAt: rec.expiresAt, timeLeft, graceLeft, gracePeriodMs: rec.gracePeriodMs };
  }

  renew(proofId: number, durationMs: number) {
    const rec = this.records.get(proofId);
    if (!rec) throw new Error('NotFound');
    const previousExpiresAt = rec.expiresAt;
    rec.expiresAt = Date.now() + durationMs;
    rec.status = 'RENEWED';
    rec.renewedAt = Date.now();
    rec.lastReminderIndex = -1;
    return { previousExpiresAt, newExpiresAt: rec.expiresAt };
  }

  bulkRenew(proofIds: number[], durationMs: number) {
    const results: Array<{ proofId: number; ok: boolean; error?: string; previousExpiresAt?: number; newExpiresAt?: number }> = [];
    for (const id of proofIds) {
      try {
        const r = this.renew(id, durationMs);
        results.push({ proofId: id, ok: true, previousExpiresAt: r.previousExpiresAt, newExpiresAt: r.newExpiresAt });
      } catch (e: any) {
        results.push({ proofId: id, ok: false, error: e?.message || 'Error' });
      }
    }
    return results;
  }

  getAnalytics() {
    const now = Date.now();
    let active = 0;
    let grace = 0;
    let expired = 0;
    let renewed = 0;
    let expiring7d = 0;
    for (const rec of this.records.values()) {
      const status = this.getStatus(rec.proofId)!.status;
      if (status === 'ACTIVE') active++;
      if (status === 'GRACE') grace++;
      if (status === 'EXPIRED') expired++;
      if (rec.status === 'RENEWED') renewed++;
      if (rec.expiresAt - now <= 7 * 24 * 60 * 60 * 1000 && rec.expiresAt > now) expiring7d++;
    }
    return { active, grace, expired, renewed, expiring7d, total: this.records.size };
  }

  startScheduler() {
    if (this.schedulerStarted) return;
    this.schedulerStarted = true;
    this.intervalId = setInterval(() => this.tick(), 60 * 1000);
  }

  stopScheduler() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.schedulerStarted = false;
  }

  private async tick() {
    const now = Date.now();
    for (const rec of this.records.values()) {
      const statusInfo = this.getStatus(rec.proofId);
      if (!statusInfo) continue;
      if (statusInfo.status === 'EXPIRED') {
        await expirationNotificationService.sendExpirationNotice({}, `Proof ${rec.proofId} expired`);
        continue;
      }
      if (statusInfo.status === 'GRACE') {
        await expirationNotificationService.sendReminder({}, `Proof ${rec.proofId} is in grace`);
      }
      const timeToExpiry = rec.expiresAt - now;
      for (let i = rec.lastReminderIndex + 1; i < rec.remindersMs.length; i++) {
        const threshold = rec.remindersMs[i];
        if (timeToExpiry <= threshold && timeToExpiry > 0) {
          await expirationNotificationService.sendReminder({}, `Proof ${rec.proofId} expires in ${Math.ceil(threshold / 60000)}m`);
          rec.lastReminderIndex = i;
        }
      }
    }
  }
}

export const expirationService = new ExpirationService();
