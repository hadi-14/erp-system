import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "**.alicdn.com",
      },
      {
        protocol: "https",
        hostname: "**.alicdn.com",
      },
    ],
  },
};

export default nextConfig;
