"use client";

import { useWidgetProps, useMaxHeight, useDisplayMode } from "../hooks";

interface Pricing {
  totalPriceForEntireStay: number;
  roomPricePerNight: number;
  originalPriceBeforeDiscount: number;
  useOnlyForDisplayRatePlanName: string;
  ratePlanName: string;
}

interface Room {
  roomName: string;
  id: number;
  maxAdultCount: number;
  maxChildCount: number;
  maxInfantCount: number;
  currency: string;
  amenities: string[];
  images: string[];
  pricing: Pricing[];
  availableRooms: number;
  nights: number;
}

interface RoomAvailabilityData extends Record<string, unknown> {
  hotelId?: string;
  checkInDate?: string;
  checkOutDate?: string;
  guests?: {
    adults: number;
    children: number;
    infants: number;
  };
  rooms?: Room[];
  available?: boolean;
}

export default function RoomAvailabilityPage() {
  const toolOutput = useWidgetProps<RoomAvailabilityData>();
  const maxHeight = useMaxHeight() ?? undefined;
  const displayMode = useDisplayMode();

  const hotelId = toolOutput?.hotelId || "";
  const checkIn = toolOutput?.checkInDate || "";
  const checkOut = toolOutput?.checkOutDate || "";
  const guests = toolOutput?.guests;
  const rooms = toolOutput?.rooms || [];
  
  // Check if data has loaded
  const isLoading = !toolOutput || !toolOutput.hotelId;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div
      className="min-h-full bg-background"
      style={{ 
        maxHeight, 
        height: displayMode === "fullscreen" ? maxHeight : undefined,
        overflow: "auto" 
      }}
    >
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isLoading ? "Checking Availability" : "Available Rooms"}
          </h1>
          
          {/* Booking Details Card */}
          {!isLoading && (
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>{formatDate(checkIn)}</span>
                <span>→</span>
                <span>{formatDate(checkOut)}</span>
              </div>
              {guests && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>{guests.adults + guests.children} guests</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-sm text-muted-foreground">Checking room availability...</p>
          </div>
        ) : rooms.length > 0 ? (
          <div className="space-y-4">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="rounded-lg border bg-card overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Room Image */}
                {room.images && room.images[0] && (
                  <div className="relative aspect-video w-full overflow-hidden bg-muted">
                    <img
                      src={room.images[0]}
                      alt={room.roomName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="p-5 space-y-4">
                  {/* Room Header */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className="text-lg font-medium leading-tight">{room.roomName}</h2>
                      <p className="text-sm text-muted-foreground">
                        Up to {room.maxAdultCount} adults · {room.maxChildCount} children
                      </p>
                    </div>
                    <div className="rounded-full bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 shrink-0">
                      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-500">
                        {room.availableRooms} left
                      </span>
                    </div>
                  </div>

                  {/* Amenities */}
                  {room.amenities && room.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {room.amenities.slice(0, 6).map((amenity, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground"
                        >
                          {amenity}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Pricing Options */}
                  <div className="space-y-2 pt-2 border-t">
                    {room.pricing.slice(0, 3).map((price, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium">
                            {price.useOnlyForDisplayRatePlanName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {room.currency} {price.roomPricePerNight.toFixed(0)} per night · {room.nights || 1} nights
                          </p>
                        </div>
                        <div className="text-right space-y-0.5">
                          <p className="text-lg font-semibold">
                            {room.currency} {price.totalPriceForEntireStay.toFixed(0)}
                          </p>
                          {price.originalPriceBeforeDiscount > price.totalPriceForEntireStay && (
                            <p className="text-xs text-muted-foreground line-through">
                              {room.currency} {price.originalPriceBeforeDiscount.toFixed(0)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-1">No rooms available</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Unfortunately, there are no rooms available for your selected dates. Try different dates or check back later.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
