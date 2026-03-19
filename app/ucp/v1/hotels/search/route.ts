// UCP Hotels Search - REST endpoint
// POST /ucp/v1/hotels/search

import { NextRequest } from "next/server";
import { hotelzifyApi } from "@/lib/ucp/hotelzify-api";

const DEFAULT_CHAIN_ID = "1";

interface SearchRequest {
  query: string;
  limit?: number;
}

export async function POST(request: NextRequest) {
  try {
    const chainId = request.nextUrl.searchParams.get("chainId") || DEFAULT_CHAIN_ID;
    const body: SearchRequest = await request.json();

    if (!body.query) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "query is required" } },
        { status: 400 }
      );
    }

    const chainData = await hotelzifyApi.getChainHotels(chainId);
    const result = await hotelzifyApi.searchHotels(body.query, chainId, body.limit || 5);

    return Response.json(
      {
        query: body.query,
        chain_id: chainId,
        chain_name: chainData.chain.name,
        hotels: result.hotels,
        total: result.total,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Hotel search error:", error);
    return Response.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
