import { NextRequest, NextResponse } from "next/server";

const BOOKING_API_TOKEN = process.env.HOTELZIFY_BOOKING_TOKEN || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjExNzE5LCJyb2xlIjo0LCJyb2xlcyI6IkFETUlOIiwiaG90ZWxJZHMiOlsyMDQ0LDM2NDUsMzY1MF0sImlhdCI6MTczMDgxMDM2OSwiZXhwIjoyMzM1NjEwMzY5fQ.q0jlQKIg6fWonaNrFaVzAJDPu6uP_cwuFmmw4eX11V8";

interface BookingRequest {
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
}

export async function POST(request: NextRequest) {
  try {
    const body: BookingRequest = await request.json();

    // Parse phone number
    const cleanPhone = body.phone.replace(/[\s\-()]/g, '');
    const dialCodeMatch = cleanPhone.match(/^(\+\d{1,3})/);
    const dialCode = dialCodeMatch ? dialCodeMatch[1] : '+91';
    const mobile = cleanPhone.replace(/^\+\d{1,3}/, '');

    const bookingPayload = {
      hotelId: body.hotelId,
      name: body.name,
      email: body.email,
      dialCode,
      mobile,
      checkInDate: body.checkInDate,
      checkOutDate: body.checkOutDate,
      adults: body.adults,
      children: body.children,
      infants: body.infants,
      totalGuests: body.adults + body.children,
      applyExtraDiscount: false,
      hotelRooms: [{ name: body.roomName, ratePlanName: body.ratePlanName }]
    };

    const response = await fetch('https://api.hotelzify.com/hotel/authorised/v1/bookings/chatbot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BOOKING_API_TOKEN}`
      },
      body: JSON.stringify(bookingPayload)
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: result.message || 'Booking failed' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      bookingId: result.data?.bookingId || result.bookingId,
      data: result.data
    });
  } catch (error) {
    console.error("Booking API error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
