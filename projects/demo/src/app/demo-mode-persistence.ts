/**
 * Demo playground mode persistence (session-scoped).
 * Does not store secrets, PaymentIntents, or provider tokens.
 */

export const DEMO_MODE_STORAGE_KEY = 'easy-payments-demo-mode';

export type PersistedDemoMode = 'demo' | 'real';

export function readPersistedDemoMode(storage?: Storage): PersistedDemoMode | null {
  const store =
    storage ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);
  if (!store || typeof store.getItem !== 'function') {
    return null;
  }
  try {
    const value = store.getItem(DEMO_MODE_STORAGE_KEY);
    return value === 'demo' || value === 'real' ? value : null;
  } catch {
    return null;
  }
}

export function persistDemoMode(mode: PersistedDemoMode, storage?: Storage): void {
  const store =
    storage ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);
  if (!store || typeof store.setItem !== 'function') {
    return;
  }
  try {
    store.setItem(DEMO_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore quota / private-mode failures — mode still works in-memory.
  }
}

export function clearPersistedDemoMode(storage?: Storage): void {
  const store =
    storage ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);
  if (!store || typeof store.removeItem !== 'function') {
    return;
  }
  try {
    store.removeItem(DEMO_MODE_STORAGE_KEY);
  } catch {
    // ignore
  }
}
