import { baseURL } from "@/baseUrl";
import type { UCPProfile } from "@/lib/ucp/types";

const UCP_VERSION = "2026-01-11";

interface ChainApiResponse {
  status: number;
  data: {
    chain: {
      id: number;
      name: string;
    };
    hotels: Array<{
      id: number;
      name: string;
      city: string;
      state: string;
      country: string;
    }>;
  };
}

async function getChainInfo(chainId: string): Promise<{ name: string; hotelCount: number }> {
  try {
    const res = await fetch(
      `https://api.hotelzify.com/hotel/v2/hotel/chain-hotels-lite-v2?chainId=${chainId}`
    );
    const data: ChainApiResponse = await res.json();
    return {
      name: data.data?.chain?.name || "Hotelzify",
      hotelCount: data.data?.hotels?.length || 0,
    };
  } catch {
    return { name: "Hotelzify", hotelCount: 0 };
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const chainId = url.searchParams.get("chainId") || "1";

  const chainInfo = await getChainInfo(chainId);

  const profile: UCPProfile = {
    ucp: {
      version: UCP_VERSION,
      profile_url: `${baseURL}/.well-known/ucp?chainId=${chainId}`,

      business: {
        name: chainInfo.name,
        description: `AI-powered hotel booking for ${chainInfo.name} with ${chainInfo.hotelCount} properties`,
        logo_url: `${baseURL}/logo.png`,
        support_email: "support@hotelzify.com",
        terms_url: "https://hotelzify.com/terms",
        privacy_url: "https://hotelzify.com/privacy",
      },

      services: {
        "dev.ucp.shopping": {
          version: UCP_VERSION,
          spec: "https://ucp.dev/specification/overview",
          rest: {
            endpoint: `${baseURL}/ucp/v1`,
            schema: "https://ucp.dev/schemas/shopping/rest.openapi.json",
          },
          mcp: {
            endpoint: `${baseURL}/ucp/mcp?chainId=${chainId}`,
            schema: "https://ucp.dev/schemas/shopping/mcp.openrpc.json",
          },
        },
        "com.hotelzify.hotels": {
          version: UCP_VERSION,
          spec: `${baseURL}/ucp/spec/hotels`,
          rest: {
            endpoint: `${baseURL}/ucp/v1/hotels`,
          },
          mcp: {
            endpoint: `${baseURL}/ucp/mcp?chainId=${chainId}`,
          },
        },
      },

      capabilities: [
        {
          name: "dev.ucp.shopping.checkout",
          version: UCP_VERSION,
          spec: "https://ucp.dev/specification/checkout",
          schema: "https://ucp.dev/schemas/shopping/checkout.json",
        },
        {
          name: "dev.ucp.shopping.order",
          version: UCP_VERSION,
          spec: "https://ucp.dev/specification/order",
          schema: "https://ucp.dev/schemas/shopping/order.json",
        },
        {
          name: "dev.ucp.shopping.checkout.fulfillment",
          version: UCP_VERSION,
          extends: "dev.ucp.shopping.checkout",
          spec: "https://ucp.dev/specification/fulfillment",
        },
        {
          name: "com.hotelzify.hotel_search",
          version: UCP_VERSION,
          spec: `${baseURL}/ucp/spec/hotel-search`,
          schema: `${baseURL}/ucp/schemas/hotel-search.json`,
        },
        {
          name: "com.hotelzify.room_availability",
          version: UCP_VERSION,
          spec: `${baseURL}/ucp/spec/room-availability`,
          schema: `${baseURL}/ucp/schemas/room-availability.json`,
        },
      ],

      payment_handlers: [
        {
          id: "hotelzify_redirect",
          type: "redirect",
          name: "Pay at Hotel / Online Payment",
          instruments: ["card", "upi", "netbanking", "wallet"],
          config: {
            provider: "hotelzify",
            supports_pay_at_hotel: true,
            supports_online_payment: true,
          },
        },
      ],
    },
  };

  return Response.json(profile, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
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
