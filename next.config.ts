import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Eber is almost entirely per-user, request-time UI (bookings, sessions, payments),
  // so we use classic dynamic rendering instead of Cache Components.
  cacheComponents: false,
  serverExternalPackages: ["@electric-sql/pglite", "pg", "sharp"],
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
