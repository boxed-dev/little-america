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

                    {/* Pricing Options */}
                    <div className="space-y-3 pt-3 border-t mt-auto">
                      {room.pricing.slice(0, 3).map((price, idx) => {
                        const discount = calculateDiscount(price.originalPriceBeforeDiscount, price.totalPriceForEntireStay);
                        return (
                          <div
                            key={idx}
                            className="space-y-2"
                          >
                            <div className="pricing-option relative flex items-center justify-between p-3 rounded-lg bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50">
                              {discount > 0 && (
                                <div className="absolute -top-2 -right-2 flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 shadow-sm">
                                  <Tag className="w-3 h-3 text-white" />
                                  <span className="text-xs font-bold text-white">{discount}% OFF</span>
                                </div>
                              )}
                              <div className="space-y-1 pr-4">
                                <p className="text-sm font-semibold leading-tight">
                                  {price.useOnlyForDisplayRatePlanName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {room.currency} {price.roomPricePerNight.toFixed(0)} × {room.nights || 1} {room.nights === 1 ? 'night' : 'nights'}
                                </p>
                              </div>
                              <div className="text-right space-y-0.5">
                                <p className="text-xl font-bold">
                                  {room.currency} {price.totalPriceForEntireStay.toFixed(0)}
                                </p>
                                {price.originalPriceBeforeDiscount > price.totalPriceForEntireStay && (
                                  <p className="text-xs text-muted-foreground line-through">
                                    {room.currency} {price.originalPriceBeforeDiscount.toFixed(0)}
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleBookNow(room, price)}
                              className="booking-button w-full py-2.5 px-4 rounded-lg bg-primary text-primary-foreground font-semibold text-sm shadow-md hover:shadow-lg"
                            >
                              Book Now
                            </button>
                          </div>
                        );
                      })}
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

        {/* Booking Modal */}
        {showBookingForm && selectedBooking && (
          <div className="modal-backdrop fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="modal-content bg-background rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border">
              {!bookingConfirmed ? (
                /* Booking Form */
                <div className="p-6 space-y-6">
                  {/* Header */}
                  <div className="flex items-start justify-between pb-4 border-b">
                    <div className="space-y-1">
                      <h2 className="text-2xl font-bold">Complete Your Booking</h2>
                      <p className="text-sm text-muted-foreground">Just a few details to confirm your stay</p>
                    </div>
                    <button
                      onClick={handleCloseModal}
                      className="rounded-full p-2 hover:bg-muted transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Selected Room Summary */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border space-y-3">
                    <h3 className="font-semibold text-lg">{selectedBooking.room.roomName}</h3>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{selectedBooking.pricing.useOnlyForDisplayRatePlanName}</span>
                      <span className="font-bold text-lg">{selectedBooking.room.currency} {selectedBooking.pricing.totalPriceForEntireStay.toFixed(0)}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2 border-t">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDate(checkIn)} - {formatDate(checkOut)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        <span>{guests?.adults || 0} adults</span>
                      </div>
                    </div>
                  </div>

                  {/* Form Fields */}
                  <div className="space-y-4">
                    {/* Name */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <User className="w-4 h-4 text-primary" />
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={bookingForm.name}
                        onChange={(e) => setBookingForm({ ...bookingForm, name: e.target.value })}
                        placeholder="John Doe"
                        className={`input-field w-full px-4 py-3 rounded-lg border ${formErrors.name ? 'border-red-500' : 'border-border'} bg-background focus:outline-none focus:ring-2 focus:ring-primary/50`}
                      />
                      {formErrors.name && <p className="text-xs text-red-500">{formErrors.name}</p>}
                    </div>

                    {/* Email */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Mail className="w-4 h-4 text-primary" />
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={bookingForm.email}
                        onChange={(e) => setBookingForm({ ...bookingForm, email: e.target.value })}
                        placeholder="john@example.com"
                        className={`input-field w-full px-4 py-3 rounded-lg border ${formErrors.email ? 'border-red-500' : 'border-border'} bg-background focus:outline-none focus:ring-2 focus:ring-primary/50`}
                      />
                      {formErrors.email && <p className="text-xs text-red-500">{formErrors.email}</p>}
                    </div>

                    {/* Phone */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-2">
                        <Phone className="w-4 h-4 text-primary" />
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={bookingForm.phone}
                        onChange={(e) => setBookingForm({ ...bookingForm, phone: e.target.value })}
                        placeholder="+1 (555) 123-4567"
                        className={`input-field w-full px-4 py-3 rounded-lg border ${formErrors.phone ? 'border-red-500' : 'border-border'} bg-background focus:outline-none focus:ring-2 focus:ring-primary/50`}
                      />
                      {formErrors.phone && <p className="text-xs text-red-500">{formErrors.phone}</p>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleCloseModal}
                      className="flex-1 py-3 px-4 rounded-lg border border-border hover:bg-muted transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmBooking}
                      className="booking-button flex-1 py-3 px-4 rounded-lg bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg"
                    >
                      Confirm Booking
                    </button>
                  </div>
                </div>
              ) : (
                /* Booking Confirmation */
                <div className="p-8 space-y-6 text-center">
                  {/* Success Icon */}
                  <div className="flex justify-center">
                    <div className="success-checkmark rounded-full bg-emerald-500 p-4 shadow-lg">
                      <Check className="w-12 h-12 text-white stroke-[3]" />
                    </div>
                  </div>

                  {/* Success Message */}
                  <div className="space-y-2">
                    <h2 className="text-3xl font-bold">Booking Confirmed!</h2>
                    <p className="text-muted-foreground">Your reservation has been successfully confirmed</p>
                  </div>

                  {/* Booking ID */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20">
                    <p className="text-sm text-muted-foreground mb-1">Booking ID</p>
                    <p className="text-2xl font-bold font-mono tracking-wider">{bookingId}</p>
                  </div>

                  {/* Booking Details */}
                  <div className="space-y-3 text-left p-4 rounded-xl bg-muted/30 border">
                    <div className="flex justify-between items-start pb-3 border-b">
                      <div>
                        <p className="font-semibold text-lg">{selectedBooking.room.roomName}</p>
                        <p className="text-sm text-muted-foreground">{selectedBooking.pricing.useOnlyForDisplayRatePlanName}</p>
                      </div>
                      <p className="font-bold text-xl">{selectedBooking.room.currency} {selectedBooking.pricing.totalPriceForEntireStay.toFixed(0)}</p>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Guest Name</span>
                        <span className="font-medium">{bookingForm.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Email</span>
                        <span className="font-medium">{bookingForm.email}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phone</span>
                        <span className="font-medium">{bookingForm.phone}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-muted-foreground">Check-in</span>
                        <span className="font-medium">{formatDate(checkIn)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Check-out</span>
                        <span className="font-medium">{formatDate(checkOut)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Guests</span>
                        <span className="font-medium">{guests?.adults || 0} adults, {guests?.children || 0} children</span>
                      </div>
                    </div>
                  </div>

                  {/* Confirmation Note */}
                  <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900">
                    <p className="text-sm text-blue-900 dark:text-blue-300">
                      A confirmation email has been sent to <span className="font-semibold">{bookingForm.email}</span>
                    </p>
                  </div>

                  {/* Close Button */}
                  <button
                    onClick={handleCloseModal}
                    className="booking-button w-full py-3 px-4 rounded-lg bg-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg"
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
