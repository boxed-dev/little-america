import { baseURL } from "@/baseUrl";
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const getAppsSdkCompatibleHtml = async (baseUrl: string, path: string) => {
  const result = await fetch(`${baseUrl}${path}`);
  return await result.text();
};

type ContentWidget = {
  id: string;
  title: string;
  templateUri: string;
  invoking: string;
  invoked: string;
  html: string;
  description: string;
  widgetDomain: string;
};

function widgetMeta(widget: ContentWidget) {
  return {
    "openai/outputTemplate": widget.templateUri,
    "openai/toolInvocation/invoking": widget.invoking,
    "openai/toolInvocation/invoked": widget.invoked,
    "openai/widgetAccessible": false,
    "openai/resultCanProduceWidget": true,
  } as const;
}

// Chain ID for Sterling Resorts
const CHAIN_ID = "1";

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

const handler = createMcpHandler(async (server) => {
  // Fetch chain hotels data for image lookup
  let chainHotels: ChainHotel[] = [];
  let chainName = "Sterling Resorts";
  try {
    const chainRes = await fetch(`https://api.hotelzify.com/hotel/v2/hotel/chain-hotels-lite-v2?chainId=${CHAIN_ID}`);
    const chainData: ChainApiResponse = await chainRes.json();
    chainHotels = chainData.data?.hotels || [];
    chainName = chainData.data?.chain?.name || "Sterling Resorts";
  } catch (e) {
    console.error("Failed to fetch chain hotels:", e);
  }

  // Hotel Search Widget
  const hotelSearchHtml = await getAppsSdkCompatibleHtml(baseURL, "/hotel-search");
  const hotelSearchWidget: ContentWidget = {
    id: "search_hotels",
    title: "Search Hotels",
    templateUri: "ui://widget/hotel-search.html",
    invoking: "Searching hotels...",
    invoked: "Hotels found",
    html: hotelSearchHtml,
    description: "Search and display hotels",
    widgetDomain: "https://hotelzify.com",
  };

  server.registerResource(
    "hotel-search-widget",
    hotelSearchWidget.templateUri,
    {
      title: hotelSearchWidget.title,
      description: hotelSearchWidget.description,
      mimeType: "text/html+skybridge",
      _meta: {
        "openai/widgetDescription": hotelSearchWidget.description,
        "openai/widgetPrefersBorder": true,
      },
    },
    async (uri: { href: string }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/html+skybridge",
          text: `<html>${hotelSearchWidget.html}</html>`,
          _meta: {
            "openai/widgetDescription": hotelSearchWidget.description,
            "openai/widgetPrefersBorder": true,
            "openai/widgetDomain": hotelSearchWidget.widgetDomain,
          },
        },
      ],
    })
  );

  server.registerTool(
    hotelSearchWidget.id,
    {
      title: hotelSearchWidget.title,
      description: `Search for hotels in the ${chainName} chain`,
      inputSchema: {
        query: z.string().describe("Search query (e.g., 'hotels in Kerala', 'beach resorts')"),
        k: z.number().optional().default(5).describe("Maximum number of results"),
      },
      _meta: widgetMeta(hotelSearchWidget),
    },
    async ({ query, k = 5 }: { query: string; k?: number }) => {
      try {
        // Call the search API
        const searchRes = await fetch("https://chatapi.hotelzify.com/search/hotels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, chain_id: CHAIN_ID, k }),
        });
        const searchData: SearchApiResponse = await searchRes.json();

        // Merge with hotel images from chain data
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
              type: "text",
              text: `Found ${hotels.length} hotel${hotels.length !== 1 ? 's' : ''} matching "${query}"`,
            },
          ],
          structuredContent: {
            query,
            hotels,
            count: hotels.length,
            chainName,
          },
          _meta: widgetMeta(hotelSearchWidget),
        };
      } catch (error) {
        console.error("Search error:", error);
        return {
          content: [{ type: "text", text: `Error searching hotels: ${error instanceof Error ? error.message : "Unknown error"}` }],
          structuredContent: { error: true, query, hotels: [], count: 0, chainName },
          _meta: widgetMeta(hotelSearchWidget),
        };
      }
    }
  );

  // Room Availability Widget
  const roomAvailabilityHtml = await getAppsSdkCompatibleHtml(baseURL, "/room-availability");
  const roomAvailabilityWidget: ContentWidget = {
    id: "check_room_availability",
    title: "Check Room Availability",
    templateUri: "ui://widget/room-availability.html",
    invoking: "Checking availability...",
    invoked: "Availability checked",
    html: roomAvailabilityHtml,
    description: "Check room availability and pricing",
    widgetDomain: "https://hotelzify.com",
  };

  server.registerResource(
    "room-availability-widget",
    roomAvailabilityWidget.templateUri,
    {
      title: roomAvailabilityWidget.title,
      description: roomAvailabilityWidget.description,
      mimeType: "text/html+skybridge",
      _meta: {
        "openai/widgetDescription": roomAvailabilityWidget.description,
        "openai/widgetPrefersBorder": true,
      },
    },
    async (uri: { href: string }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/html+skybridge",
          text: `<html>${roomAvailabilityWidget.html}</html>`,
          _meta: {
            "openai/widgetDescription": roomAvailabilityWidget.description,
            "openai/widgetPrefersBorder": true,
            "openai/widgetDomain": roomAvailabilityWidget.widgetDomain,
          },
        },
      ],
    })
  );

  server.registerTool(
    roomAvailabilityWidget.id,
    {
      title: roomAvailabilityWidget.title,
      description: "Check room availability and pricing for a hotel",
      inputSchema: {
        hotelId: z.string().describe("Hotel ID"),
        hotelName: z.string().optional().describe("Hotel name for display"),
        checkInDate: z.string().describe("Check-in date (YYYY-MM-DD)"),
        checkOutDate: z.string().describe("Check-out date (YYYY-MM-DD)"),
        adults: z.number().optional().default(2).describe("Number of adults"),
        children: z.number().optional().default(0).describe("Number of children"),
        infants: z.number().optional().default(0).describe("Number of infants"),
      },
      _meta: widgetMeta(roomAvailabilityWidget),
    },
    async ({ hotelId, hotelName, checkInDate, checkOutDate, adults = 2, children = 0, infants = 0 }: { hotelId: string; hotelName?: string; checkInDate: string; checkOutDate: string; adults?: number; children?: number; infants?: number }) => {
      try {
        // Look up hotel name from chain data if not provided
        const resolvedHotelName = hotelName || chainHotels.find(h => h.id.toString() === hotelId)?.name || "Hotel";

        // Call the availability API
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

        // Check if we got rooms or just next available dates
        const rooms = Array.isArray(availData.data) && availData.data.length > 0 && 'roomName' in availData.data[0]
          ? availData.data as RoomData[]
          : [];

        const checkIn = new Date(checkInDate);
        const checkOut = new Date(checkOutDate);
        const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

        return {
          content: [
            {
              type: "text",
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
          _meta: widgetMeta(roomAvailabilityWidget),
        };
      } catch (error) {
        console.error("Availability error:", error);
        return {
          content: [{ type: "text", text: `Error checking availability: ${error instanceof Error ? error.message : "Unknown error"}` }],
          structuredContent: { error: true, hotelId, hotelName: hotelName || "Hotel", rooms: [], available: false },
          _meta: widgetMeta(roomAvailabilityWidget),
        };
      }
    }
  );
});

export const GET = handler;
export const POST = handler;
