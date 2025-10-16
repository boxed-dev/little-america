"use client";

import { useWidgetProps, useMaxHeight, useDisplayMode } from "../hooks";

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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-sm text-muted-foreground">Searching for hotels...</p>
          </div>
        ) : hotels.length > 0 ? (
          <div className="space-y-3">
            {hotels.map((hotel) => (
              <div
                key={hotel.hotel_id}
                className="group relative rounded-lg border bg-card p-5 hover:shadow-md transition-all duration-200"
              >
                <div className="space-y-3">
                  {/* Hotel Name & Rating */}
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-lg font-medium leading-tight group-hover:text-primary transition-colors">
                      {hotel.hotel_name}
                    </h2>
                    <div className="flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 shrink-0">
                      <svg className="w-3.5 h-3.5 fill-amber-500" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      <span className="text-sm font-medium text-amber-700 dark:text-amber-500">
                        {hotel.rating}
                      </span>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>{hotel.location.city}, {hotel.location.state}</span>
                  </div>

                  {/* Amenities */}
                  {hotel.amenities_text && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {hotel.amenities_text}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-1">No hotels found</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              We couldn&apos;t find any hotels matching your search. Try adjusting your filters or search term.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
