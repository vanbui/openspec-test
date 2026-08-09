import type { NextConfig } from "next";
import path from "node:path";
import webpack from "webpack";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Playwright starts the local app on its required loopback origin. Next's
  // development resource guard otherwise prevents the interactive islands
  // from hydrating during browser evidence collection.
  allowedDevOrigins: ["127.0.0.1"],
  // Development chrome is test-runner noise, not product UI evidence.
  devIndicators: false,
  webpack: (config, { dev }) => {
    if (!dev) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /runtime-shell$/,
          path.join(process.cwd(), "src/components/shell/runtime-shell.production.tsx"),
        ),
        new webpack.NormalModuleReplacementPlugin(
          /analyst-only-evidence$/,
          path.join(process.cwd(), "src/components/test-evidence/analyst-only-evidence.production.tsx"),
        ),
        new webpack.NormalModuleReplacementPlugin(
          /state-evidence$/,
          path.join(process.cwd(), "src/components/test-evidence/state-evidence.production.tsx"),
        ),
      );
    }

    return config;
  },
};

export default nextConfig;
