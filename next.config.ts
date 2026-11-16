import type { NextConfig } from "next";
const config: NextConfig = {
  allowedDevOrigins: ["100.119.174.10"],
  async redirects() {
    return ["hn", "dash", "dashboard"].flatMap((alias) => [
      { source: `/${alias}`, destination: "/-/learn", permanent: true },
      { source: `/${alias}/:path*`, destination: "/-/:path*", permanent: true },
    ]);
  },
  async rewrites() {
    return {
      beforeFiles:
        process.env.NODE_ENV === "development"
          ? [{ source: "/sw.js", destination: "/dev-sw.js" }]
          : [],
    };
  },
  async headers() {
    return [
      {
        source: "/-/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/api/v1/me/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      ...["content", "stats", "books", "export"].map((endpoint) => ({
        source: `/api/v1/${endpoint}`,
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      })),
    ];
  },
};
export default config;
