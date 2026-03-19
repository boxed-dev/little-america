// In-memory session store for UCP checkout sessions and orders
// For production, replace with Redis or database storage

import type { UCPCheckoutSession, UCPOrder } from "./types";

const SESSION_TTL = 30 * 60 * 1000; // 30 minutes
const ORDER_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface StoreEntry<T> {
  data: T;
  expiresAt: number;
}

class SessionStore {
  private checkoutSessions = new Map<string, StoreEntry<UCPCheckoutSession>>();
  private orders = new Map<string, StoreEntry<UCPOrder>>();
  private idempotencyKeys = new Map<string, StoreEntry<{ result: unknown }>>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Run cleanup every 5 minutes
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  // Checkout Sessions
  setCheckoutSession(session: UCPCheckoutSession): void {
    this.checkoutSessions.set(session.id, {
      data: session,
      expiresAt: Date.now() + SESSION_TTL,
    });
  }

  getCheckoutSession(id: string): UCPCheckoutSession | null {
    const entry = this.checkoutSessions.get(id);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.checkoutSessions.delete(id);
      return null;
    }
    return entry.data;
  }

  updateCheckoutSession(
    id: string,
    updates: Partial<UCPCheckoutSession>
  ): UCPCheckoutSession | null {
    const session = this.getCheckoutSession(id);
    if (!session) return null;

    const updated: UCPCheckoutSession = {
      ...session,
      ...updates,
      updatedAt: new Date(),
    };

    this.setCheckoutSession(updated);
    return updated;
  }

  deleteCheckoutSession(id: string): boolean {
    return this.checkoutSessions.delete(id);
  }

  // Orders
  setOrder(order: UCPOrder): void {
    this.orders.set(order.id, {
      data: order,
      expiresAt: Date.now() + ORDER_TTL,
    });
  }

  getOrder(id: string): UCPOrder | null {
    const entry = this.orders.get(id);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.orders.delete(id);
      return null;
    }
    return entry.data;
  }

  getOrderByCheckoutSession(checkoutSessionId: string): UCPOrder | null {
    for (const entry of this.orders.values()) {
      if (
        entry.data.checkoutSessionId === checkoutSessionId &&
        Date.now() <= entry.expiresAt
      ) {
        return entry.data;
      }
    }
    return null;
  }

  updateOrder(id: string, updates: Partial<UCPOrder>): UCPOrder | null {
    const order = this.getOrder(id);
    if (!order) return null;

    const updated: UCPOrder = {
      ...order,
      ...updates,
      updatedAt: new Date(),
    };

    this.setOrder(updated);
    return updated;
  }

  // Idempotency Keys
  setIdempotencyKey(
    key: string,
    checkoutId: string,
    result: unknown
  ): void {
    this.idempotencyKeys.set(`${checkoutId}:${key}`, {
      data: { result },
      expiresAt: Date.now() + ORDER_TTL,
    });
  }

  getIdempotencyKey(key: string, checkoutId: string): unknown | null {
    const entry = this.idempotencyKeys.get(`${checkoutId}:${key}`);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.idempotencyKeys.delete(`${checkoutId}:${key}`);
      return null;
    }
    return entry.data.result;
  }

  // Cleanup expired entries
  private cleanup(): void {
    const now = Date.now();

    for (const [key, entry] of this.checkoutSessions) {
      if (now > entry.expiresAt) {
        this.checkoutSessions.delete(key);
      }
    }

    for (const [key, entry] of this.orders) {
      if (now > entry.expiresAt) {
        this.orders.delete(key);
      }
    }

    for (const [key, entry] of this.idempotencyKeys) {
      if (now > entry.expiresAt) {
        this.idempotencyKeys.delete(key);
      }
    }
  }

  // Get stats (for debugging)
  getStats(): {
    checkoutSessions: number;
    orders: number;
    idempotencyKeys: number;
  } {
    return {
      checkoutSessions: this.checkoutSessions.size,
      orders: this.orders.size,
      idempotencyKeys: this.idempotencyKeys.size,
    };
  }

  // Cleanup on shutdown
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Singleton instance
export const sessionStore = new SessionStore();

// Utility to generate IDs
export function generateId(): string {
  return crypto.randomUUID();
}
