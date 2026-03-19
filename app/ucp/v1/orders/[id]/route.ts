// UCP Orders - Get order endpoint
// GET /ucp/v1/orders/[id]

import { NextRequest } from "next/server";
import { orderService, UCPOrderError } from "@/lib/ucp/order.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const order = await orderService.get(id);

    return Response.json(order, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    if (error instanceof UCPOrderError) {
      const statusCode = error.code === "NOT_FOUND" ? 404 : 500;
      return Response.json({ error: error.toJSON() }, { status: statusCode });
    }

    console.error("Order get error:", error);
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
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
