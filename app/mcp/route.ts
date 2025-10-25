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

// Hardcoded Little America Hotel Data
const LITTLE_AMERICA_DATA = {
  hotel_id: 1,
  hotel_name: "Little America Hotel",
  rating: 4.8,
  location: {
    address: "500 S Main St",
    city: "Salt Lake City",
    state: "Utah",
  },
  amenities_text: "Free WiFi, Outdoor Pool, Fitness Center, Restaurant, Room Service, Parking, Business Center, Concierge",
  search_score: 0.95,
  HotelImages: [
    { cdnImageUrl: "https://saltlake.littleamerica.com/wp-content/uploads/2025/03/LAS_Tower_King_1106-1697-Edit-V1-1024x683.jpg" },
    { cdnImageUrl: "https://saltlake.littleamerica.com/wp-content/uploads/2025/03/Garden_Premium_King_8108-1966-FV1-1024x681.jpg" },
    { cdnImageUrl: "https://saltlake.littleamerica.com/wp-content/uploads/2025/03/LAS_Presidential_Suite_2025-1532-RGB-V1-1024x682.jpg" },
    { cdnImageUrl: "https://saltlake.littleamerica.com/wp-content/uploads/2024/06/LASL-Garden-Lodge-Exteriors-IMG_1689-Edited-V4-1024x682.jpg" },
  ]
};

const LITTLE_AMERICA_ROOMS = [
  {
    roomName: "Tower King Room",
    id: 101,
    maxAdultCount: 2,
    maxChildCount: 2,
    maxInfantCount: 1,
    currency: "USD",
    amenities: ["King Bed", "Mountain View", "French Richelieu Furniture", "Free WiFi", "Work Desk", "Coffee Maker", "600 sq ft"],
    images: [
      "https://saltlake.littleamerica.com/wp-content/uploads/2025/03/LAS_Tower_King_1106-1697-Edit-V1-1024x683.jpg",
      "https://saltlake.littleamerica.com/wp-content/uploads/2025/03/LAS_Tower_King_1106-1698-Edit-V1-1024x683.jpg",
      "https://saltlake.littleamerica.com/wp-content/uploads/2025/03/LAS_Tower_King_1106-1723-Edit-V1-1024x681.jpg"
    ],
    pricing: [
      {
        totalPriceForEntireStay: 450,
        roomPricePerNight: 150,
        originalPriceBeforeDiscount: 500,
        useOnlyForDisplayRatePlanName: "Best Available Rate",
        ratePlanName: "BAR"
      },
      {
        totalPriceForEntireStay: 480,
        roomPricePerNight: 160,
        originalPriceBeforeDiscount: 520,
        useOnlyForDisplayRatePlanName: "Flexible Rate - Free Cancellation",
        ratePlanName: "FLEXIBLE"
      }
    ],
    availableRooms: 5,
    nights: 3
  },
  {
    roomName: "Garden Premium Room",
    id: 102,
    maxAdultCount: 4,
    maxChildCount: 2,
    maxInfantCount: 1,
    currency: "USD",
    amenities: ["King or 2 Queens", "English Wool Carpets", "Garden View", "Free WiFi", "Work Desk", "Coffee Maker", "500 sq ft"],
    images: [
      "https://saltlake.littleamerica.com/wp-content/uploads/2025/03/Garden_Premium_King_8108-1966-FV1-1024x681.jpg",
      "https://saltlake.littleamerica.com/wp-content/uploads/2025/03/Garden_Premium_King_8108-1998-Edit-V1-1024x683.jpg",
      "https://saltlake.littleamerica.com/wp-content/uploads/2025/03/Garden_Premium_King_8108-2028-Edit-V1-1024x668.jpg"
    ],
    pricing: [
      {
        totalPriceForEntireStay: 750,
        roomPricePerNight: 250,
        originalPriceBeforeDiscount: 900,
        useOnlyForDisplayRatePlanName: "Suite Special",
        ratePlanName: "SUITE_SPECIAL"
      }
    ],
    availableRooms: 3,
    nights: 3
  },
  {
    roomName: "Presidential Suite",
    id: 103,
    maxAdultCount: 2,
    maxChildCount: 0,
    maxInfantCount: 0,
    currency: "USD",
    amenities: ["King Bed", "Penthouse Views", "Private Balcony", "Dining Room", "Family Room", "Free WiFi", "1,200 sq ft"],
    images: [
      "https://saltlake.littleamerica.com/wp-content/uploads/2025/03/LAS_Presidential_Suite_2025-1532-RGB-V1-1024x682.jpg",
      "https://saltlake.littleamerica.com/wp-content/uploads/2025/03/LAS_Presidential_Suite_2025-1408-RGB-V1-1024x677.jpg",
      "https://saltlake.littleamerica.com/wp-content/uploads/2025/03/LAS_Presidential_Suite_2025-1494-RGB_V1-1024x682.jpg"
    ],
    pricing: [
      {
        totalPriceForEntireStay: 1350,
        roomPricePerNight: 450,
        originalPriceBeforeDiscount: 1500,
        useOnlyForDisplayRatePlanName: "Presidential Suite Rate",
        ratePlanName: "PRESIDENTIAL"
      }
    ],
    availableRooms: 1,
    nights: 3
  }
];

