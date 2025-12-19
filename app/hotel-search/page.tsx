"use client";

import { useWidgetProps, useMaxHeight, useDisplayMode } from "../hooks";
import { MapPin, Loader2, Hotel } from "lucide-react";

interface Hotel {
  hotel_id: number;
  hotel_name: string;
  rating: number;
  location: {
    address: string;
    city: string;
    state: string;
  };
  amenities_text: string;
  search_score: number;
  HotelImages?: { cdnImageUrl: string }[];
}

interface HotelSearchData extends Record<string, unknown> {
  query?: string;
  hotels?: Hotel[];
  count?: number;
  chainName?: string;
}

export default function HotelSearchPage() {
  const toolOutput = useWidgetProps<HotelSearchData>();
  const maxHeight = useMaxHeight() ?? undefined;
  const displayMode = useDisplayMode();

  const hotels = toolOutput?.hotels || [];
  const chainName = toolOutput?.chainName || "Hotels";

  const isLoading = !toolOutput || toolOutput.count === undefined;

  return (
    <div
      className="min-h-full bg-background"
      style={{
        maxHeight,
        height: displayMode === "fullscreen" ? maxHeight : undefined,
        overflow: "auto"
      }}
    >
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="space-y-0.5">
          <h1 className="text-lg font-semibold text-foreground tracking-tight">
            {isLoading ? "Searching..." : chainName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Finding available hotels..." : `${hotels.length} hotel${hotels.length !== 1 ? 's' : ''} found`}
          </p>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="animate-spin h-6 w-6 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground mt-3">Searching for hotels...</p>
          </div>
        ) : hotels.length > 0 ? (
          <div
            className="overflow-x-auto pb-2 -mx-5 px-5"
            style={{
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <div className="flex gap-3 w-max">
              {hotels.map((hotel) => (
                <div
                  key={hotel.hotel_id}
                  className="w-72 shrink-0 rounded-2xl bg-surface overflow-hidden shadow-sm"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  {/* Image */}
                  {hotel.HotelImages && hotel.HotelImages.length > 0 ? (
                    <div className="relative w-full h-44">
                      <img
                        src={hotel.HotelImages[0].cdnImageUrl}
                        alt={hotel.hotel_name}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="relative w-full h-44 bg-muted/50 flex items-center justify-center">
                      <Hotel className="w-8 h-8 text-muted-foreground/40" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-3.5 space-y-2">
                    <h2 className="font-medium text-foreground text-[15px] leading-snug line-clamp-2">
                      {hotel.hotel_name}
                    </h2>

                    <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="line-clamp-1">{hotel.location.city}, {hotel.location.state}</span>
                    </div>

                    {hotel.amenities_text && (
                      <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
                        {hotel.amenities_text}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted/50 p-4 mb-3">
              <Hotel className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <h3 className="font-medium text-foreground mb-1">No hotels found</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              We couldn&apos;t find any hotels matching your search. Try adjusting your query.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
