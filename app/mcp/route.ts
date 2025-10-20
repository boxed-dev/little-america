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

const handler = createMcpHandler(async (server) => {
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
      description: "Search for hotels by location or query",
      inputSchema: {
        query: z.string().describe("Search query (e.g., 'hotels in Kerala')"),
        chain_id: z.string().optional().default("1").describe("Hotel chain ID"),
        k: z.number().optional().default(10).describe("Maximum number of results"),
      },
      _meta: widgetMeta(hotelSearchWidget),
    },
    async ({ query, chain_id = "1", k = 10 }: { query: string; chain_id?: string; k?: number }) => {
      try {
        // Fetch search results
        const searchResponse = await fetch("https://chatapi.hotelzify.com/search/hotels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, chain_id, k }),
        });

        const searchData = await searchResponse.json();

        // Fetch hotel images from chain-hotels API
        const chainHotelsResponse = await fetch(`https://api.hotelzify.com/hotel/v2/hotel/chain-hotels-lite-v2?chainId=${chain_id}`);
        const chainHotelsData = await chainHotelsResponse.json();

        // Create a map of hotel images by hotel ID
        const hotelImagesMap = new Map();
        if (chainHotelsData.data?.hotels) {
          chainHotelsData.data.hotels.forEach((hotel: any) => {
            if (hotel.id && hotel.HotelImages) {
              hotelImagesMap.set(hotel.id, hotel.HotelImages);
            }
          });
        }

        // Merge images with search results
        const hotelsWithImages = (searchData.hotels || []).map((hotel: any) => ({
          ...hotel,
          HotelImages: hotelImagesMap.get(hotel.hotel_id) || [],
        }));

        return {
          content: [
            {
              type: "text",
              text: `Found ${hotelsWithImages.length || 0} hotels for "${query}"`,
            },
          ],
          structuredContent: {
            query,
            hotels: hotelsWithImages,
            count: hotelsWithImages.length || 0,
          },
          _meta: widgetMeta(hotelSearchWidget),
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error searching hotels: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          structuredContent: {
            query,
            hotels: [],
            error: true,
          },
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
      description: "Check room availability and pricing for a specific hotel",
      inputSchema: {
        hotelId: z.string().describe("Hotel ID"),
        checkInDate: z.string().describe("Check-in date (YYYY-MM-DD)"),
        checkOutDate: z.string().describe("Check-out date (YYYY-MM-DD)"),
        adults: z.number().optional().default(2).describe("Number of adults"),
        children: z.number().optional().default(0).describe("Number of children"),
        infants: z.number().optional().default(0).describe("Number of infants"),
      },
      _meta: widgetMeta(roomAvailabilityWidget),
    },
    async ({ hotelId, checkInDate, checkOutDate, adults = 2, children = 0, infants = 0 }: { hotelId: string; checkInDate: string; checkOutDate: string; adults?: number; children?: number; infants?: number }) => {
      try {
        const totalGuest = adults + children;
        const response = await fetch("https://api.hotelzify.com/hotel/v1/hotel/chatbot-availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hotelId, checkInDate, checkOutDate, adults, children, infants, totalGuest }),
        });

        const result = await response.json();

        return {
          content: [
            {
              type: "text",
              text: result.data?.length ? `Found ${result.data.length} available rooms` : "No rooms available for selected dates",
            },
          ],
          structuredContent: {
            hotelId,
            checkInDate,
            checkOutDate,
            guests: { adults, children, infants },
            rooms: result.data || [],
            available: result.data?.length > 0,
          },
          _meta: widgetMeta(roomAvailabilityWidget),
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error checking availability: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          structuredContent: {
            hotelId,
            checkInDate,
            checkOutDate,
            error: true,
          },
          _meta: widgetMeta(roomAvailabilityWidget),
        };
      }
    }
  );
});

export const GET = handler;
export const POST = handler;
