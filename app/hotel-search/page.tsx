"use client";

import { useWidgetProps, useMaxHeight, useDisplayMode } from "../hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const query = toolOutput?.query || "";
  const hotels = toolOutput?.hotels || [];
  const count = toolOutput?.count || 0;
  
  // Check if data has loaded
  const isLoading = !toolOutput || toolOutput.count === undefined;

  return (
    <>
      <style jsx>{`
        .horizontal-scroll::-webkit-scrollbar {
          height: 8px;
        }
        .horizontal-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .horizontal-scroll::-webkit-scrollbar-thumb {
          background: rgb(226 232 240);
          border-radius: 4px;
        }
        .horizontal-scroll::-webkit-scrollbar-thumb:hover {
          background: rgb(203 213 225);
        }
      `}</style>
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
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {query ? `Hotels in ${query.split(' in ')[1] || query}` : "Hotel Search"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Searching..." : count > 0 ? `${count} properties found` : "No properties found"}
          </p>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="animate-spin h-12 w-12 text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Searching for hotels...</p>
          </div>
        ) : hotels.length > 0 ? (
          <div
            className="horizontal-scroll overflow-x-auto overflow-y-visible pb-4 -mx-6 px-6"
            style={{
              scrollBehavior: 'smooth',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgb(226 232 240) transparent'
            }}
          >
            <div className="flex gap-4 w-max">
              {hotels.map((hotel) => (
                <Card
                  key={hotel.hotel_id}
                  className="group relative hover:shadow-md transition-all duration-200 w-96 shrink-0 flex flex-col overflow-hidden"
                >
                  {hotel.HotelImages && hotel.HotelImages.length > 0 && (
                    <div className="relative aspect-video w-full overflow-hidden bg-muted">
                      <img
                        src={hotel.HotelImages[0].cdnImageUrl}
                        alt={hotel.hotel_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <CardTitle className="leading-tight group-hover:text-primary transition-colors">
                        {hotel.hotel_name}
                      </CardTitle>
                      <div className="flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 shrink-0">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        <span className="text-sm font-medium text-amber-700 dark:text-amber-500">
                          {hotel.rating}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Location */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{hotel.location.city}, {hotel.location.state}</span>
                    </div>

                    {/* Amenities */}
                    {hotel.amenities_text && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {hotel.amenities_text}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Hotel className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-1">No hotels found</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              We couldn&apos;t find any hotels matching your search. Try adjusting your filters or search term.
            </p>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
