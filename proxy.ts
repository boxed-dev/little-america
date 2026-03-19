import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_ORIGINS = [
  "https://chatgpt.com",
  "https://web-sandbox.oaiusercontent.com",
  "https://web-sandbox.oaistatic.com",
  "https://mcp.hotelzify.com",
];

function getAllowedOrigin(request: NextRequest): string {
  const origin = request.headers.get("origin") || "";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  // Allow same-origin requests and dev
  if (process.env.NODE_ENV === "development") return origin || "*";
  return ALLOWED_ORIGINS[0];
}

export function proxy(request: NextRequest) {
  const origin = getAllowedOrigin(request);

  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,DELETE,OPTIONS"
    );
    response.headers.set("Access-Control-Allow-Headers", "*");
    return response;
  }
  return NextResponse.next({
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

export const config = {
  matcher: "/:path*",
};
