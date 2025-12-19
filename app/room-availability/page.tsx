"use client";

import { useState } from "react";
import { useWidgetProps, useMaxHeight, useDisplayMode, useRequestDisplayMode } from "../hooks";
import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import { Button } from "@openai/apps-sdk-ui/components/Button";
import { Calendar, Users, BedDouble, Loader2, Tag, Mail, Phone, User, X, Check } from "lucide-react";

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
  hotelName?: string;
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

interface BookingFormData {
  name: string;
  email: string;
  phone: string;
}

interface SelectedBooking {
  room: Room;
  pricing: Pricing;
}

export default function RoomAvailabilityPage() {
  const toolOutput = useWidgetProps<RoomAvailabilityData>();
  const maxHeight = useMaxHeight() ?? undefined;
  const displayMode = useDisplayMode();
  const requestDisplayMode = useRequestDisplayMode();

  const checkIn = toolOutput?.checkInDate || "";
  const checkOut = toolOutput?.checkOutDate || "";
  const guests = toolOutput?.guests;
  const rooms = toolOutput?.rooms || [];
  const hotelName = toolOutput?.hotelName || "Hotel";

  const isLoading = !toolOutput || !toolOutput.hotelId;

  // Booking state
  const [isBookingMode, setIsBookingMode] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<SelectedBooking | null>(null);
  const [bookingForm, setBookingForm] = useState<BookingFormData>({
    name: "",
    email: "",
    phone: ""
  });
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [formErrors, setFormErrors] = useState<Partial<BookingFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const calculateDiscount = (original: number, final: number) => {
    if (original <= final) return 0;
    return Math.round(((original - final) / original) * 100);
  };

  const handleBookNow = async (room: Room, pricing: Pricing) => {
    setSelectedBooking({ room, pricing });
    setBookingConfirmed(false);
    setFormErrors({});

    // Request fullscreen mode for booking flow
    await requestDisplayMode("fullscreen");
    setIsBookingMode(true);
  };

  const validateForm = (): boolean => {
    const errors: Partial<BookingFormData> = {};

    if (!bookingForm.name.trim()) {
      errors.name = "Name is required";
    }

    if (!bookingForm.email.trim()) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(bookingForm.email)) {
      errors.email = "Invalid email address";
    }

    if (!bookingForm.phone.trim()) {
      errors.phone = "Phone number is required";
    } else if (!/^\+?[\d\s-()]{10,}$/.test(bookingForm.phone)) {
      errors.phone = "Invalid phone number";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleConfirmBooking = async () => {
    if (!validateForm() || !selectedBooking) return;

    setIsSubmitting(true);

    await new Promise(resolve => setTimeout(resolve, 1500));

    const timestamp = Date.now();
    const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const generatedBookingId = `LA-${timestamp.toString().slice(-6)}-${randomPart}`;

    setBookingId(generatedBookingId);
    setBookingConfirmed(true);
    setIsSubmitting(false);
  };

  const handleCloseBooking = async () => {
    setIsBookingMode(false);
    setSelectedBooking(null);
    setBookingForm({ name: "", email: "", phone: "" });
    setBookingConfirmed(false);
    setFormErrors({});
    setIsSubmitting(false);

    // Return to inline mode
    await requestDisplayMode("inline");
  };

  // Fullscreen booking flow
  if (isBookingMode && selectedBooking) {
    return (
      <div
        className="min-h-full bg-background"
        style={{
          maxHeight,
          height: displayMode === "fullscreen" ? maxHeight : undefined,
          overflow: "auto"
        }}
      >
        <div className="p-4 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                {bookingConfirmed ? "Booking Confirmed" : "Complete Your Booking"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {bookingConfirmed ? "Your reservation is confirmed" : "Enter your details to complete the reservation"}
              </p>
            </div>
            <button
              onClick={handleCloseBooking}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              aria-label="Close booking"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {!bookingConfirmed ? (
            <>
              {/* Room Summary */}
              <div className="p-4 rounded-xl border border-border bg-surface space-y-3">
                <div>
                  <h2 className="font-semibold text-foreground">{selectedBooking.room.roomName}</h2>
                  <p className="text-sm text-muted-foreground">{selectedBooking.pricing.useOnlyForDisplayRatePlanName}</p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <span className="text-sm text-muted-foreground">Total Amount</span>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-foreground">
                      {selectedBooking.room.currency} {selectedBooking.pricing.totalPriceForEntireStay.toFixed(0)}
                    </p>
                    {selectedBooking.pricing.originalPriceBeforeDiscount > selectedBooking.pricing.totalPriceForEntireStay && (
                      <p className="text-xs text-muted-foreground line-through">
                        {selectedBooking.room.currency} {selectedBooking.pricing.originalPriceBeforeDiscount.toFixed(0)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 pt-3 border-t border-border text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatDate(checkIn)} - {formatDate(checkOut)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>{guests?.adults || 0} adults{guests?.children ? `, ${guests.children} children` : ''}</span>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={bookingForm.name}
                    onChange={(e) => setBookingForm({ ...bookingForm, name: e.target.value })}
                    placeholder="John Doe"
                    className={`w-full px-3 py-2.5 rounded-lg border text-foreground bg-background placeholder:text-muted-foreground ${
                      formErrors.name ? 'border-red-500' : 'border-border'
                    } focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary`}
                  />
                  {formErrors.name && (
                    <p className="text-xs text-red-500">{formErrors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={bookingForm.email}
                    onChange={(e) => setBookingForm({ ...bookingForm, email: e.target.value })}
                    placeholder="john@example.com"
                    className={`w-full px-3 py-2.5 rounded-lg border text-foreground bg-background placeholder:text-muted-foreground ${
                      formErrors.email ? 'border-red-500' : 'border-border'
                    } focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary`}
                  />
                  {formErrors.email && (
                    <p className="text-xs text-red-500">{formErrors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={bookingForm.phone}
                    onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                    className={`w-full px-3 py-2.5 rounded-lg border text-foreground bg-background placeholder:text-muted-foreground ${
                      formErrors.phone ? 'border-red-500' : 'border-border'
                    } focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary`}
                  />
                  {formErrors.phone && (
                    <p className="text-xs text-red-500">{formErrors.phone}</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  color="secondary"
                  onClick={handleCloseBooking}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="solid"
                  color="primary"
                  onClick={handleConfirmBooking}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Confirm Booking'
                  )}
                </Button>
              </div>
            </>
          ) : (
            /* Booking Confirmation */
            <div className="space-y-6 text-center py-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4">
                  <Check className="w-10 h-10 text-green-600 dark:text-green-400" />
                </div>
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-foreground">Booking Confirmed!</h2>
                <p className="text-sm text-muted-foreground">Your reservation has been successfully confirmed</p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-surface">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Booking Reference</p>
                <p className="text-2xl font-mono font-semibold text-foreground">{bookingId}</p>
              </div>

              <div className="p-4 rounded-xl border border-border bg-surface space-y-3 text-left">
                <div className="flex justify-between pb-3 border-b border-border">
                  <div>
                    <p className="font-semibold text-foreground">{selectedBooking.room.roomName}</p>
                    <p className="text-sm text-muted-foreground">{selectedBooking.pricing.useOnlyForDisplayRatePlanName}</p>
                  </div>
                  <p className="font-semibold text-foreground">
                    {selectedBooking.room.currency} {selectedBooking.pricing.totalPriceForEntireStay.toFixed(0)}
                  </p>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Guest Name</span>
                    <span className="text-foreground">{bookingForm.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span className="text-foreground truncate ml-4">{bookingForm.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Check-in</span>
                    <span className="text-foreground">{formatDate(checkIn)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Check-out</span>
                    <span className="text-foreground">{formatDate(checkOut)}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/50 flex items-start gap-2 text-left">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  A confirmation email has been sent to <span className="font-medium text-foreground">{bookingForm.email}</span>
                </p>
              </div>

              <Button
                variant="solid"
                color="primary"
                onClick={handleCloseBooking}
                className="w-full"
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Inline room list view
  return (
    <div
      className="min-h-full bg-background"
      style={{
        maxHeight,
        height: displayMode === "fullscreen" ? maxHeight : undefined,
        overflow: "auto"
      }}
    >
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="space-y-3">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-foreground">
              {isLoading ? "Checking Availability" : "Available Rooms"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Finding available rooms..." : hotelName}
            </p>
          </div>

          {/* Booking Details */}
          {!isLoading && (
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge variant="outline" className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>{formatDate(checkIn)} - {formatDate(checkOut)}</span>
              </Badge>
              {guests && (
                <Badge variant="outline" className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>{guests.adults + guests.children} guests</span>
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-4">Checking room availability...</p>
          </div>
        ) : rooms.length > 0 ? (
          <div
            className="overflow-x-auto pb-4 -mx-4 px-4"
            style={{
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <div className="flex gap-4 w-max">
              {rooms.map((room) => {
                // Find best pricing (lowest total price)
                const bestPrice = room.pricing.reduce((best, current) =>
                  current.totalPriceForEntireStay < best.totalPriceForEntireStay ? current : best
                );
                const discount = calculateDiscount(bestPrice.originalPriceBeforeDiscount, bestPrice.totalPriceForEntireStay);
                const hasMultiplePlans = room.pricing.length > 1;

                return (
                  <div
                    key={room.id}
                    className="w-80 shrink-0 rounded-xl border border-border bg-surface overflow-hidden"
                    style={{ scrollSnapAlign: 'start' }}
                  >
                    {/* Image */}
                    {room.images && room.images[0] ? (
                      <div className="relative w-full h-48 bg-muted">
                        <img
                          src={room.images[0]}
                          alt={`Interior view of ${room.roomName} at ${hotelName} showing the bed, furniture, and room amenities`}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute top-3 right-3">
                          <Badge variant="solid" color="success">
                            {room.availableRooms} left
                          </Badge>
                        </div>
                      </div>
                    ) : (
                      <div className="relative w-full h-48 bg-muted flex items-center justify-center">
                        <BedDouble className="w-10 h-10 text-muted-foreground" />
                      </div>
                    )}

                    {/* Content */}
                    <div className="p-4 space-y-3">
                      <div>
                        <h2 className="font-semibold text-foreground">{room.roomName}</h2>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                          <Users className="w-3.5 h-3.5" />
                          <span>Up to {room.maxAdultCount} adults, {room.maxChildCount} children</span>
                        </div>
                      </div>

                      {/* Amenities */}
                      {room.amenities && room.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {room.amenities.slice(0, 4).map((amenity, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {amenity}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Pricing */}
                      <div className="pt-3 border-t border-border space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">
                              {bestPrice.useOnlyForDisplayRatePlanName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {room.currency} {bestPrice.roomPricePerNight.toFixed(0)} x {room.nights || 1} night{(room.nights || 1) !== 1 ? 's' : ''}
                            </p>
                            {hasMultiplePlans && (
                              <p className="text-xs text-green-600 dark:text-green-400">
                                Best Rate - {room.pricing.length} plans available
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            {discount > 0 && (
                              <Badge variant="solid" color="success" className="mb-1">
                                <Tag className="w-3 h-3 mr-1" />
                                {discount}% OFF
                              </Badge>
                            )}
                            <p className="text-lg font-semibold text-foreground">
                              {room.currency} {bestPrice.totalPriceForEntireStay.toFixed(0)}
                            </p>
                            {bestPrice.originalPriceBeforeDiscount > bestPrice.totalPriceForEntireStay && (
                              <p className="text-xs text-muted-foreground line-through">
                                {room.currency} {bestPrice.originalPriceBeforeDiscount.toFixed(0)}
                              </p>
                            )}
                          </div>
                        </div>

                        <Button
                          variant="solid"
                          color="primary"
                          onClick={() => handleBookNow(room, bestPrice)}
                          className="w-full"
                        >
                          Book Now
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <BedDouble className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">No rooms available</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              No rooms available for your selected dates. Try different dates.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
