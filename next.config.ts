import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Electron: dev mode loads localhost, prod via Hermes Gateway
  images: { unoptimized: true },
};

export default nextConfig;
