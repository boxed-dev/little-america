// UCP Order Service
// Manages order retrieval and status

import { baseURL } from "@/baseUrl";
import { sessionStore } from "./session-store";
import type { UCPOrder, UCPOrderResponse } from "./types";

const UCP_VERSION = "2026-01-11";

export class UCPOrderError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "UCPOrderError";
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export class OrderService {
  async get(id: string): Promise<UCPOrderResponse> {
    const order = sessionStore.getOrder(id);
    if (!order) {
      throw new UCPOrderError("NOT_FOUND", `Order ${id} not found`);
    }
    return this.formatOrderResponse(order);
  }

  async getByCheckoutSession(checkoutSessionId: string): Promise<UCPOrderResponse | null> {
    const order = sessionStore.getOrderByCheckoutSession(checkoutSessionId);
    if (!order) return null;
    return this.formatOrderResponse(order);
  }

  private formatOrderResponse(order: UCPOrder): UCPOrderResponse {
    return {
      ucp: { version: UCP_VERSION },
      id: order.id,
      checkout_session_id: order.checkoutSessionId,
      status: order.status,
      permalink_url: order.permalinkUrl,
      line_items: order.lineItems.map((item) => ({
        id: item.id,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        quantity_fulfilled: item.quantityFulfilled,
        unit_price: { amount: item.unitPrice, currency: order.currency },
        status: item.status,
      })),
      fulfillment: {
        expectations: order.fulfillment.expectations,
        events: order.fulfillment.events.map((e) => ({
          id: e.id,
          type: e.type,
          timestamp: e.timestamp.toISOString(),
          line_item_ids: e.lineItemIds,
        })),
      },
      totals: {
        subtotal: { amount: order.totals.subtotal, currency: order.currency },
        tax: { amount: order.totals.tax, currency: order.currency },
        fees: { amount: order.totals.fees, currency: order.currency },
        discount: { amount: order.totals.discount, currency: order.currency },
        total: { amount: order.totals.total, currency: order.currency },
      },
      currency: order.currency,
      buyer: order.buyer,
      created_at: order.createdAt.toISOString(),
      updated_at: order.updatedAt.toISOString(),
    };
  }
}

// Singleton instance
export const orderService = new OrderService();
