import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Recovery emails use this loopback host; Next dev otherwise blocks its HMR connection.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
