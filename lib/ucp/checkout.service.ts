// UCP Checkout Service
// Implements checkout capability: create, get, update, complete, cancel

import { baseURL } from "@/baseUrl";
import { hotelzifyApi } from "./hotelzify-api";
import { sessionStore, generateId } from "./session-store";
import type {
  UCPCheckoutSession,
  UCPCheckoutResponse,
  UCPOrder,
  UCPOrderResponse,
  UCPLineItem,
  UCPTotals,
  CreateCheckoutRequest,
  UpdateCheckoutRequest,
  CompleteCheckoutRequest,
  UCPError,
  HotelzifyRoom,
} from "./types";

const UCP_VERSION = "2026-01-11";
const DEFAULT_CURRENCY = "INR";

export class UCPCheckoutError extends Error {
  constructor(
    public code: UCPError["code"],
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "UCPCheckoutError";
  }

  toJSON(): UCPError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export class CheckoutService {
  async create(
    request: CreateCheckoutRequest,
    chainId: string
  ): Promise<UCPCheckoutResponse> {
    const { line_items, buyer, currency = DEFAULT_CURRENCY, discount_codes } = request;

    if (!line_items || line_items.length === 0) {
      throw new UCPCheckoutError("VALIDATION_ERROR", "At least one line item is required");
    }

    if (!buyer?.email) {
      throw new UCPCheckoutError("VALIDATION_ERROR", "Buyer email is required");
    }

    // Validate and process each line item
    const processedItems: UCPLineItem[] = [];
    let hotelId = "";
    let hotelName = "";

    for (const item of line_items) {
      const { product_id, quantity, metadata } = item;
      hotelId = product_id;

      // Get hotel info
      const hotel = await hotelzifyApi.getHotelById(product_id, chainId);
      if (hotel) {
        hotelName = hotel.name;
      }

      // Check availability
      const availability = await hotelzifyApi.checkAvailability({
        hotelId: product_id,
        checkInDate: metadata.check_in_date,
        checkOutDate: metadata.check_out_date,
        adults: metadata.adults,
        children: metadata.children || 0,
        infants: metadata.infants || 0,
      });

      if (!availability.available) {
        throw new UCPCheckoutError("MERCHANDISE_NOT_AVAILABLE", "No rooms available for selected dates", {
          hotel_id: product_id,
          check_in_date: metadata.check_in_date,
          check_out_date: metadata.check_out_date,
        });
      }

      // Find matching room and pricing
      const room = this.findMatchingRoom(availability.rooms, metadata.room_name, metadata.rate_plan_name);
      if (!room) {
        throw new UCPCheckoutError("MERCHANDISE_NOT_AVAILABLE", "Selected room not available", {
          room_name: metadata.room_name,
          rate_plan_name: metadata.rate_plan_name,
        });
      }

      const pricing = this.findMatchingPricing(room, metadata.rate_plan_name);
      const unitPrice = pricing?.totalPriceForEntireStay || room.pricing[0]?.totalPriceForEntireStay || 0;

      processedItems.push({
        id: generateId(),
        productId: product_id,
        productName: room.roomName,
        quantity,
        unitPrice,
        totalPrice: unitPrice * quantity,
        metadata: {
          checkInDate: metadata.check_in_date,
          checkOutDate: metadata.check_out_date,
          ratePlanId: metadata.rate_plan_id,
          ratePlanName: pricing?.ratePlanName || metadata.rate_plan_name || room.pricing[0]?.ratePlanName,
          roomName: room.roomName,
          adults: metadata.adults,
          children: metadata.children,
          infants: metadata.infants,
          specialRequests: metadata.special_requests,
          nights: availability.nights,
        },
      });
    }

    // Calculate totals
    const totals = this.calculateTotals(processedItems, discount_codes);

    // Get hotel for fulfillment info
    const hotel = await hotelzifyApi.getHotelById(hotelId, chainId);

    // Create session
    const session: UCPCheckoutSession = {
      id: generateId(),
      chainId,
      hotelId,
      platformProfileUri: request._meta?.ucp?.profile,
      status: "incomplete",
      buyer: {
        email: buyer.email,
        phone: buyer.phone,
        firstName: buyer.first_name,
        lastName: buyer.last_name,
      },
      lineItems: processedItems,
      fulfillment: {
        type: "pickup",
        destination: {
          hotelName: hotelName || hotel?.name || "Hotel",
          address: hotel
            ? {
                addressLine1: hotel.address,
                city: hotel.city,
                state: hotel.state,
                country: hotel.country,
              }
            : undefined,
        },
        expectedDate: processedItems[0]?.metadata.checkInDate || "",
      },
      currency,
      totals,
      payment: {
        handlers: [
          {
            id: "hotelzify_redirect",
            type: "redirect",
            name: "Pay at Hotel / Online Payment",
          },
        ],
      },
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    sessionStore.setCheckoutSession(session);

    return this.formatCheckoutResponse(session);
  }

  async get(id: string): Promise<UCPCheckoutResponse> {
    const session = sessionStore.getCheckoutSession(id);
    if (!session) {
      throw new UCPCheckoutError("NOT_FOUND", `Checkout session ${id} not found`);
    }
    return this.formatCheckoutResponse(session);
  }

  async update(
    id: string,
    request: UpdateCheckoutRequest,
    chainId: string
  ): Promise<UCPCheckoutResponse> {
    const session = sessionStore.getCheckoutSession(id);
    if (!session) {
      throw new UCPCheckoutError("NOT_FOUND", `Checkout session ${id} not found`);
    }

    if (session.status !== "incomplete") {
      throw new UCPCheckoutError("INVALID_STATE", `Cannot update checkout in ${session.status} state`);
    }

    const updates: Partial<UCPCheckoutSession> = {};

    // Update buyer info
    if (request.buyer) {
      updates.buyer = {
        ...session.buyer,
        email: request.buyer.email || session.buyer.email,
        phone: request.buyer.phone || session.buyer.phone,
        firstName: request.buyer.first_name || session.buyer.firstName,
        lastName: request.buyer.last_name || session.buyer.lastName,
      };
    }

    // Update line items if provided
    if (request.line_items) {
      const processedItems: UCPLineItem[] = [];

      for (const item of request.line_items) {
        const { product_id, quantity, metadata } = item;

        const availability = await hotelzifyApi.checkAvailability({
          hotelId: product_id,
          checkInDate: metadata.check_in_date,
          checkOutDate: metadata.check_out_date,
          adults: metadata.adults,
          children: metadata.children || 0,
          infants: metadata.infants || 0,
        });

        if (!availability.available) {
          throw new UCPCheckoutError("MERCHANDISE_NOT_AVAILABLE", "Room not available");
        }

        const room = this.findMatchingRoom(availability.rooms, metadata.room_name, metadata.rate_plan_name);
        if (!room) {
          throw new UCPCheckoutError("MERCHANDISE_NOT_AVAILABLE", "Selected room not available");
        }

        const pricing = this.findMatchingPricing(room, metadata.rate_plan_name);
        const unitPrice = pricing?.totalPriceForEntireStay || room.pricing[0]?.totalPriceForEntireStay || 0;

        processedItems.push({
          id: generateId(),
          productId: product_id,
          productName: room.roomName,
          quantity,
          unitPrice,
          totalPrice: unitPrice * quantity,
          metadata: {
            checkInDate: metadata.check_in_date,
            checkOutDate: metadata.check_out_date,
            ratePlanId: metadata.rate_plan_id,
            ratePlanName: pricing?.ratePlanName || metadata.rate_plan_name,
            roomName: room.roomName,
            adults: metadata.adults,
            children: metadata.children,
            infants: metadata.infants,
            specialRequests: metadata.special_requests,
            nights: availability.nights,
          },
        });
      }

      updates.lineItems = processedItems;
      updates.totals = this.calculateTotals(processedItems, request.discount_codes);
    }

    const updated = sessionStore.updateCheckoutSession(id, updates);
    if (!updated) {
      throw new UCPCheckoutError("INTERNAL_ERROR", "Failed to update checkout session");
    }

    return this.formatCheckoutResponse(updated);
  }

  async complete(
    id: string,
    request: CompleteCheckoutRequest
  ): Promise<{ checkout: UCPCheckoutResponse; order: UCPOrderResponse }> {
    const { idempotency_key } = request;

    // Check idempotency
    const existingResult = sessionStore.getIdempotencyKey(idempotency_key, id);
    if (existingResult) {
      return existingResult as { checkout: UCPCheckoutResponse; order: UCPOrderResponse };
    }

    const session = sessionStore.getCheckoutSession(id);
    if (!session) {
      throw new UCPCheckoutError("NOT_FOUND", `Checkout session ${id} not found`);
    }

    if (session.status === "completed") {
      const order = sessionStore.getOrderByCheckoutSession(id);
      if (order) {
        return {
          checkout: this.formatCheckoutResponse(session),
          order: this.formatOrderResponse(order),
        };
      }
    }

    if (session.status !== "incomplete" && session.status !== "ready_for_complete") {
      throw new UCPCheckoutError("INVALID_STATE", `Cannot complete checkout in ${session.status} state`);
    }

    // Update status to in-progress
    sessionStore.updateCheckoutSession(id, { status: "complete_in_progress" });

    try {
      // Get first line item for booking details
      const lineItem = session.lineItems[0];
      if (!lineItem) {
        throw new UCPCheckoutError("VALIDATION_ERROR", "No items in checkout");
      }

      // Create booking via Hotelzify API
      const bookingResult = await hotelzifyApi.createBooking({
        hotelId: session.hotelId,
        name: `${session.buyer.firstName || ""} ${session.buyer.lastName || ""}`.trim() || "Guest",
        email: session.buyer.email,
        phone: session.buyer.phone || "",
        checkInDate: lineItem.metadata.checkInDate,
        checkOutDate: lineItem.metadata.checkOutDate,
        adults: lineItem.metadata.adults,
        children: lineItem.metadata.children || 0,
        infants: lineItem.metadata.infants || 0,
        roomName: lineItem.metadata.roomName || lineItem.productName,
        ratePlanName: lineItem.metadata.ratePlanName || "",
      });

      if (!bookingResult.success) {
        sessionStore.updateCheckoutSession(id, { status: "requires_escalation" });
        throw new UCPCheckoutError("PAYMENT_FAILED", bookingResult.error || "Booking failed");
      }

      // Create order
      const order: UCPOrder = {
        id: generateId(),
        checkoutSessionId: id,
        chainId: session.chainId,
        hotelId: session.hotelId,
        bookingId: bookingResult.bookingId,
        permalinkUrl: `${baseURL}/orders/${generateId()}`,
        status: "confirmed",
        lineItems: session.lineItems.map((item) => ({
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          quantityFulfilled: 0,
          unitPrice: item.unitPrice,
          status: "confirmed",
        })),
        fulfillment: {
          expectations: [
            {
              id: generateId(),
              method: "pickup",
              destination: session.fulfillment.destination,
              lineItemIds: session.lineItems.map((i) => i.id),
              fulfillableDate: session.fulfillment.expectedDate,
            },
          ],
          events: [
            {
              id: generateId(),
              type: "confirmed",
              timestamp: new Date(),
              lineItemIds: session.lineItems.map((i) => i.id),
              metadata: { bookingId: bookingResult.bookingId },
            },
          ],
        },
        totals: session.totals,
        currency: session.currency,
        buyer: session.buyer,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      sessionStore.setOrder(order);

      // Update checkout to completed
      const completedSession = sessionStore.updateCheckoutSession(id, {
        status: "completed",
        orderId: order.id,
      });

      const result = {
        checkout: this.formatCheckoutResponse(completedSession!),
        order: this.formatOrderResponse(order),
      };

      // Store idempotency result
      sessionStore.setIdempotencyKey(idempotency_key, id, result);

      return result;
    } catch (error) {
      sessionStore.updateCheckoutSession(id, { status: "requires_escalation" });
      throw error;
    }
  }

  async cancel(id: string, idempotencyKey: string): Promise<UCPCheckoutResponse> {
    const session = sessionStore.getCheckoutSession(id);
    if (!session) {
      throw new UCPCheckoutError("NOT_FOUND", `Checkout session ${id} not found`);
    }

    if (session.status === "completed") {
      throw new UCPCheckoutError("INVALID_STATE", "Cannot cancel completed checkout");
    }

    const updated = sessionStore.updateCheckoutSession(id, { status: "canceled" });
    return this.formatCheckoutResponse(updated!);
  }

  // Helper methods
  private findMatchingRoom(
    rooms: HotelzifyRoom[],
    roomName?: string,
    ratePlanName?: string
  ): HotelzifyRoom | null {
    if (roomName) {
      const exact = rooms.find((r) => r.roomName.toLowerCase() === roomName.toLowerCase());
      if (exact) return exact;
    }

    if (ratePlanName) {
      const withPlan = rooms.find((r) =>
        r.pricing.some((p) => p.ratePlanName.toLowerCase() === ratePlanName.toLowerCase())
      );
      if (withPlan) return withPlan;
    }

    // Return first available room
    return rooms.length > 0 ? rooms[0] : null;
  }

  private findMatchingPricing(
    room: HotelzifyRoom,
    ratePlanName?: string
  ): HotelzifyRoom["pricing"][0] | null {
    if (ratePlanName) {
      const exact = room.pricing.find(
        (p) => p.ratePlanName.toLowerCase() === ratePlanName.toLowerCase()
      );
      if (exact) return exact;
    }
    return room.pricing[0] || null;
  }

  private calculateTotals(
    lineItems: UCPLineItem[],
    discountCodes?: string[]
  ): UCPTotals {
    const subtotal = lineItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxRate = 0.18; // 18% GST
    const tax = Math.round(subtotal * taxRate);
    const fees = 0;
    const discount = 0; // TODO: Implement discount logic

    return {
      subtotal,
      tax,
      fees,
      discount,
      total: subtotal + tax + fees - discount,
    };
  }

  private formatCheckoutResponse(session: UCPCheckoutSession): UCPCheckoutResponse {
    return {
      ucp: { version: UCP_VERSION },
      id: session.id,
      status: session.status,
      currency: session.currency,
      line_items: session.lineItems.map((item) => ({
        id: item.id,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: { amount: item.unitPrice, currency: session.currency },
        total_price: { amount: item.totalPrice, currency: session.currency },
        metadata: item.metadata,
      })),
      buyer: session.buyer,
      fulfillment: session.fulfillment,
      totals: {
        subtotal: { amount: session.totals.subtotal, currency: session.currency },
        tax: { amount: session.totals.tax, currency: session.currency },
        fees: { amount: session.totals.fees, currency: session.currency },
        discount: { amount: session.totals.discount, currency: session.currency },
        total: { amount: session.totals.total, currency: session.currency },
      },
      payment: {
        handlers: session.payment.handlers,
      },
      links: {
        self: `${baseURL}/ucp/v1/checkout-sessions/${session.id}`,
        complete: `${baseURL}/ucp/v1/checkout-sessions/${session.id}/complete`,
        cancel: `${baseURL}/ucp/v1/checkout-sessions/${session.id}/cancel`,
      },
      expires_at: session.expiresAt.toISOString(),
    };
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
export const checkoutService = new CheckoutService();
