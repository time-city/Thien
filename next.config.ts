import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ['192.168.110.166', '192.168.1.109', '192.168.1.144', '192.168.1.213'],
  turbopack: {
    root: "/Users/admin/Documents/Thien",
  },
  async headers() {
    return [
      {
        // Cho phép tất cả origin (CORS)
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/zalobot/:path*",
        destination: `${process.env.NEXT_PUBLIC_ZALO_BOT_URL || 'http://116.118.9.61:8080'}/:path*`
      }
    ];
  },
};

export default nextConfig;