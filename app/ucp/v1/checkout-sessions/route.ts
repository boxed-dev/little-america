// UCP Checkout Sessions - Create endpoint
// POST /ucp/v1/checkout-sessions

import { NextRequest } from "next/server";
import { checkoutService, UCPCheckoutError } from "@/lib/ucp/checkout.service";
import type { CreateCheckoutRequest } from "@/lib/ucp/types";

const DEFAULT_CHAIN_ID = "1";

export async function POST(request: NextRequest) {
  try {
    const chainId = request.nextUrl.searchParams.get("chainId") || DEFAULT_CHAIN_ID;
    const body: CreateCheckoutRequest = await request.json();

    const checkout = await checkoutService.create(body, chainId);

    return Response.json(checkout, {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    if (error instanceof UCPCheckoutError) {
      const statusCode =
        error.code === "NOT_FOUND"
          ? 404
          : error.code === "VALIDATION_ERROR"
          ? 400
          : error.code === "MERCHANDISE_NOT_AVAILABLE"
          ? 409
          : error.code === "INVALID_STATE"
          ? 409
          : 500;

      return Response.json({ error: error.toJSON() }, { status: statusCode });
    }

    console.error("Checkout create error:", error);
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
