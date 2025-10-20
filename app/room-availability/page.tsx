"use client";

import { useWidgetProps, useMaxHeight, useDisplayMode } from "../hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, BedDouble, Loader2 } from "lucide-react";

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
                <Calendar className="w-4 h-4" />
                <span>{formatDate(checkIn)}</span>
                <span>→</span>
                <span>{formatDate(checkOut)}</span>
              </div>
              {guests && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>{guests.adults + guests.children} guests</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="animate-spin h-12 w-12 text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Checking room availability...</p>
          </div>
        ) : rooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rooms.map((room) => (
              <Card key={room.id} className="overflow-hidden hover:shadow-md transition-shadow h-full flex flex-col">
                {room.images && room.images[0] && (
                  <div className="relative aspect-video w-full overflow-hidden bg-muted">
                    <img
                      src={room.images[0]}
                      alt={room.roomName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <CardTitle className="leading-tight">{room.roomName}</CardTitle>
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
                </CardHeader>
                <CardContent className="flex-grow flex flex-col">
                  {/* Amenities */}
                  {room.amenities && room.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
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
                  <div className="space-y-2 pt-4 border-t mt-auto">
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
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <BedDouble className="w-8 h-8 text-muted-foreground" />
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
