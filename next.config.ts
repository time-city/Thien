import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ['192.168.110.24', '172.16.60.165', '192.168.110.172', '172.16.58.61', '172.16.60.153'],
  turbopack: {
    root: "/Users/admin/Documents/Thien",
  },
};

export default nextConfig;