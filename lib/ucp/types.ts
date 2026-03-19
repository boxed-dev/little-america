// UCP Types for Hotelzify
// Based on Universal Commerce Protocol specification (https://ucp.dev)

export interface UCPProfile {
  ucp: {
    version: string;
    profile_url: string;
    business: UCPBusiness;
    services: Record<string, UCPService>;
    capabilities: UCPCapability[];
    payment_handlers: UCPPaymentHandler[];
  };
}

export interface UCPBusiness {
  name: string;
  description: string;
  logo_url?: string;
  support_email?: string;
  terms_url?: string;
  privacy_url?: string;
}

export interface UCPService {
  version: string;
  spec?: string;
  rest?: { endpoint: string; schema?: string };
  mcp?: { endpoint: string; schema?: string };
}

export interface UCPCapability {
  name: string;
  version: string;
  spec?: string;
  schema?: string;
  extends?: string;
}

export interface UCPPaymentHandler {
  id: string;
  type: 'card' | 'wallet' | 'redirect' | 'bank_transfer';
  name: string;
  instruments?: string[];
  config?: Record<string, unknown>;
}

// Checkout Session Types
export interface UCPCheckoutSession {
  id: string;
  chainId: string;
  hotelId: string;
  platformProfileUri?: string;
  status: UCPCheckoutStatus;
  buyer: UCPBuyer;
  lineItems: UCPLineItem[];
  fulfillment: UCPFulfillment;
  currency: string;
  totals: UCPTotals;
  payment: UCPPayment;
  discounts?: UCPDiscount[];
  orderId?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type UCPCheckoutStatus =
  | 'incomplete'
  | 'requires_escalation'
  | 'ready_for_complete'
  | 'complete_in_progress'
  | 'completed'
  | 'canceled';

export interface UCPBuyer {
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}

export interface UCPLineItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  metadata: UCPRoomMetadata;
}

export interface UCPRoomMetadata {
  checkInDate: string;
  checkOutDate: string;
  ratePlanId?: string;
  ratePlanName?: string;
  roomName?: string;
  adults: number;
  children?: number;
  infants?: number;
  specialRequests?: string;
  nights?: number;
}

export interface UCPFulfillment {
  type: 'pickup';
  destination: {
    hotelName: string;
    address?: UCPAddress;
  };
  expectedDate: string;
}

export interface UCPAddress {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface UCPTotals {
  subtotal: number;
  tax: number;
  fees: number;
  discount: number;
  total: number;
}

export interface UCPPayment {
  handlers: UCPPaymentHandler[];
  instrument?: {
    handlerId: string;
    token?: string;
  };
}

export interface UCPDiscount {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  appliedAmount: number;
}

// Order Types
export interface UCPOrder {
  id: string;
  checkoutSessionId: string;
  chainId: string;
  hotelId: string;
  reservationId?: string;
  bookingId?: string;
  permalinkUrl: string;
  status: UCPOrderStatus;
  lineItems: UCPOrderLineItem[];
  fulfillment: UCPOrderFulfillment;
  totals: UCPTotals;
  currency: string;
  buyer: UCPBuyer;
  createdAt: Date;
  updatedAt: Date;
}

export type UCPOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'fulfilled'
  | 'cancelled'
  | 'refunded';

export interface UCPOrderLineItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  quantityFulfilled: number;
  unitPrice: number;
  status: 'pending' | 'confirmed' | 'fulfilled' | 'cancelled';
}

export interface UCPOrderFulfillment {
  expectations: UCPFulfillmentExpectation[];
  events: UCPFulfillmentEvent[];
}

export interface UCPFulfillmentExpectation {
  id: string;
  method: 'pickup';
  destination: Record<string, unknown>;
  lineItemIds: string[];
  fulfillableDate: string;
}

export interface UCPFulfillmentEvent {
  id: string;
  type: 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  timestamp: Date;
  lineItemIds: string[];
  metadata?: Record<string, unknown>;
}

