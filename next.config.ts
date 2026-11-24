import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Pictures rarely change, so keep them on the phone for a week.
        source: "/images/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }]
      },
      {
        source: "/:file(seven|bar-rum|cherries|orange).png",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }]
      }
    ];
  }
};

export default nextConfig;