// Sample Q&A data for Little America
const LITTLE_AMERICA_QA = {
  "what amenities": "Little America Hotel offers a wide range of amenities including: Free WiFi throughout the property, Outdoor heated pool and hot tub, State-of-the-art fitness center, On-site restaurant and lounge, 24-hour room service, Complimentary parking, Business center with meeting rooms, and Concierge services.",
  "check-in time": "Check-in time at Little America Hotel is 3:00 PM and check-out time is 12:00 PM (noon). Early check-in and late check-out may be available upon request, subject to availability.",
  "parking": "Little America Hotel offers complimentary self-parking for all guests. Valet parking is also available for an additional fee of $15 per day.",
  "pet policy": "Yes, Little America Hotel is pet-friendly! We welcome dogs up to 50 lbs with a one-time pet fee of $50. Pets must be kept on a leash in public areas and cannot be left unattended in rooms.",
  "dining options": "The hotel features 'The Garden Restaurant' serving breakfast, lunch, and dinner with American cuisine. The 'Little America Lounge' offers cocktails and light bites in the evening. Room service is available 24/7.",
  "pool": "Our outdoor heated pool is open year-round from 6:00 AM to 10:00 PM. We also have a hot tub adjacent to the pool area. Pool towels are provided.",
  "wifi": "Complimentary high-speed WiFi is available throughout the entire hotel, including all guest rooms, public spaces, and meeting areas.",
  "airport": "Little America Hotel is located approximately 8 miles from Salt Lake City International Airport, about a 15-minute drive. Airport shuttle service is available for $25 per person round-trip with advance reservation.",
  "downtown": "The hotel is conveniently located in downtown Salt Lake City, walking distance to Temple Square (0.5 miles), City Creek Center shopping (0.3 miles), and the Salt Palace Convention Center (0.8 miles).",
  "cancellation": "Our standard cancellation policy requires 48 hours notice prior to arrival for a full refund. Some special rates may have different cancellation policies, which will be specified at the time of booking."
};

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
      description: "Search for Little America Hotel",
      inputSchema: {
        query: z.string().optional().default("Little America").describe("Search query (always returns Little America Hotel)"),
        chain_id: z.string().optional().default("1").describe("Hotel chain ID"),
        k: z.number().optional().default(1).describe("Maximum number of results"),
      },
      _meta: widgetMeta(hotelSearchWidget),
    },
    async ({ query = "Little America" }: { query?: string; chain_id?: string; k?: number }) => {
      // Return hardcoded Little America hotel data
      const hotels = [LITTLE_AMERICA_DATA];

      return {
        content: [
          {
            type: "text",
            text: `Found Little America Hotel in Salt Lake City, Utah`,
          },
        ],
        structuredContent: {
          query,
          hotels,
          count: 1,
        },
        _meta: widgetMeta(hotelSearchWidget),
      };
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
      description: "Check room availability and pricing for Little America Hotel",
      inputSchema: {
        hotelId: z.string().optional().default("1").describe("Hotel ID (Little America)"),
        checkInDate: z.string().describe("Check-in date (YYYY-MM-DD)"),
        checkOutDate: z.string().describe("Check-out date (YYYY-MM-DD)"),
        adults: z.number().optional().default(2).describe("Number of adults"),
        children: z.number().optional().default(0).describe("Number of children"),
        infants: z.number().optional().default(0).describe("Number of infants"),
      },
      _meta: widgetMeta(roomAvailabilityWidget),
    },
    async ({ hotelId = "1", checkInDate, checkOutDate, adults = 2, children = 0, infants = 0 }: { hotelId?: string; checkInDate: string; checkOutDate: string; adults?: number; children?: number; infants?: number }) => {
      // Calculate nights between dates
      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkOutDate);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

      // Adjust pricing based on number of nights
      const rooms = LITTLE_AMERICA_ROOMS.map(room => ({
        ...room,
        nights,
        pricing: room.pricing.map(price => ({
          ...price,
          totalPriceForEntireStay: price.roomPricePerNight * nights,
          originalPriceBeforeDiscount: (price.originalPriceBeforeDiscount / 3) * nights,
        }))
      }));

      return {
        content: [
          {
            type: "text",
            text: `Found ${rooms.length} available rooms at Little America Hotel for ${nights} night${nights !== 1 ? 's' : ''}`,
          },
        ],
        structuredContent: {
          hotelId,
          checkInDate,
          checkOutDate,
          guests: { adults, children, infants },
          rooms,
          available: true,
        },
        _meta: widgetMeta(roomAvailabilityWidget),
      };
    }
  );

  // Query Tool - Answer questions about Little America Hotel
  server.registerTool(
    "query_hotel_info",
    {
      title: "Query Hotel Information",
      description: "Answer questions about Little America Hotel amenities, policies, and services",
      inputSchema: {
        question: z.string().describe("Question about the hotel (e.g., 'What are the check-in times?', 'Is there parking?')"),
      },
    },
    async ({ question }: { question: string }) => {
      const lowerQuestion = question.toLowerCase();

      // Find matching answer based on keywords
      let answer = "I don't have specific information about that. Please contact Little America Hotel directly at (801) 363-6781 for assistance.";

      for (const [keywords, response] of Object.entries(LITTLE_AMERICA_QA)) {
        if (lowerQuestion.includes(keywords)) {
          answer = response;
          break;
        }
      }

      // Additional keyword matching
      if (lowerQuestion.includes("restaurant") || lowerQuestion.includes("food") || lowerQuestion.includes("breakfast")) {
        answer = LITTLE_AMERICA_QA["dining options"];
      } else if (lowerQuestion.includes("check") && (lowerQuestion.includes("in") || lowerQuestion.includes("out"))) {
        answer = LITTLE_AMERICA_QA["check-in time"];
      } else if (lowerQuestion.includes("pet") || lowerQuestion.includes("dog") || lowerQuestion.includes("cat")) {
        answer = LITTLE_AMERICA_QA["pet policy"];
      } else if (lowerQuestion.includes("location") || lowerQuestion.includes("where") || lowerQuestion.includes("address")) {
        answer = `Little America Hotel is located at 500 S Main St, Salt Lake City, Utah. ${LITTLE_AMERICA_QA["downtown"]}`;
      }

      return {
        content: [
          {
            type: "text",
            text: answer,
          },
        ],
      };
    }
  );
});

export const GET = handler;
export const POST = handler;