// API Request/Response Types
export interface CreateCheckoutRequest {
  line_items: CreateCheckoutLineItem[];
  currency: string;
  buyer: {
    email: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
  };
  discount_codes?: string[];
  _meta?: {
    ucp?: {
      profile: string;
    };
  };
}

export interface CreateCheckoutLineItem {
  product_id: string;
  quantity: number;
  metadata: {
    check_in_date: string;
    check_out_date: string;
    rate_plan_id?: string;
    rate_plan_name?: string;
    room_name?: string;
    adults: number;
    children?: number;
    infants?: number;
    special_requests?: string;
  };
}

export interface UpdateCheckoutRequest {
  line_items?: CreateCheckoutLineItem[];
  buyer?: {
    email?: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
  };
  discount_codes?: string[];
}

export interface CompleteCheckoutRequest {
  idempotency_key: string;
  payment?: {
    handler_id: string;
    token?: string;
  };
}

// Response types with index signature for MCP compatibility
export interface UCPCheckoutResponse {
  [key: string]: unknown;
  ucp: { version: string };
  id: string;
  status: UCPCheckoutStatus;
  currency: string;
  line_items: Array<{
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: { amount: number; currency: string };
    total_price: { amount: number; currency: string };
    metadata: UCPRoomMetadata;
  }>;
  buyer: UCPBuyer;
  fulfillment: UCPFulfillment;
  totals: {
    subtotal: { amount: number; currency: string };
    tax: { amount: number; currency: string };
    fees: { amount: number; currency: string };
    discount: { amount: number; currency: string };
    total: { amount: number; currency: string };
  };
  payment: {
    handlers: UCPPaymentHandler[];
  };
  links: {
    self: string;
    complete: string;
    cancel: string;
  };
  expires_at: string;
}

export interface UCPOrderResponse {
  [key: string]: unknown;
  ucp: { version: string };
  id: string;
  checkout_session_id: string;
  status: UCPOrderStatus;
  permalink_url: string;
  line_items: Array<{
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    quantity_fulfilled: number;
    unit_price: { amount: number; currency: string };
    status: string;
  }>;
  fulfillment: {
    expectations: UCPFulfillmentExpectation[];
    events: Array<{
      id: string;
      type: string;
      timestamp: string;
      line_item_ids: string[];
    }>;
  };
  totals: {
    subtotal: { amount: number; currency: string };
    tax: { amount: number; currency: string };
    fees: { amount: number; currency: string };
    discount: { amount: number; currency: string };
    total: { amount: number; currency: string };
  };
  currency: string;
  buyer: UCPBuyer;
  created_at: string;
  updated_at: string;
}

// UCP Error Types
export interface UCPError {
  [key: string]: unknown;
  code: UCPErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type UCPErrorCode =
  | 'NOT_FOUND'
  | 'INVALID_STATE'
  | 'MERCHANDISE_NOT_AVAILABLE'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_REQUIRED'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
  | 'IDEMPOTENCY_CONFLICT';

// Hotelzify API Types (from existing implementation)
export interface HotelzifyRoom {
  roomName: string;
  id: number;
  maxAdultCount: number;
  maxChildCount: number;
  maxInfantCount: number;
  currency: string;
  amenities: string[];
  images: string[];
  pricing: HotelzifyRoomPricing[];
  availableRooms: number;
  nights: number;
}

export interface HotelzifyRoomPricing {
  totalPriceForEntireStay: number;
  roomPricePerNight: number;
  originalPriceBeforeDiscount: number;
  useOnlyForDisplayRatePlanName: string;
  ratePlanName: string;
}

export interface HotelzifyBookingResponse {
  status: number;
  data?: {
    bookingId: string;
    [key: string]: unknown;
  };
  message?: string;
}

export interface ChainHotel {
  id: number;
  name: string;
  city: string;
  state: string;
  country: string;
  address: string;
  rating: number;
  hotelHighlight: string;
  HotelImages?: { cdnImageUrl: string }[];
}
