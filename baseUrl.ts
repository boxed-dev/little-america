
export const baseURL =
  process.env.NODE_ENV == "development"
    ? "http://localhost:3000"
    : `https://${process.env.VERCEL_URL || "mcp.hotelzify.com"}`;
