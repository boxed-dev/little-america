// UCP Checkout Sessions - Complete endpoint
// POST /ucp/v1/checkout-sessions/[id]/complete

import { NextRequest } from "next/server";
import { checkoutService, UCPCheckoutError } from "@/lib/ucp/checkout.service";
import type { CompleteCheckoutRequest } from "@/lib/ucp/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: CompleteCheckoutRequest = await request.json();

    if (!body.idempotency_key) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "idempotency_key is required",
          },
        },
        { status: 400 }
      );
    }

    const result = await checkoutService.complete(id, body);

    return Response.json(result, {
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
          : error.code === "PAYMENT_FAILED"
          ? 402
          : error.code === "IDEMPOTENCY_CONFLICT"
          ? 409
          : 500;
      return Response.json({ error: error.toJSON() }, { status: statusCode });
    }

    console.error("Checkout complete error:", error);
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
