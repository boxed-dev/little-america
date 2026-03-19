// UCP Hotel Availability - REST endpoint
// GET /ucp/v1/hotels/[hotelId]/availability

import { NextRequest } from "next/server";
import { hotelzifyApi } from "@/lib/ucp/hotelzify-api";

const DEFAULT_CHAIN_ID = "1";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hotelId: string }> }
) {
  try {
    const { hotelId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const chainId = searchParams.get("chainId") || DEFAULT_CHAIN_ID;

    const checkInDate = searchParams.get("check_in_date");
    const checkOutDate = searchParams.get("check_out_date");
    const adults = parseInt(searchParams.get("adults") || "2", 10);
    const children = parseInt(searchParams.get("children") || "0", 10);
    const infants = parseInt(searchParams.get("infants") || "0", 10);

    if (!checkInDate || !checkOutDate) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "check_in_date and check_out_date are required",
          },
        },
        { status: 400 }
      );
    }

    // Get hotel info
    const hotel = await hotelzifyApi.getHotelById(hotelId, chainId);

    // Check availability
    const availability = await hotelzifyApi.checkAvailability({
      hotelId,
      checkInDate,
      checkOutDate,
      adults,
      children,
      infants,
    });

    return Response.json(
      {
        hotel_id: hotelId,
        hotel_name: hotel?.name || "Hotel",
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        guests: { adults, children, infants },
        nights: availability.nights,
        available: availability.available,
        rooms: availability.rooms.map((room) => ({
          id: room.id,
          name: room.roomName,
          max_adults: room.maxAdultCount,
          max_children: room.maxChildCount,
          max_infants: room.maxInfantCount,
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
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Availability check error:", error);
    return Response.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
