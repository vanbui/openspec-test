import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright starts the local app on its required loopback origin. Next's
  // development resource guard otherwise prevents the interactive islands
  // from hydrating during browser evidence collection.
  allowedDevOrigins: ["127.0.0.1"],
  // Development chrome is test-runner noise, not product UI evidence.
  devIndicators: false,
};

export default nextConfig;
