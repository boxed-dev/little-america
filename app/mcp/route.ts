import { baseURL } from "@/baseUrl";
import { createMcpHandler } from "mcp-handler";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { NextRequest } from "next/server";
import { z } from "zod";
import { parsePhone } from "@/lib/phone";
import { searchHotels, getHotel } from "@/lib/hotel-index";

const getAppsSdkCompatibleHtml = async (baseUrl: string, path: string) => {
  const result = await fetch(`${baseUrl}${path}`);
  if (!result.ok) {
    throw new Error(`Failed to load widget ${path}: ${result.status}`);
  }
  return await result.text();
};

const toOrigin = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    return baseURL;
  }
};

const buildWidgetCsp = (appBaseUrl: string) => ({
  connectDomains: [
    "https://chatapi.hotelzify.com",
    "https://api.hotelzify.com",
    toOrigin(appBaseUrl),
  ],
  resourceDomains: [
    "https://api.hotelzify.com",
    "https://ik.imagekit.io",
    toOrigin(appBaseUrl),
  ],
});

const buildLegacyWidgetCsp = (appBaseUrl: string) => {
  const csp = buildWidgetCsp(appBaseUrl);
  return {
    connect_domains: csp.connectDomains,
    resource_domains: csp.resourceDomains,
    redirect_domains: [toOrigin(appBaseUrl), "https://www.hotelzify.com", "https://hotelzify.com"],
  };
};

const buildResourceMeta = (appBaseUrl: string, widgetDescription: string) => {
  const csp = buildWidgetCsp(appBaseUrl);
  return {
    ui: {
      csp,
      prefersBorder: true,
      domain: toOrigin(appBaseUrl),
    },
    "openai/widgetDescription": widgetDescription,
    "openai/widgetPrefersBorder": true,
    "openai/widgetCSP": buildLegacyWidgetCsp(appBaseUrl),
  };
};

// User-facing brand name (shown in tool descriptions and widgets)
const BRAND_NAME = "Hotelzify";

interface RoomPricing {
  totalPriceForEntireStay: number;
  roomPricePerNight: number;
  originalPriceBeforeDiscount?: number;
  useOnlyForDisplayRatePlanName: string;
  ratePlanName: string;
}

interface RoomData {
  roomName: string;
  id: number;
  maxAdultCount?: number;
  maxChildCount?: number;
  maxInfantCount?: number;
  currency?: string;
  amenities?: string[];
  images?: string[];
  pricing?: RoomPricing[];
  availableRooms?: number;
  nights?: number;
}

interface AvailabilityApiResponse {
  status: number;
  data: RoomData[] | { nextAvailablePastCheckInDate?: string; nextAvailableFutureCheckInDate?: string }[];
}

interface BookingPayload {
  hotelId: string;
  name: string;
  email: string;
  dialCode: string;
  mobile: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  infants: number;
  totalGuests: number;
  applyExtraDiscount: boolean;
  hotelRooms: { name: string; ratePlanName: string }[];
}

interface BookingApiResponse {
  status: number;
  data?: {
    bookingId: string;
    [key: string]: unknown;
  };
  message?: string;
}

const BOOKING_API_TOKEN = process.env.HOTELZIFY_BOOKING_TOKEN || "";

// Output schemas describe concise structuredContent for the model and widget.
// Keep upstream internals, policy blobs, and large image arrays out of model-visible output.
// IMPORTANT: these are factories, not shared consts. The handler re-registers
// tools per server instance, and zod schema objects must not be reused across registrations.
const searchHotelsOutputSchema = () => ({
  query: z.string().describe("The search query that was executed"),
  hotels: z.array(
    z.object({
      hotel_id: z.number().describe("Hotel ID, used for availability and booking"),
      hotel_name: z.string(),
      rating: z.number().optional(),
      location: z
        .object({
          address: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
        })
        .optional(),
      amenities_text: z.string().optional(),
      imageUrl: z.string().optional(),
    })
  ),
  count: z.number().describe("Number of hotels found"),
  chainName: z.string(),
  error: z.boolean().optional().describe("Present and true when the search failed"),
});

