import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "*.replit.dev",
    "*.picard.replit.dev",
  ],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
