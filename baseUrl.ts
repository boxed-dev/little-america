export const baseURL =
  process.env.NODE_ENV == "development"
    ? "http://localhost:3000"
    : process.env.VERCEL_ENV === "production"
    ? "https://little-america.vercel.app"
    : "https://" + (process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL);