const checkAvailabilityOutputSchema = () => ({
  hotelId: z.string(),
  hotelName: z.string(),
  checkInDate: z.string().optional(),
  checkOutDate: z.string().optional(),
  guests: z
    .object({ adults: z.number(), children: z.number(), infants: z.number() })
    .optional(),
  rooms: z.array(
    z.object({
      id: z.number(),
      roomName: z.string(),
      maxAdultCount: z.number().optional(),
      maxChildCount: z.number().optional(),
      maxInfantCount: z.number().optional(),
      availableRooms: z.number(),
      currency: z.string(),
      amenities: z.array(z.string()),
      imageUrl: z.string().optional(),
      nights: z.number(),
      pricing: z
        .array(
          z.object({
            ratePlanName: z.string().describe("Rate plan identifier required by book_room"),
            useOnlyForDisplayRatePlanName: z.string().describe("Human-readable rate plan name; show this to the user"),
            totalPriceForEntireStay: z.number(),
            roomPricePerNight: z.number(),
            originalPriceBeforeDiscount: z.number().optional(),
          })
        )
        .describe("Bookable rate plans for this room"),
    })
  ),
  available: z.boolean().describe("Whether any rooms are available for the requested dates"),
  error: z.boolean().optional().describe("Present and true when the availability check failed"),
});

const bookRoomOutputSchema = () => ({
  success: z.boolean().describe("Whether the booking was confirmed by Hotelzify"),
  bookingId: z.union([z.string(), z.number()]).optional().describe("Confirmed booking reference, present only on success"),
  hotelName: z.string().optional(),
  roomName: z.string().optional(),
  checkInDate: z.string().optional(),
  checkOutDate: z.string().optional(),
  guests: z
    .object({ adults: z.number(), children: z.number(), infants: z.number() })
    .optional(),
  error: z.string().optional().describe("Failure reason, present only when success is false"),
});

const firstValidImage = (images?: string[]) =>
  images?.find((image) => image && !image.includes("chatbot-converted-images"));

const summarizeRoom = (room: RoomData) => ({
  id: room.id,
  roomName: room.roomName,
  maxAdultCount: room.maxAdultCount,
  maxChildCount: room.maxChildCount,
  maxInfantCount: room.maxInfantCount,
  availableRooms: room.availableRooms ?? 0,
  currency: room.currency ?? "INR",
  amenities: room.amenities?.slice(0, 6) ?? [],
  imageUrl: firstValidImage(room.images),
  nights: room.nights ?? 1,
  pricing: (room.pricing ?? [])
    .filter(
      (pricing) =>
        pricing.ratePlanName &&
        pricing.useOnlyForDisplayRatePlanName &&
        Number.isFinite(pricing.totalPriceForEntireStay) &&
        Number.isFinite(pricing.roomPricePerNight)
    )
    .map((pricing) => ({
      ratePlanName: pricing.ratePlanName,
      useOnlyForDisplayRatePlanName: pricing.useOnlyForDisplayRatePlanName,
      totalPriceForEntireStay: pricing.totalPriceForEntireStay,
      roomPricePerNight: pricing.roomPricePerNight,
      originalPriceBeforeDiscount: pricing.originalPriceBeforeDiscount,
    })),
});

