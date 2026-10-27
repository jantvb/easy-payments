import { Injectable } from '@nestjs/common';
import {
  ApplyWebhookEventInput,
  ApplyWebhookEventResult,
  ReferencePaymentRecord,
  ReferencePaymentStatus,
  WebhookProvider,
} from './payment-status.types';

/**
 * Development-only in-memory payment status reference.
 *
 * Limitations (not production-safe as-is):
 * - Lost on process restart
 * - Not shared across multiple server instances
 * - Deduplication is at-most-once per process lifetime, not exactly-once
 * - No durable audit log
 *
 * Replace with a persistent store (and transactional outbox) before production.
 */
@Injectable()
export class PaymentStatusStore {
  private readonly events = new Map<string, string>();
  private readonly payments = new Map<string, ReferencePaymentRecord>();

  /**
   * Synchronous apply. Relies on Node's single-threaded event loop so the
   * duplicate check + write cannot interleave with another apply() call.
   * Not safe across processes or after await boundaries without a durable lock.
   */
  apply(input: ApplyWebhookEventInput): ApplyWebhookEventResult {
    const eventKey = `${input.provider}:${input.eventId}`;
    if (this.events.has(eventKey)) {
      const existing = this.payments.get(this.paymentKey(input.provider, input.paymentId));
      return {
        duplicate: true,
        ignored: true,
        previousStatus: existing?.status,
        record: existing ? { ...existing } : undefined,
      };
    }

    const key = this.paymentKey(input.provider, input.paymentId);
    const previous = this.payments.get(key);
    const previousStatus = previous?.status;

    if (previous && !this.canTransition(previous.status, input.status)) {
      // Record the event after deciding to ignore so retries stay no-ops
      // without rewriting payment state.
      this.events.set(eventKey, input.eventType);
      return {
        duplicate: false,
        ignored: true,
        previousStatus,
        record: { ...previous },
      };
    }

    const record: ReferencePaymentRecord = {
      provider: input.provider,
      paymentId: input.paymentId,
      status: input.status,
      amount: input.amount ?? previous?.amount,
      currency: input.currency ?? previous?.currency,
      orderId: input.orderId ?? previous?.orderId,
      updatedAt: new Date().toISOString(),
      lastEventId: input.eventId,
      lastEventType: input.eventType,
    };

    // Write payment state first, then mark the event processed (at-most-once
    // in this process). Not exactly-once across restarts or instances.
    this.payments.set(key, record);
    this.events.set(eventKey, input.eventType);
    return {
      duplicate: false,
      ignored: false,
      previousStatus,
      record: { ...record },
    };
  }

  get(provider: WebhookProvider, paymentId: string): ReferencePaymentRecord | undefined {
    const record = this.payments.get(this.paymentKey(provider, paymentId));
    return record ? { ...record } : undefined;
  }

  /** Test helper — clears process-local state. */
  clear(): void {
    this.events.clear();
    this.payments.clear();
  }

  /**
   * SUCCEEDED is not downgraded by delayed processing/pending/failed/canceled.
   * REFUNDED may follow SUCCEEDED. Other terminal states stay put.
   */
  canTransition(from: ReferencePaymentStatus, to: ReferencePaymentStatus): boolean {
    if (from === to) {
      return true;
    }
    if (from === 'REFUNDED') {
      return false;
    }
    if (from === 'SUCCEEDED') {
      return to === 'REFUNDED';
    }
    if (from === 'FAILED' || from === 'CANCELED') {
      return false;
    }
    return true;
  }

  private paymentKey(provider: WebhookProvider, paymentId: string): string {
    return `${provider}:${paymentId}`;
  }
}
