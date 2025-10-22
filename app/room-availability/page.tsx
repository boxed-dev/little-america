"use client";

import { useState } from "react";
import { useWidgetProps, useMaxHeight, useDisplayMode } from "../hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, BedDouble, Loader2, Sparkles, Tag, Mail, Phone, User, X, Check, ArrowLeft } from "lucide-react";

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

  const hotelId = toolOutput?.hotelId || "";
  const checkIn = toolOutput?.checkInDate || "";
  const checkOut = toolOutput?.checkOutDate || "";
  const guests = toolOutput?.guests;
  const rooms = toolOutput?.rooms || [];

  // Check if data has loaded
  const isLoading = !toolOutput || !toolOutput.hotelId;

  // Booking state
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<SelectedBooking | null>(null);
  const [bookingForm, setBookingForm] = useState<BookingFormData>({
    name: "",
    email: "",
    phone: ""
  });
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [formErrors, setFormErrors] = useState<Partial<BookingFormData>>({});

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const calculateDiscount = (original: number, final: number) => {
    if (original <= final) return 0;
    return Math.round(((original - final) / original) * 100);
  };

  const generateBookingId = () => {
    const prefix = "BK";
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  };

  const handleBookNow = (room: Room, pricing: Pricing) => {
    setSelectedBooking({ room, pricing });
    setShowBookingForm(true);
    setBookingConfirmed(false);
    setFormErrors({});
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

  const handleConfirmBooking = () => {
    if (validateForm()) {
      setBookingId(generateBookingId());
      setBookingConfirmed(true);
    }
  };

  const handleCloseModal = () => {
    setShowBookingForm(false);
    setSelectedBooking(null);
    setBookingForm({ name: "", email: "", phone: "" });
    setBookingConfirmed(false);
    setFormErrors({});
  };

  return (
    <>
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .fade-in {
          animation: fadeIn 0.5s ease-out forwards;
        }

        .horizontal-scroll {
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
        }

        .horizontal-scroll > div > * {
          scroll-snap-align: start;
        }

        .horizontal-scroll::-webkit-scrollbar {
          height: 6px;
        }

        .horizontal-scroll::-webkit-scrollbar-track {
          background: transparent;
          margin: 0 24px;
        }

        .horizontal-scroll::-webkit-scrollbar-thumb {
          background: rgb(203 213 225);
          border-radius: 3px;
          transition: background 0.2s;
        }

        .horizontal-scroll::-webkit-scrollbar-thumb:hover {
          background: rgb(148 163 184);
        }

        .room-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .room-card:hover {
          transform: translateY(-4px);
        }

        .image-container {
          position: relative;
          overflow: hidden;
        }

        .image-container img {
          transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .room-card:hover .image-container img {
          transform: scale(1.05);
        }

        .pricing-option {
          transition: all 0.2s ease;
        }

        .pricing-option:hover {
          transform: translateX(4px);
        }

        .modal-backdrop {
          animation: fadeIn 0.2s ease-out;
        }

        .modal-content {
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .input-field {
          transition: all 0.2s ease;
        }

        .input-field:focus {
          transform: translateY(-2px);
        }

        .success-checkmark {
          animation: scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes scaleIn {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .booking-button {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .booking-button:hover {
          transform: scale(1.02);
        }

        .booking-button:active {
          transform: scale(0.98);
        }
      `}</style>
      <div
        className="min-h-full bg-gradient-to-b from-background to-muted/20"
        style={{
          maxHeight,
          height: displayMode === "fullscreen" ? maxHeight : undefined,
          overflow: "auto"
        }}
      >
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="space-y-4 fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {isLoading ? "Checking Availability" : "Available Rooms"}
            </h1>
          </div>

          {/* Booking Details Card */}
          {!isLoading && (
            <div className="flex flex-wrap gap-4 p-4 rounded-xl bg-card/50 backdrop-blur-sm border">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="font-medium">{formatDate(checkIn)}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-medium">{formatDate(checkOut)}</span>
              </div>
              {guests && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="font-medium">{guests.adults + guests.children} guests</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 fade-in">
            <div className="relative">
              <Loader2 className="animate-spin h-16 w-16 text-primary/40" />
              <div className="absolute inset-0 blur-xl bg-primary/20 animate-pulse"></div>
            </div>
            <p className="text-sm text-muted-foreground mt-6 animate-pulse">Checking room availability...</p>
          </div>
        ) : rooms.length > 0 ? (
          <div
            className="horizontal-scroll overflow-x-auto overflow-y-visible pb-6 -mx-6 px-6 fade-in"
            style={{
              scrollBehavior: 'smooth',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgb(203 213 225) transparent'
            }}
          >
            <div className="flex gap-5 w-max">
              {rooms.map((room, index) => (
                <Card
                  key={room.id}
                  className="room-card overflow-hidden hover:shadow-xl flex flex-col w-96 shrink-0 border-0 bg-card/50 backdrop-blur-sm"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {room.images && room.images[0] ? (
                    <div className="image-container relative w-full h-52 bg-gradient-to-br from-muted to-muted/50">
                      <img
                        src={room.images[0]}
                        alt={room.roomName}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                  ) : (
                    <div className="relative w-full h-52 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                      <BedDouble className="w-12 h-12 text-muted-foreground/40" />
                    </div>
                  )}

                  <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-emerald-500/95 backdrop-blur-sm px-3 py-1.5 shadow-lg">
                    <span className="text-xs font-semibold text-white">
                      {room.availableRooms} left
                    </span>
                  </div>

                  <CardHeader className="pb-3">
                    <div className="space-y-2">
                      <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">
                        {room.roomName}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        <span>Up to {room.maxAdultCount} adults · {room.maxChildCount} children</span>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-grow flex flex-col space-y-4 pt-0">
                    {/* Amenities */}
                    {room.amenities && room.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {room.amenities.slice(0, 6).map((amenity, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center rounded-lg bg-muted/70 px-2.5 py-1 text-xs font-medium text-muted-foreground"
                          >
                            {amenity}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Pricing Options - Show only best rate */}
                    <div className="space-y-3 pt-3 border-t mt-auto">
                      {(() => {
                        // Find the best pricing option (lowest total price)
                        const bestPrice = room.pricing.reduce((best, current) =>
                          current.totalPriceForEntireStay < best.totalPriceForEntireStay ? current : best
                        );
                        const discount = calculateDiscount(bestPrice.originalPriceBeforeDiscount, bestPrice.totalPriceForEntireStay);
                        const hasMultiplePlans = room.pricing.length > 1;

                        return (
                          <>
                            <div className="pricing-option relative flex items-center justify-between p-3 rounded-lg bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50">
                              {discount > 0 && (
                                <div className="absolute -top-2 -right-2 flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 shadow-sm">
                                  <Tag className="w-3 h-3 text-white" />
                                  <span className="text-xs font-bold text-white">{discount}% OFF</span>
                                </div>
                              )}
                              <div className="space-y-1 pr-4">
                                <p className="text-sm font-semibold leading-tight">
                                  {bestPrice.useOnlyForDisplayRatePlanName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {room.currency} {bestPrice.roomPricePerNight.toFixed(0)} × {room.nights || 1} {room.nights === 1 ? 'night' : 'nights'}
                                </p>
                                {hasMultiplePlans && (
                                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                    Best Rate • {room.pricing.length} plans available
                                  </p>
                                )}
                              </div>
                              <div className="text-right space-y-0.5">
                                <p className="text-xl font-bold">
                                  {room.currency} {bestPrice.totalPriceForEntireStay.toFixed(0)}
                                </p>
                                {bestPrice.originalPriceBeforeDiscount > bestPrice.totalPriceForEntireStay && (
                                  <p className="text-xs text-muted-foreground line-through">
                                    {room.currency} {bestPrice.originalPriceBeforeDiscount.toFixed(0)}
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleBookNow(room, bestPrice)}
                              className="booking-button w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-sm shadow-md hover:shadow-lg"
                            >
                              Book Now
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center fade-in">
            <div className="rounded-full bg-gradient-to-br from-muted to-muted/50 p-6 mb-6 shadow-inner">
              <BedDouble className="w-12 h-12 text-muted-foreground/60" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No rooms available</h3>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
              Unfortunately, there are no rooms available for your selected dates. Try different dates or check back later.
            </p>
          </div>
        )}

        {/* Booking Modal - Redesigned */}
        {showBookingForm && selectedBooking && (
          <div className="modal-backdrop fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="modal-content bg-gradient-to-br from-background via-background to-muted/20 rounded-3xl shadow-2xl max-w-md w-full max-h-[95vh] overflow-hidden border-2 border-border/50">
              {!bookingConfirmed ? (
                /* Booking Form */
                <div className="overflow-y-auto max-h-[95vh]">
                  {/* Header with close button */}
                  <div className="sticky top-0 z-10 bg-gradient-to-b from-background to-background/95 backdrop-blur-xl border-b border-border/50">
                    <div className="flex items-start justify-between p-6 pb-4">
                      <div className="space-y-1">
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                          Complete Your Booking
                        </h2>
                        <p className="text-sm text-muted-foreground">Just a few details to confirm your stay</p>
                      </div>
                      <button
                        onClick={handleCloseModal}
                        className="rounded-full p-2 hover:bg-muted/80 transition-all duration-200 hover:rotate-90"
                        aria-label="Close"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Selected Room Summary - Enhanced */}
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-2 border-primary/20 p-5 space-y-4">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                      <div className="relative">
                        <h3 className="font-bold text-lg mb-1">{selectedBooking.room.roomName}</h3>
                        <p className="text-sm text-muted-foreground">{selectedBooking.pricing.useOnlyForDisplayRatePlanName}</p>
                      </div>

                      <div className="relative flex items-center justify-between pt-3 border-t border-primary/20">
                        <span className="text-sm font-medium text-muted-foreground">Total Amount</span>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">
                            {selectedBooking.room.currency} {selectedBooking.pricing.totalPriceForEntireStay.toFixed(0)}
                          </p>
                          {selectedBooking.pricing.originalPriceBeforeDiscount > selectedBooking.pricing.totalPriceForEntireStay && (
                            <p className="text-xs text-muted-foreground line-through">
                              {selectedBooking.room.currency} {selectedBooking.pricing.originalPriceBeforeDiscount.toFixed(0)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="relative flex flex-wrap gap-4 pt-3 border-t border-primary/20 text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="w-4 h-4 text-primary" />
                          <span className="font-medium">{formatDate(checkIn)} - {formatDate(checkOut)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Users className="w-4 h-4 text-primary" />
                          <span className="font-medium">{guests?.adults || 0} adults {guests?.children ? `· ${guests.children} children` : ''}</span>
                        </div>
                      </div>
                    </div>

                    {/* Form Fields - Enhanced */}
                    <div className="space-y-5">
                      {/* Name */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold flex items-center gap-2 text-foreground">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={bookingForm.name}
                          onChange={(e) => setBookingForm({ ...bookingForm, name: e.target.value })}
                          placeholder="John Doe"
                          className={`input-field w-full px-4 py-3.5 rounded-xl border-2 ${
                            formErrors.name
                              ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                              : 'border-border bg-background hover:border-primary/30'
                          } focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-200`}
                        />
                        {formErrors.name && (
                          <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                            <span className="inline-block w-1 h-1 bg-red-600 dark:bg-red-400 rounded-full"></span>
                            {formErrors.name}
                          </p>
                        )}
                      </div>

                      {/* Email */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold flex items-center gap-2 text-foreground">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Mail className="w-4 h-4 text-primary" />
                          </div>
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={bookingForm.email}
                          onChange={(e) => setBookingForm({ ...bookingForm, email: e.target.value })}
                          placeholder="john@example.com"
                          className={`input-field w-full px-4 py-3.5 rounded-xl border-2 ${
                            formErrors.email
                              ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                              : 'border-border bg-background hover:border-primary/30'
                          } focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-200`}
                        />
                        {formErrors.email && (
                          <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                            <span className="inline-block w-1 h-1 bg-red-600 dark:bg-red-400 rounded-full"></span>
                            {formErrors.email}
                          </p>
                        )}
                      </div>

                      {/* Phone */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold flex items-center gap-2 text-foreground">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Phone className="w-4 h-4 text-primary" />
                          </div>
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={bookingForm.phone}
                          onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })}
                          placeholder="+1 (555) 123-4567"
                          className={`input-field w-full px-4 py-3.5 rounded-xl border-2 ${
                            formErrors.phone
                              ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                              : 'border-border bg-background hover:border-primary/30'
                          } focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all duration-200`}
                        />
                        {formErrors.phone && (
                          <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                            <span className="inline-block w-1 h-1 bg-red-600 dark:bg-red-400 rounded-full"></span>
                            {formErrors.phone}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions - Enhanced */}
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={handleCloseModal}
                        className="flex-1 py-3.5 px-4 rounded-xl border-2 border-border hover:bg-muted hover:border-muted transition-all duration-200 font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmBooking}
                        className="booking-button flex-1 py-3.5 px-4 rounded-xl bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]"
                      >
                        Confirm Booking
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Booking Confirmation - Enhanced */
                <div className="p-8 space-y-6 text-center overflow-y-auto max-h-[95vh]">
                  {/* Success Animation */}
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl animate-pulse"></div>
                      <div className="success-checkmark relative rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 shadow-xl">
                        <Check className="w-14 h-14 text-white stroke-[3]" />
                      </div>
                    </div>
                  </div>

                  {/* Success Message */}
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
                      Booking Confirmed!
                    </h2>
                    <p className="text-muted-foreground">Your reservation has been successfully confirmed</p>
                  </div>

                  {/* Booking ID - Enhanced */}
                  <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 border-2 border-primary/30">
                    <div className="absolute top-0 left-0 w-24 h-24 bg-primary/20 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2"></div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Booking Reference</p>
                    <p className="text-3xl font-bold font-mono tracking-wider text-primary">{bookingId}</p>
                  </div>

                  {/* Booking Details - Enhanced */}
                  <div className="space-y-4 text-left p-5 rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 border-2 border-border/50">
                    <div className="flex justify-between items-start pb-4 border-b-2 border-border/50">
                      <div>
                        <p className="font-bold text-lg">{selectedBooking.room.roomName}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{selectedBooking.pricing.useOnlyForDisplayRatePlanName}</p>
                      </div>
                      <p className="font-bold text-2xl text-primary">{selectedBooking.room.currency} {selectedBooking.pricing.totalPriceForEntireStay.toFixed(0)}</p>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between py-2">
                        <span className="text-muted-foreground font-medium">Guest Name</span>
                        <span className="font-semibold">{bookingForm.name}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-muted-foreground font-medium">Email</span>
                        <span className="font-semibold truncate ml-4">{bookingForm.email}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-muted-foreground font-medium">Phone</span>
                        <span className="font-semibold">{bookingForm.phone}</span>
                      </div>
                      <div className="h-px bg-border/50 my-2"></div>
                      <div className="flex justify-between py-2">
                        <span className="text-muted-foreground font-medium">Check-in</span>
                        <span className="font-semibold">{formatDate(checkIn)}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-muted-foreground font-medium">Check-out</span>
                        <span className="font-semibold">{formatDate(checkOut)}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-muted-foreground font-medium">Guests</span>
                        <span className="font-semibold">{guests?.adults || 0} adults{guests?.children ? `, ${guests.children} children` : ''}</span>
                      </div>
                    </div>
                  </div>

                  {/* Confirmation Note - Enhanced */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/40 dark:to-blue-950/20 border-2 border-blue-200 dark:border-blue-900/50">
                    <div className="flex items-start gap-3">
                      <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-blue-900 dark:text-blue-300 text-left">
                        A confirmation email has been sent to <span className="font-bold">{bookingForm.email}</span>
                      </p>
                    </div>
                  </div>

                  {/* Close Button - Enhanced */}
                  <button
                    onClick={handleCloseModal}
                    className="booking-button w-full py-4 px-6 rounded-xl bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-bold shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
