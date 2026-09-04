import { Injectable } from '@angular/core';
import { loadStripe, type Stripe } from '@stripe/stripe-js';

/**
 * Thin wrapper around official loadStripe so unit tests can stub SDK loading
 * without hitting the network.
 */
@Injectable({ providedIn: 'root' })
export class StripeSdkLoader {
  load(publishableKey: string): Promise<Stripe | null> {
    return loadStripe(publishableKey);
  }
}
