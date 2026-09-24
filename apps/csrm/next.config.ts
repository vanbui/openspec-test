import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '6mb',
    },
  },
  ...(process.env.CSRM_NEXT_DIST_DIR ? { distDir: process.env.CSRM_NEXT_DIST_DIR } : {}),
};
export default nextConfig;
