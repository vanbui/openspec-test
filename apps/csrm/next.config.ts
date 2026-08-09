import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright starts the local app on its required loopback origin. Next's
  // development resource guard otherwise prevents the interactive islands
  // from hydrating during browser evidence collection.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
