// UCP MCP Server - Model Context Protocol binding for AI agents
// Implements UCP standard checkout tools + Hotelzify extensions

import { baseURL } from "@/baseUrl";
import { createMcpHandler } from "mcp-handler";
import { NextRequest } from "next/server";
import { z } from "zod";
import { hotelzifyApi } from "@/lib/ucp/hotelzify-api";
import { checkoutService, UCPCheckoutError } from "@/lib/ucp/checkout.service";
import { orderService } from "@/lib/ucp/order.service";

const DEFAULT_CHAIN_ID = "1";

const createUCPHandler = (chainId: string) =>
  createMcpHandler(async (server) => {
    // Fetch chain info
    let chainName = "Hotel Chain";
    try {
      const chainData = await hotelzifyApi.getChainHotels(chainId);
      chainName = chainData.chain?.name || "Hotel Chain";
    } catch (e) {
      console.error("Failed to fetch chain info:", e);
    }

    // ==========================================
    // UCP Standard Checkout Tools
    // ==========================================

    server.registerTool(
      "create_checkout",
      {
        title: "Create Hotel Checkout",
        description: `Create a new checkout session for hotel booking at ${chainName}`,
        inputSchema: {
          line_items: z
            .array(
              z.object({
                product_id: z.string().describe("Hotel ID"),
                quantity: z.number().int().min(1).describe("Number of rooms"),
                metadata: z.object({
                  check_in_date: z.string().describe("Check-in date (YYYY-MM-DD)"),
                  check_out_date: z.string().describe("Check-out date (YYYY-MM-DD)"),
                  rate_plan_id: z.string().optional().describe("Rate plan ID"),
                  rate_plan_name: z.string().optional().describe("Rate plan name"),
                  room_name: z.string().optional().describe("Room type name"),
                  adults: z.number().int().min(1).describe("Number of adults"),
                  children: z.number().int().min(0).optional().describe("Number of children"),
                  infants: z.number().int().min(0).optional().describe("Number of infants"),
                  special_requests: z.string().optional().describe("Special requests"),
                }),
              })
            )
            .describe("Room selections"),
          currency: z.string().length(3).default("INR").describe("Currency code"),
          buyer: z.object({
            email: z.string().email().describe("Buyer email"),
            phone: z.string().optional().describe("Buyer phone"),
            first_name: z.string().optional().describe("Buyer first name"),
            last_name: z.string().optional().describe("Buyer last name"),
          }),
          discount_codes: z.array(z.string()).optional().describe("Discount codes to apply"),
        },
      },
      async (input) => {
        try {
          const checkout = await checkoutService.create(
            {
              line_items: input.line_items,
              currency: input.currency || "INR",
              buyer: input.buyer,
              discount_codes: input.discount_codes,
            },
            chainId
          );

          return {
            content: [
              {
                type: "text",
                text: `Checkout session created. ID: ${checkout.id}. Total: ${checkout.currency} ${checkout.totals.total.amount}. Use complete_checkout to finalize the booking.`,
              },
            ],
            structuredContent: checkout,
          };
        } catch (error) {
          if (error instanceof UCPCheckoutError) {
            return {
              content: [{ type: "text", text: `Error: ${error.message}` }],
              structuredContent: { error: error.toJSON() },
            };
          }
          throw error;
        }
      }
    );

    server.registerTool(
      "get_checkout",
      {
        title: "Get Checkout Session",
        description: "Retrieve an existing checkout session by ID",
        inputSchema: {
          id: z.string().uuid().describe("Checkout session ID"),
        },
      },
      async ({ id }) => {
        try {
          const checkout = await checkoutService.get(id);
          return {
            content: [
              {
                type: "text",
                text: `Checkout session ${id}: Status=${checkout.status}, Total=${checkout.currency} ${checkout.totals.total.amount}`,
              },
            ],
            structuredContent: checkout,
          };
        } catch (error) {
          if (error instanceof UCPCheckoutError) {
            return {
              content: [{ type: "text", text: `Error: ${error.message}` }],
              structuredContent: { error: error.toJSON() },
            };
          }
          throw error;
        }
      }
    );

    server.registerTool(
      "update_checkout",
      {
        title: "Update Checkout Session",
        description: "Update an existing checkout session (modify rooms, apply discounts)",
        inputSchema: {
          id: z.string().uuid().describe("Checkout session ID"),
          line_items: z
            .array(
              z.object({
                product_id: z.string(),
                quantity: z.number().int().min(1),
                metadata: z.object({
                  check_in_date: z.string(),
                  check_out_date: z.string(),
                  rate_plan_id: z.string().optional(),
                  rate_plan_name: z.string().optional(),
                  room_name: z.string().optional(),
                  adults: z.number().int().min(1),
                  children: z.number().int().min(0).optional(),
                  infants: z.number().int().min(0).optional(),
                  special_requests: z.string().optional(),
                }),
              })
            )
            .optional()
            .describe("Updated room selections"),
          buyer: z
            .object({
              email: z.string().email().optional(),
              phone: z.string().optional(),
              first_name: z.string().optional(),
              last_name: z.string().optional(),
            })
            .optional()
            .describe("Updated buyer info"),
          discount_codes: z.array(z.string()).optional().describe("Discount codes"),
        },
      },
      async ({ id, line_items, buyer, discount_codes }) => {
        try {
          const checkout = await checkoutService.update(
            id,
            { line_items, buyer, discount_codes },
            chainId
          );
          return {
            content: [
              {
                type: "text",
                text: `Checkout updated. New total: ${checkout.currency} ${checkout.totals.total.amount}`,
              },
            ],
            structuredContent: checkout,
          };
        } catch (error) {
          if (error instanceof UCPCheckoutError) {
            return {
              content: [{ type: "text", text: `Error: ${error.message}` }],
              structuredContent: { error: error.toJSON() },
            };
          }
          throw error;
        }
      }
    );

    server.registerTool(
      "complete_checkout",
      {
        title: "Complete Checkout",
        description: "Complete the checkout and create the hotel reservation",
        inputSchema: {
          id: z.string().uuid().describe("Checkout session ID"),
          idempotency_key: z.string().uuid().describe("Unique key to prevent duplicate bookings"),
          payment: z
            .object({
              handler_id: z.string().describe("Payment handler ID"),
              token: z.string().optional().describe("Payment token"),
            })
            .optional()
            .describe("Payment details (optional for pay-at-hotel)"),
        },
      },
      async ({ id, idempotency_key, payment }) => {
        try {
          const result = await checkoutService.complete(id, {
            idempotency_key,
            payment,
          });

          return {
            content: [
              {
                type: "text",
                text: `Booking confirmed! Order ID: ${result.order.id}. Confirmation details have been sent to the guest's email.`,
              },
            ],
            structuredContent: result,
          };
        } catch (error) {
          if (error instanceof UCPCheckoutError) {
            return {
              content: [{ type: "text", text: `Booking failed: ${error.message}` }],
              structuredContent: { error: error.toJSON() },
            };
          }
          throw error;
        }
      }
    );

    server.registerTool(
      "cancel_checkout",
      {
        title: "Cancel Checkout",
        description: "Cancel a checkout session",
        inputSchema: {
          id: z.string().uuid().describe("Checkout session ID"),
          idempotency_key: z.string().uuid().describe("Unique key for the operation"),
        },
      },
      async ({ id, idempotency_key }) => {
        try {
          const checkout = await checkoutService.cancel(id, idempotency_key);
          return {
            content: [{ type: "text", text: `Checkout session ${id} has been cancelled.` }],
            structuredContent: checkout,
          };
        } catch (error) {
          if (error instanceof UCPCheckoutError) {
            return {
              content: [{ type: "text", text: `Error: ${error.message}` }],
              structuredContent: { error: error.toJSON() },
            };
          }
          throw error;
        }
      }
    );

    // ==========================================
    // UCP Order Tools
    // ==========================================

    server.registerTool(
      "get_order",
      {
        title: "Get Order",
        description: "Retrieve an order by ID",
        inputSchema: {
          id: z.string().uuid().describe("Order ID"),
        },
      },
      async ({ id }) => {
        try {
          const order = await orderService.get(id);
          return {
            content: [
              {
                type: "text",
                text: `Order ${id}: Status=${order.status}, Total=${order.currency} ${order.totals.total.amount}`,
              },
            ],
            structuredContent: order,
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Order not found: ${id}` }],
            structuredContent: { error: { code: "NOT_FOUND", message: "Order not found" } },
          };
        }
      }
    );

    // ==========================================
    // Hotelzify Extension Tools
    // ==========================================

    server.registerTool(
      "search_hotels",
      {
        title: "Search Hotels",
        description: `Search for hotels in the ${chainName} chain`,
        inputSchema: {
          query: z.string().describe("Search query (e.g., 'beach resort', 'hotels in Mumbai')"),
          limit: z.number().int().min(1).max(20).optional().default(5).describe("Max results"),
        },
      },
      async ({ query, limit = 5 }) => {
        try {
          const result = await hotelzifyApi.searchHotels(query, chainId, limit);

          return {
            content: [
              {
                type: "text",
                text: `Found ${result.hotels.length} hotel${result.hotels.length !== 1 ? "s" : ""} matching "${query}"`,
              },
            ],
            structuredContent: {
              query,
              hotels: result.hotels,
              count: result.hotels.length,
              chain_name: chainName,
            },
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Search failed: ${error instanceof Error ? error.message : "Unknown error"}` }],
            structuredContent: { error: true, query, hotels: [], count: 0 },
          };
        }
      }
    );

    server.registerTool(
      "get_room_availability",
      {
        title: "Get Room Availability",
        description: "Check room availability and pricing for a specific hotel",
        inputSchema: {
          hotel_id: z.string().describe("Hotel ID"),
          check_in_date: z.string().describe("Check-in date (YYYY-MM-DD)"),
          check_out_date: z.string().describe("Check-out date (YYYY-MM-DD)"),
          adults: z.number().int().min(1).default(2).describe("Number of adults"),
          children: z.number().int().min(0).default(0).describe("Number of children"),
          infants: z.number().int().min(0).default(0).describe("Number of infants"),
        },
      },
      async ({ hotel_id, check_in_date, check_out_date, adults = 2, children = 0, infants = 0 }) => {
        try {
          // Get hotel name
          const hotel = await hotelzifyApi.getHotelById(hotel_id, chainId);
          const hotelName = hotel?.name || "Hotel";

          const availability = await hotelzifyApi.checkAvailability({
            hotelId: hotel_id,
            checkInDate: check_in_date,
            checkOutDate: check_out_date,
            adults,
            children,
            infants,
          });

          return {
            content: [
              {
                type: "text",
                text: availability.available
                  ? `Found ${availability.rooms.length} available room type${availability.rooms.length !== 1 ? "s" : ""} at ${hotelName} for ${availability.nights} night${availability.nights !== 1 ? "s" : ""}`
                  : `No rooms available at ${hotelName} for the selected dates`,
              },
            ],
            structuredContent: {
              hotel_id,
              hotel_name: hotelName,
              check_in_date,
              check_out_date,
              guests: { adults, children, infants },
              nights: availability.nights,
              available: availability.available,
              rooms: availability.rooms.map((room) => ({
                id: room.id,
                name: room.roomName,
                max_adults: room.maxAdultCount,
                max_children: room.maxChildCount,
                currency: room.currency,
                amenities: room.amenities,
                images: room.images,
                available_rooms: room.availableRooms,
                rate_plans: room.pricing.map((p) => ({
                  name: p.ratePlanName,
                  display_name: p.useOnlyForDisplayRatePlanName,
                  price_per_night: p.roomPricePerNight,
                  total_price: p.totalPriceForEntireStay,
                  original_price: p.originalPriceBeforeDiscount,
                })),
              })),
            },
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Failed to check availability: ${error instanceof Error ? error.message : "Unknown error"}` }],
            structuredContent: { error: true, hotel_id, available: false, rooms: [] },
          };
        }
      }
    );

    server.registerTool(
      "get_hotel_details",
      {
        title: "Get Hotel Details",
        description: "Get detailed information about a specific hotel",
        inputSchema: {
          hotel_id: z.string().describe("Hotel ID"),
        },
      },
      async ({ hotel_id }) => {
        try {
          const hotel = await hotelzifyApi.getHotelById(hotel_id, chainId);

          if (!hotel) {
            return {
              content: [{ type: "text", text: `Hotel ${hotel_id} not found` }],
              structuredContent: { error: true, hotel_id },
            };
          }

          return {
            content: [
              {
                type: "text",
                text: `${hotel.name} - ${hotel.rating} star hotel in ${hotel.city}, ${hotel.state}. ${hotel.hotelHighlight || ""}`,
              },
            ],
            structuredContent: {
              id: hotel.id,
              name: hotel.name,
              rating: hotel.rating,
              location: {
                address: hotel.address,
                city: hotel.city,
                state: hotel.state,
                country: hotel.country,
              },
              highlight: hotel.hotelHighlight,
              images: hotel.HotelImages?.map((img) => img.cdnImageUrl) || [],
            },
          };
        } catch (error) {
          return {
            content: [{ type: "text", text: `Failed to get hotel details: ${error instanceof Error ? error.message : "Unknown error"}` }],
            structuredContent: { error: true, hotel_id },
          };
        }
      }
    );
  });

// Cache handlers by chainId
const handlerCache = new Map<string, ReturnType<typeof createUCPHandler>>();

function getHandler(chainId: string) {
  if (!handlerCache.has(chainId)) {
    handlerCache.set(chainId, createUCPHandler(chainId));
  }
  return handlerCache.get(chainId)!;
}

export async function GET(request: NextRequest) {
  const chainId = request.nextUrl.searchParams.get("chainId") || DEFAULT_CHAIN_ID;
  const handler = getHandler(chainId);
  return handler(request);
}

export async function POST(request: NextRequest) {
  const chainId = request.nextUrl.searchParams.get("chainId") || DEFAULT_CHAIN_ID;
  const handler = getHandler(chainId);
  return handler(request);
}
