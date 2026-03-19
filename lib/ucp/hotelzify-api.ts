// Hotelzify API Wrapper
// Centralizes all external API calls to Hotelzify backend

import type {
  ChainHotel,
  HotelzifyRoom,
  HotelzifyBookingResponse,
} from "./types";

const BOOKING_API_TOKEN =
  process.env.HOTELZIFY_BOOKING_TOKEN ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjExNzE5LCJyb2xlIjo0LCJyb2xlcyI6IkFETUlOIiwiaG90ZWxJZHMiOlsyMDQ0LDM2NDUsMzY1MF0sImlhdCI6MTczMDgxMDM2OSwiZXhwIjoyMzM1NjEwMzY5fQ.q0jlQKIg6fWonaNrFaVzAJDPu6uP_cwuFmmw4eX11V8";

interface ChainApiResponse {
  status: number;
  data: {
    chain: { id: number; name: string };
    hotels: ChainHotel[];
  };
}

interface SearchApiResponse {
  hotels: Array<{
    hotel_id: number;
    hotel_name: string;
    rating: number;
    location: { address: string; city: string; state: string };
    amenities_text: string;
    search_score: number;
  }>;
  total_results: number;
  query: string;
}

interface AvailabilityApiResponse {
  status: number;
  data:
    | HotelzifyRoom[]
    | Array<{
        nextAvailablePastCheckInDate?: string;
        nextAvailableFutureCheckInDate?: string;
      }>;
}

export class HotelzifyApi {
  private chainCache = new Map<
    string,
    { data: { chain: { id: number; name: string }; hotels: ChainHotel[] }; timestamp: number }
  >();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  async getChainHotels(chainId: string): Promise<{
    chain: { id: number; name: string };
    hotels: ChainHotel[];
  }> {
    const cached = this.chainCache.get(chainId);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    const res = await fetch(
      `https://api.hotelzify.com/hotel/v2/hotel/chain-hotels-lite-v2?chainId=${chainId}`
    );
    const data: ChainApiResponse = await res.json();

    const result = {
      chain: data.data?.chain || { id: parseInt(chainId), name: "Hotel Chain" },
      hotels: data.data?.hotels || [],
    };

    this.chainCache.set(chainId, { data: result, timestamp: Date.now() });
    return result;
  }

  async searchHotels(
    query: string,
    chainId: string,
    limit: number = 5
  ): Promise<{
    hotels: Array<{
      hotel_id: number;
      hotel_name: string;
      rating: number;
      location: { address: string; city: string; state: string };
      amenities_text: string;
      search_score: number;
      images: string[];
    }>;
    total: number;
  }> {
    const [searchRes, chainData] = await Promise.all([
      fetch("https://chatapi.hotelzify.com/search/hotels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, chain_id: chainId, k: limit }),
      }),
      this.getChainHotels(chainId),
    ]);

    const searchData: SearchApiResponse = await searchRes.json();

    const hotels = searchData.hotels.map((hotel) => {
      const chainHotel = chainData.hotels.find((ch) => ch.id === hotel.hotel_id);
      return {
        ...hotel,
        rating: hotel.rating || chainHotel?.rating || 0,
        images:
          chainHotel?.HotelImages?.filter(
            (img) => img.cdnImageUrl && !img.cdnImageUrl.endsWith("chatbot-converted-images")
          ).map((img) => img.cdnImageUrl) || [],
      };
    });

    return { hotels, total: searchData.total_results };
  }

  async checkAvailability(params: {
    hotelId: string;
    checkInDate: string;
    checkOutDate: string;
    adults: number;
    children: number;
    infants: number;
  }): Promise<{
    available: boolean;
    rooms: HotelzifyRoom[];
    nights: number;
  }> {
    const totalGuest = params.adults + params.children + params.infants;

    const res = await fetch(
      "https://api.hotelzify.com/hotel/v1/hotel/chatbot-availability",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hotelId: params.hotelId,
          checkInDate: params.checkInDate,
          checkOutDate: params.checkOutDate,
          adults: params.adults,
          children: params.children,
          infants: params.infants,
          totalGuest,
        }),
      }
    );

    const data: AvailabilityApiResponse = await res.json();

    const rooms =
      Array.isArray(data.data) &&
      data.data.length > 0 &&
      "roomName" in data.data[0]
        ? (data.data as HotelzifyRoom[])
        : [];

    const checkIn = new Date(params.checkInDate);
    const checkOut = new Date(params.checkOutDate);
    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      available: rooms.length > 0,
      rooms,
      nights,
    };
  }

  async createBooking(params: {
    hotelId: string;
    name: string;
    email: string;
    phone: string;
    checkInDate: string;
    checkOutDate: string;
    adults: number;
    children: number;
    infants: number;
    roomName: string;
    ratePlanName: string;
  }): Promise<{ success: boolean; bookingId?: string; error?: string }> {
    // Parse phone number
    const cleanPhone = params.phone.replace(/[\s\-()]/g, "");
    const dialCodeMatch = cleanPhone.match(/^(\+\d{1,3})/);
    const dialCode = dialCodeMatch ? dialCodeMatch[1] : "+91";
    const mobile = cleanPhone.replace(/^\+\d{1,3}/, "");

    const payload = {
      hotelId: params.hotelId,
      name: params.name,
      email: params.email,
      dialCode,
      mobile,
      checkInDate: params.checkInDate,
      checkOutDate: params.checkOutDate,
      adults: params.adults,
      children: params.children,
      infants: params.infants,
      totalGuests: params.adults + params.children,
      applyExtraDiscount: false,
      hotelRooms: [{ name: params.roomName, ratePlanName: params.ratePlanName }],
    };

    const res = await fetch(
      "https://api.hotelzify.com/hotel/authorised/v1/bookings/chatbot",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${BOOKING_API_TOKEN}`,
        },
        body: JSON.stringify(payload),
      }
    );

    const result: HotelzifyBookingResponse = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: result.message || "Booking failed",
      };
    }

    return {
      success: true,
      bookingId: result.data?.bookingId || `BK${Date.now()}`,
    };
  }

  async getHotelById(
    hotelId: string,
    chainId: string
  ): Promise<ChainHotel | null> {
    const chainData = await this.getChainHotels(chainId);
    return (
      chainData.hotels.find((h) => h.id.toString() === hotelId) || null
    );
  }
}

// Singleton instance
export const hotelzifyApi = new HotelzifyApi();
