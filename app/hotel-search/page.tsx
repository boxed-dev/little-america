"use client";

import { useWidgetProps, useMaxHeight, useDisplayMode } from "../hooks";
import { Badge } from "@openai/apps-sdk-ui/components/Badge";
import { Star, MapPin, Loader2, Hotel } from "lucide-react";

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
}

export default function HotelSearchPage() {
  const toolOutput = useWidgetProps<HotelSearchData>();
  const maxHeight = useMaxHeight() ?? undefined;
  const displayMode = useDisplayMode();

  const hotels = toolOutput?.hotels || [];

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
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">
            {isLoading ? "Searching..." : "Little America Hotel"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Finding available hotels..." : "Luxury Accommodations in Downtown Salt Lake City"}
          </p>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-4">Searching for hotels...</p>
          </div>
        ) : hotels.length > 0 ? (
          <div
            className="overflow-x-auto pb-4 -mx-4 px-4"
            style={{
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <div className="flex gap-4 w-max">
              {hotels.map((hotel) => (
                <div
                  key={hotel.hotel_id}
                  className="w-80 shrink-0 rounded-xl border border-border bg-surface overflow-hidden"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  {/* Image */}
                  {hotel.HotelImages && hotel.HotelImages.length > 0 ? (
                    <div className="relative w-full h-48 bg-muted">
                      <img
                        src={hotel.HotelImages[0].cdnImageUrl}
                        alt={`Exterior view of ${hotel.hotel_name} showing the main building and entrance in ${hotel.location.city}, ${hotel.location.state}`}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                      {/* Rating Badge */}
                      <div className="absolute top-3 right-3">
                        <Badge variant="soft" className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-current text-yellow-500" />
                          <span>{hotel.rating.toFixed(1)}</span>
                        </Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-full h-48 bg-muted flex items-center justify-center">
                      <Hotel className="w-10 h-10 text-muted-foreground" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-4 space-y-3">
                    <h2 className="font-semibold text-foreground leading-tight line-clamp-2">
                      {hotel.hotel_name}
                    </h2>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 shrink-0" />
                      <span className="line-clamp-1">{hotel.location.city}, {hotel.location.state}</span>
                    </div>

                    {hotel.amenities_text && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
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
            <div className="rounded-full bg-muted p-4 mb-4">
              <Hotel className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">No hotels found</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              We couldn&apos;t find any hotels matching your search. Try adjusting your query.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
