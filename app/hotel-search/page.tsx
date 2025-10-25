"use client";

import { useWidgetProps, useMaxHeight, useDisplayMode } from "../hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, MapPin, Loader2, Hotel, Sparkles } from "lucide-react";

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
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
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

        .skeleton {
          background: linear-gradient(90deg,
            rgb(241 245 249) 0%,
            rgb(248 250 252) 50%,
            rgb(241 245 249) 100%
          );
          background-size: 1000px 100%;
          animation: shimmer 2s infinite;
        }

        .dark .skeleton {
          background: linear-gradient(90deg,
            rgb(30 41 59) 0%,
            rgb(51 65 85) 50%,
            rgb(30 41 59) 100%
          );
          background-size: 1000px 100%;
        }

        .hotel-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .hotel-card:hover {
          transform: translateY(-4px);
        }

        .image-container {
          position: relative;
          overflow: hidden;
        }

        .image-container img {
          transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .hotel-card:hover .image-container img {
          transform: scale(1.05);
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
        <div className="space-y-2 fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700 dark:from-amber-400 dark:via-amber-300 dark:to-amber-400 bg-clip-text text-transparent">
              Little America Hotel
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Loading hotel details..." : "Luxury Accommodations in Downtown Salt Lake City"}
          </p>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 fade-in">
            <div className="relative">
              <Loader2 className="animate-spin h-16 w-16 text-primary/40" />
              <div className="absolute inset-0 blur-xl bg-primary/20 animate-pulse"></div>
            </div>
            <p className="text-sm text-muted-foreground mt-6 animate-pulse">Searching for hotels...</p>
          </div>
        ) : hotels.length > 0 ? (
          <div
            className="horizontal-scroll overflow-x-auto overflow-y-visible pb-6 -mx-6 px-6 fade-in"
            style={{
              scrollBehavior: 'smooth',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgb(203 213 225) transparent'
            }}
          >
            <div className="flex gap-5 w-max">
              {hotels.map((hotel, index) => (
                <Card
                  key={hotel.hotel_id}
                  className="hotel-card group relative hover:shadow-xl w-[360px] shrink-0 flex flex-col overflow-hidden border-0 bg-card/50 backdrop-blur-sm"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {hotel.HotelImages && hotel.HotelImages.length > 0 ? (
                    <div className="image-container relative w-full h-52 bg-gradient-to-br from-muted to-muted/50">
                      <img
                        src={hotel.HotelImages[0].cdnImageUrl}
                        alt={hotel.hotel_name}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </div>
                  ) : (
                    <div className="relative w-full h-52 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                      <Hotel className="w-12 h-12 text-muted-foreground/40" />
                    </div>
                  )}

                  <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm px-3 py-1.5 shadow-lg border border-amber-200/50 dark:border-amber-900/50">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                      {hotel.rating.toFixed(1)}
                    </span>
                  </div>

                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">
                      {hotel.hotel_name}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-3 pt-0">
                    {/* Location */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 shrink-0" />
                      <span className="line-clamp-1">{hotel.location.city}, {hotel.location.state}</span>
                    </div>

                    {/* Amenities */}
                    {hotel.amenities_text && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {hotel.amenities_text}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center fade-in">
            <div className="rounded-full bg-gradient-to-br from-muted to-muted/50 p-6 mb-6 shadow-inner">
              <Hotel className="w-12 h-12 text-muted-foreground/60" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No hotels found</h3>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
              We couldn&apos;t find any hotels matching your search. Try adjusting your query or exploring different locations.
            </p>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
