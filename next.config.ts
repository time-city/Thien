import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ['192.168.110.24'],
  turbopack: {
    root: "/Users/admin/Documents/Thien",
  },
};

export default nextConfig;