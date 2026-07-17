export const serverApiUrl =
  process.env.INTERNAL_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://nimto-4pop.onrender.com"
    : "http://localhost:4000");

export const publicApiUrl =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://nimto-4pop.onrender.com"
    : "http://localhost:4000");
