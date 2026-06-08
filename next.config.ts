import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ['192.168.1.121'],
  turbopack: {
    root: "/Users/admin/Documents/Thien",
  },
};

export default nextConfig;