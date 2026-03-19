// UCP Checkout Sessions - Get and Update endpoints
// GET /ucp/v1/checkout-sessions/[id]
// PUT /ucp/v1/checkout-sessions/[id]

import { NextRequest } from "next/server";
import { checkoutService, UCPCheckoutError } from "@/lib/ucp/checkout.service";
import type { UpdateCheckoutRequest } from "@/lib/ucp/types";

const DEFAULT_CHAIN_ID = "1";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const checkout = await checkoutService.get(id);

    return Response.json(checkout, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    if (error instanceof UCPCheckoutError) {
      const statusCode = error.code === "NOT_FOUND" ? 404 : 500;
      return Response.json({ error: error.toJSON() }, { status: statusCode });
    }

    console.error("Checkout get error:", error);
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const chainId = request.nextUrl.searchParams.get("chainId") || DEFAULT_CHAIN_ID;
    const body: UpdateCheckoutRequest = await request.json();

    const checkout = await checkoutService.update(id, body, chainId);

    return Response.json(checkout, {
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
          : error.code === "INVALID_STATE"
          ? 409
          : error.code === "MERCHANDISE_NOT_AVAILABLE"
          ? 409
          : 500;
      return Response.json({ error: error.toJSON() }, { status: statusCode });
    }

    console.error("Checkout update error:", error);
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
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