const createHandler = (appBaseUrl: string) => createMcpHandler(async (server) => {
  // Hotel Search Widget
  const hotelSearchHtml = await getAppsSdkCompatibleHtml(appBaseUrl, "/hotel-search");
  const hotelSearchUri = `ui://hotelzify/hotel-search-v1.html`;
  const hotelSearchResourceMeta = buildResourceMeta(
    appBaseUrl,
    "Shows concise Hotelzify hotel search results with images, location, and property highlights."
  );

  registerAppResource(
    server,
    "Hotel Search",
    hotelSearchUri,
    {
      description: "Interactive hotel search results display",
      _meta: hotelSearchResourceMeta,
    },
    async () => ({
      contents: [
        {
          uri: hotelSearchUri,
          mimeType: RESOURCE_MIME_TYPE,
          text: hotelSearchHtml,
          _meta: hotelSearchResourceMeta,
        },
      ],
    })
  );

  registerAppTool(
    server,
    "search_hotels",
    {
      title: "Search Hotels",
      description: `Use this only when the user wants to search for Hotelzify hotels, resorts, accommodations, or available properties. Do not use this for flights, restaurants, general destination advice without hotel intent, or cancellation/modification of an existing reservation.`,
      inputSchema: {
        query: z.string().describe("Search query (e.g., 'hotels in Kerala', 'beach resorts')"),
        k: z.number().int().min(1).max(10).optional().default(5).describe("Maximum number of results"),
      },
      outputSchema: searchHotelsOutputSchema(),
      annotations: {
        title: "Search Hotels",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
      _meta: {
        ui: {
          resourceUri: hotelSearchUri,
        },
        "openai/outputTemplate": hotelSearchUri,
        "openai/toolInvocation/invoking": "Searching hotels...",
        "openai/toolInvocation/invoked": "Hotels ready",
      },
    },
    async ({ query, k = 5 }: { query: string; k?: number }) => {
      try {
        const hotels = await searchHotels(query, k);
        return {
          content: [
            {
              type: "text" as const,
              text: `Found ${hotels.length} hotel${hotels.length !== 1 ? 's' : ''} matching "${query}"`,
            },
          ],
          structuredContent: {
            query,
            hotels,
            count: hotels.length,
            chainName: BRAND_NAME,
          },
        };
      } catch (error) {
        console.error("Search error:", error);
        return {
          content: [{ type: "text" as const, text: "Hotel search is temporarily unavailable. Please try again in a moment." }],
          structuredContent: { error: true, query, hotels: [], count: 0, chainName: BRAND_NAME },
        };
      }
    }
  );

  // Room Availability Widget
  const roomAvailabilityHtml = await getAppsSdkCompatibleHtml(appBaseUrl, "/room-availability");
  const roomAvailabilityUri = `ui://hotelzify/room-availability-v1.html`;
  const roomAvailabilityResourceMeta = buildResourceMeta(
    appBaseUrl,
    "Shows Hotelzify room availability, concise pricing options, and an explicit reservation confirmation form."
  );

  registerAppResource(
    server,
    "Room Availability",
    roomAvailabilityUri,
    {
      description: "Interactive room availability and pricing display",
      _meta: roomAvailabilityResourceMeta,
    },
    async () => ({
      contents: [
        {
          uri: roomAvailabilityUri,
          mimeType: RESOURCE_MIME_TYPE,
          text: roomAvailabilityHtml,
          _meta: roomAvailabilityResourceMeta,
        },
      ],
    })
  );

  registerAppTool(
    server,
    "check_room_availability",
    {
      title: "Check Room Availability",
      description: "Use this only when the user wants to check room availability, see pricing, or view available rooms at a specific Hotelzify hotel for specific dates and guest counts. Do not use this for flights, restaurants, general destination advice, or cancellation/modification of an existing reservation. Each room's pricing options contain an internal ratePlanName identifier and a human-readable useOnlyForDisplayRatePlanName; always refer to rate plans by the display name when talking to the user.",
      inputSchema: {
        hotelId: z.string().describe("Hotel ID"),
        hotelName: z.string().optional().describe("Hotel name for display"),
        checkInDate: z.string().describe("Check-in date (YYYY-MM-DD)"),
        checkOutDate: z.string().describe("Check-out date (YYYY-MM-DD)"),
        adults: z.number().int().min(1).max(12).optional().default(2).describe("Number of adults"),
        children: z.number().int().min(0).max(12).optional().default(0).describe("Number of children"),
        infants: z.number().int().min(0).max(6).optional().default(0).describe("Number of infants"),
      },
      outputSchema: checkAvailabilityOutputSchema(),
      annotations: {
        title: "Check Room Availability",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
      _meta: {
        ui: {
          resourceUri: roomAvailabilityUri,
        },
        "openai/outputTemplate": roomAvailabilityUri,
        "openai/toolInvocation/invoking": "Checking rooms...",
        "openai/toolInvocation/invoked": "Rooms ready",
      },
    },
    async ({ hotelId, hotelName, checkInDate, checkOutDate, adults = 2, children = 0, infants = 0 }: { hotelId: string; hotelName?: string; checkInDate: string; checkOutDate: string; adults?: number; children?: number; infants?: number }) => {
      try {
        const resolvedHotelName = hotelName || (await getHotel(hotelId))?.hotel_name || "Hotel";
        const totalGuest = adults + children + infants;
        const availRes = await fetch("https://api.hotelzify.com/hotel/v1/hotel/chatbot-availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hotelId,
            checkInDate,
            checkOutDate,
            adults,
            children,
            infants,
            totalGuest,
          }),
        });
        if (!availRes.ok) {
          throw new Error(`Availability check failed with ${availRes.status}`);
        }
        const availData: AvailabilityApiResponse = await availRes.json();

        const rooms = Array.isArray(availData.data) && availData.data.length > 0 && 'roomName' in availData.data[0]
          ? availData.data as RoomData[]
          : [];
        const summarizedRooms = rooms.map(summarizeRoom).filter((room) => room.pricing.length > 0);

        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);
        const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

        return {
          content: [
            {
              type: "text" as const,
              text: summarizedRooms.length > 0
                ? `Found ${summarizedRooms.length} available room${summarizedRooms.length !== 1 ? 's' : ''} at ${resolvedHotelName} for ${nights} night${nights !== 1 ? 's' : ''}`
                : `No rooms available at ${resolvedHotelName} for the selected dates`,
            },
          ],
          structuredContent: {
            hotelId,
            hotelName: resolvedHotelName,
            checkInDate,
            checkOutDate,
            guests: { adults, children, infants },
            rooms: summarizedRooms,
            available: summarizedRooms.length > 0,
          },
        };
      } catch (error) {
        console.error("Availability error:", error);
        return {
          content: [{ type: "text" as const, text: `Error checking availability: ${error instanceof Error ? error.message : "Unknown error"}` }],
          structuredContent: { error: true, hotelId, hotelName: hotelName || "Hotel", rooms: [], available: false },
        };
      }
    }
  );

  // Book Room Tool (no widget - returns confirmation data)
  server.registerTool(
    "book_room",
    {
      title: "Book Room",
      description: "Use this only after the user has explicitly confirmed the selected Hotelzify room, dates, rate plan, guest name, email, phone number, guest counts, and total price. This creates a real hotel reservation request and may send a confirmation email. Do not use this for cancellations, modifications, flights, restaurants, or unconfirmed bookings. No payment is collected in ChatGPT.",
      inputSchema: {
        hotelId: z.string().describe("Hotel ID"),
        hotelName: z.string().optional().describe("Hotel name"),
        roomName: z.string().describe("Room name exactly as returned by check_room_availability"),
        ratePlanName: z.string().describe("Rate plan identifier: pass the pricing option's ratePlanName value exactly as returned by check_room_availability (often an opaque ID). When confirming with the user, refer to the plan by its useOnlyForDisplayRatePlanName instead."),
        checkInDate: z.string().describe("Check-in date (YYYY-MM-DD)"),
        checkOutDate: z.string().describe("Check-out date (YYYY-MM-DD)"),
        guestName: z.string().describe("Guest full name"),
        guestEmail: z.string().email().describe("Guest email address"),
        guestPhone: z.string().describe("Guest phone number: country code, a space, then the number (e.g., +91 9876543210)"),
        adults: z.number().int().min(1).max(12).optional().default(2).describe("Number of adults"),
        children: z.number().int().min(0).max(12).optional().default(0).describe("Number of children"),
        infants: z.number().int().min(0).max(6).optional().default(0).describe("Number of infants"),
        confirmedByUser: z.boolean().describe("Must be true only after the user explicitly confirms this exact reservation in the current turn or widget form"),
      },
      outputSchema: bookRoomOutputSchema(),
      annotations: {
        title: "Book Room",
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
      _meta: {
        ui: {
          visibility: ["model", "app"],
        },
        "openai/widgetAccessible": true,
        "openai/toolInvocation/invoking": "Submitting reservation...",
        "openai/toolInvocation/invoked": "Reservation submitted",
      },
    },
    async ({ hotelId, hotelName, roomName, ratePlanName, checkInDate, checkOutDate, guestName, guestEmail, guestPhone, adults = 2, children = 0, infants = 0, confirmedByUser }: {
      hotelId: string;
      hotelName?: string;
      roomName: string;
      ratePlanName: string;
      checkInDate: string;
      checkOutDate: string;
      guestName: string;
      guestEmail: string;
      guestPhone: string;
      adults?: number;
      children?: number;
      infants?: number;
      confirmedByUser: boolean;
    }) => {
      try {
        if (!confirmedByUser) {
          return {
            content: [{ type: "text" as const, text: "Please confirm the exact hotel, room, dates, guest details, and price before I submit the reservation." }],
            structuredContent: { success: false, error: "Reservation not confirmed by user" },
          };
        }
        const parsed = parsePhone(guestPhone);
        if (!parsed) {
          return {
            content: [{ type: "text" as const, text: "Please provide the phone number as the country code, a space, then the number (e.g., +1 5551234567 or +91 9876543210)." }],
            structuredContent: { success: false, error: "Invalid phone number format" },
          };
        }
        if (!BOOKING_API_TOKEN) {
          return {
            content: [{ type: "text" as const, text: "Booking is temporarily unavailable. Please try again later." }],
            structuredContent: { success: false, error: "Booking service unavailable" },
          };
        }
        const { dialCode, mobile } = parsed;

        const resolvedHotelName = hotelName || (await getHotel(hotelId))?.hotel_name || "Hotel";

        const bookingPayload: BookingPayload = {
          hotelId,
          name: guestName,
          email: guestEmail,
          dialCode,
          mobile,
          checkInDate,
          checkOutDate,
          adults,
          children,
          infants,
          totalGuests: adults + children + infants,
          applyExtraDiscount: false,
          hotelRooms: [{ name: roomName, ratePlanName }]
        };

        const response = await fetch('https://api.hotelzify.com/hotel/authorised/v1/bookings/chatbot', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${BOOKING_API_TOKEN}`
          },
          body: JSON.stringify(bookingPayload)
        });

        const result: BookingApiResponse = await response.json();

        if (!response.ok) {
          throw new Error(result.message || 'Booking failed');
        }

        const bookingId = result.data?.bookingId;
        if (!bookingId) {
          throw new Error('The hotel system did not confirm the booking');
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Reservation submitted. Booking ID: ${bookingId}. ${guestName} has successfully booked ${roomName} at ${resolvedHotelName} for ${checkInDate} to ${checkOutDate}. Confirmation sent to ${guestEmail}. No payment was collected in ChatGPT.`,
            },
          ],
          structuredContent: {
            success: true,
            bookingId,
            hotelName: resolvedHotelName,
            roomName,
            checkInDate,
            checkOutDate,
            guests: { adults, children, infants },
          },
        };
      } catch (error) {
        console.error("Booking error:", error);
        return {
          content: [{ type: "text" as const, text: `Booking failed: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.` }],
          structuredContent: { success: false, error: error instanceof Error ? error.message : "Unknown error" },
        };
      }
    }
  );
});

function getRequestBaseUrl(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  if (!host) return baseURL;

  const forwardedProto = request.headers.get("x-forwarded-proto");
  const proto = forwardedProto || (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

// Cache handlers by app origin so resource metadata follows the active deployment URL.
// The legacy ?chainId param is accepted but ignored — search now uses the unified index.
const handlerCache = new Map<string, ReturnType<typeof createHandler>>();

function getHandler(appBaseUrl: string) {
  const cacheKey = toOrigin(appBaseUrl);
  if (!handlerCache.has(cacheKey)) {
    handlerCache.set(cacheKey, createHandler(appBaseUrl));
  }
  return handlerCache.get(cacheKey)!;
}

async function handle(request: NextRequest) {
  const handler = getHandler(getRequestBaseUrl(request));
  const response = await handler(request);
  if (!(response instanceof Response)) {
    console.error("MCP handler returned non-Response:", response);
    return new Response("Internal Server Error", { status: 500 });
  }
  return response;
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
