import { baseURL } from "@/baseUrl";
import { createMcpHandler } from "mcp-handler";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { NextRequest } from "next/server";
import { z } from "zod";

const getAppsSdkCompatibleHtml = async (baseUrl: string, path: string) => {
  const result = await fetch(`${baseUrl}${path}`);
  return await result.text();
};

// CSP domains for widgets that load hotel images and data
const WIDGET_CSP = {
  connectDomains: [
    "https://chatapi.hotelzify.com",
    "https://api.hotelzify.com",
  ],
  resourceDomains: [
    "https://api.hotelzify.com",
    "https://ik.imagekit.io",
    "https://*.cloudinary.com",
    "https://*.amazonaws.com",
  ],
};

// Default Chain ID
const DEFAULT_CHAIN_ID = "1";

interface ChainHotel {
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

interface ChainApiResponse {
  status: number;
  data: {
    chain: {
      id: number;
      name: string;
    };
    hotels: ChainHotel[];
  };
}

interface SearchHotel {
  hotel_id: number;
  hotel_name: string;
  rating: number;
  location: {
    address: string;
    city: string;
    state: string;
  };
  amenities_text: string;
  search_score: number;
}

interface SearchApiResponse {
  hotels: SearchHotel[];
  total_results: number;
  query: string;
}

interface RoomPricing {
  totalPriceForEntireStay: number;
  roomPricePerNight: number;
  originalPriceBeforeDiscount: number;
  useOnlyForDisplayRatePlanName: string;
  ratePlanName: string;
}

interface RoomData {
  roomName: string;
  id: number;
  maxAdultCount: number;
  maxChildCount: number;
  maxInfantCount: number;
  currency: string;
  amenities: string[];
  images: string[];
  pricing: RoomPricing[];
  availableRooms: number;
  nights: number;
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

const createHandler = (chainId: string) => createMcpHandler(async (server) => {
  // Fetch chain hotels data for image lookup
  let chainHotels: ChainHotel[] = [];
  let chainName = "Hotel Chain";
  try {
    const chainRes = await fetch(`https://api.hotelzify.com/hotel/v2/hotel/chain-hotels-lite-v2?chainId=${chainId}`);
    const chainData: ChainApiResponse = await chainRes.json();
    chainHotels = chainData.data?.hotels || [];
    chainName = chainData.data?.chain?.name || "Hotel Chain";
  } catch (e) {
    console.error("Failed to fetch chain hotels:", e);
  }

  // Hotel Search Widget
  const hotelSearchHtml = await getAppsSdkCompatibleHtml(baseURL, "/hotel-search");
  const hotelSearchUri = `ui://hotelzify/hotel-search-v1.html`;

  registerAppResource(
    server,
    "Hotel Search",
    hotelSearchUri,
    {
      description: "Interactive hotel search results display",
      _meta: {
        ui: {
          csp: WIDGET_CSP,
          prefersBorder: true, domain: baseURL,
        },
      },
    },
    async () => ({
      contents: [
        {
          uri: hotelSearchUri,
          mimeType: RESOURCE_MIME_TYPE,
          text: hotelSearchHtml,
          _meta: {
            ui: {
              csp: WIDGET_CSP,
              prefersBorder: true, domain: baseURL,
            },
          },
        },
      ],
    })
  );

  registerAppTool(
    server,
    "search_hotels",
    {
      title: "Search Hotels",
      description: `Use this when the user wants to search for hotels, find accommodations, or browse available properties in the ${chainName} hotel chain.`,
      inputSchema: {
        query: z.string().describe("Search query (e.g., 'hotels in Kerala', 'beach resorts')"),
        k: z.number().optional().default(5).describe("Maximum number of results"),
      },
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
      },
    },
    async ({ query, k = 5 }: { query: string; k?: number }) => {
      try {
        const searchRes = await fetch("https://chatapi.hotelzify.com/search/hotels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, chain_id: chainId, k }),
        });
        const searchData: SearchApiResponse = await searchRes.json();

        const hotels = searchData.hotels.map((hotel) => {
          const chainHotel = chainHotels.find((ch) => ch.id === hotel.hotel_id);
          return {
            hotel_id: hotel.hotel_id,
            hotel_name: hotel.hotel_name,
            rating: hotel.rating || chainHotel?.rating || 0,
            location: hotel.location,
            amenities_text: hotel.amenities_text,
            search_score: hotel.search_score,
            HotelImages: chainHotel?.HotelImages?.filter(img =>
              img.cdnImageUrl && !img.cdnImageUrl.endsWith('chatbot-converted-images')
            ) || [],
          };
        });

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
            chainName,
          },
        };
      } catch (error) {
        console.error("Search error:", error);
        return {
          content: [{ type: "text" as const, text: `Error searching hotels: ${error instanceof Error ? error.message : "Unknown error"}` }],
          structuredContent: { error: true, query, hotels: [], count: 0, chainName },
        };
      }
    }
  );

  // Room Availability Widget
  const roomAvailabilityHtml = await getAppsSdkCompatibleHtml(baseURL, "/room-availability");
  const roomAvailabilityUri = `ui://hotelzify/room-availability-v1.html`;

  registerAppResource(
    server,
    "Room Availability",
    roomAvailabilityUri,
    {
      description: "Interactive room availability and pricing display",
      _meta: {
        ui: {
          csp: WIDGET_CSP,
          prefersBorder: true, domain: baseURL,
        },
      },
    },
    async () => ({
      contents: [
        {
          uri: roomAvailabilityUri,
          mimeType: RESOURCE_MIME_TYPE,
          text: roomAvailabilityHtml,
          _meta: {
            ui: {
              csp: WIDGET_CSP,
              prefersBorder: true, domain: baseURL,
            },
          },
        },
      ],
    })
  );

  registerAppTool(
    server,
    "check_room_availability",
    {
      title: "Check Room Availability",
      description: "Use this when the user wants to check room availability, see pricing, or view available rooms at a specific hotel for given dates.",
      inputSchema: {
        hotelId: z.string().describe("Hotel ID"),
        hotelName: z.string().optional().describe("Hotel name for display"),
        checkInDate: z.string().describe("Check-in date (YYYY-MM-DD)"),
        checkOutDate: z.string().describe("Check-out date (YYYY-MM-DD)"),
        adults: z.number().optional().default(2).describe("Number of adults"),
        children: z.number().optional().default(0).describe("Number of children"),
        infants: z.number().optional().default(0).describe("Number of infants"),
      },
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
      },
    },
    async ({ hotelId, hotelName, checkInDate, checkOutDate, adults = 2, children = 0, infants = 0 }: { hotelId: string; hotelName?: string; checkInDate: string; checkOutDate: string; adults?: number; children?: number; infants?: number }) => {
      try {
        const resolvedHotelName = hotelName || chainHotels.find(h => h.id.toString() === hotelId)?.name || "Hotel";
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
        const availData: AvailabilityApiResponse = await availRes.json();

        const rooms = Array.isArray(availData.data) && availData.data.length > 0 && 'roomName' in availData.data[0]
          ? availData.data as RoomData[]
          : [];

        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);
        const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

        return {
          content: [
            {
              type: "text" as const,
              text: rooms.length > 0
                ? `Found ${rooms.length} available room${rooms.length !== 1 ? 's' : ''} at ${resolvedHotelName} for ${nights} night${nights !== 1 ? 's' : ''}`
                : `No rooms available at ${resolvedHotelName} for the selected dates`,
            },
          ],
          structuredContent: {
            hotelId,
            hotelName: resolvedHotelName,
            checkInDate,
            checkOutDate,
            guests: { adults, children, infants },
            rooms,
            available: rooms.length > 0,
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
      description: "Use this when the user wants to book a hotel room after selecting a room and providing their guest details.",
      inputSchema: {
        hotelId: z.string().describe("Hotel ID"),
        hotelName: z.string().optional().describe("Hotel name"),
        roomName: z.string().describe("Room name"),
        ratePlanName: z.string().describe("Rate plan name"),
        checkInDate: z.string().describe("Check-in date (YYYY-MM-DD)"),
        checkOutDate: z.string().describe("Check-out date (YYYY-MM-DD)"),
        guestName: z.string().describe("Guest full name"),
        guestEmail: z.string().email().describe("Guest email address"),
        guestPhone: z.string().describe("Guest phone number with country code (e.g., +91 9876543210)"),
        adults: z.number().optional().default(2).describe("Number of adults"),
        children: z.number().optional().default(0).describe("Number of children"),
        infants: z.number().optional().default(0).describe("Number of infants"),
      },
      annotations: {
        title: "Book Room",
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: false,
      },
    },
    async ({ hotelId, hotelName, roomName, ratePlanName, checkInDate, checkOutDate, guestName, guestEmail, guestPhone, adults = 2, children = 0, infants = 0 }: {
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
    }) => {
      try {
        const cleanPhone = guestPhone.replace(/[\s\-()]/g, '');
        const dialCodeMatch = cleanPhone.match(/^(\+\d{1,3})/);
        const dialCode = dialCodeMatch ? dialCodeMatch[1] : '+91';
        const mobile = cleanPhone.replace(/^\+\d{1,3}/, '');

        const resolvedHotelName = hotelName || chainHotels.find(h => h.id.toString() === hotelId)?.name || "Hotel";

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
          totalGuests: adults + children,
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

        const bookingId = result.data?.bookingId || `BK${Date.now()}`;

        return {
          content: [
            {
              type: "text" as const,
              text: `Booking confirmed! Booking ID: ${bookingId}. ${guestName} has successfully booked ${roomName} at ${resolvedHotelName} for ${checkInDate} to ${checkOutDate}. Confirmation sent to ${guestEmail}.`,
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

// Cache handlers by chainId
const handlerCache = new Map<string, ReturnType<typeof createHandler>>();

function getHandler(chainId: string) {
  if (!handlerCache.has(chainId)) {
    handlerCache.set(chainId, createHandler(chainId));
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
