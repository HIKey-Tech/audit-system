/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Docker builds set NEXT_OUTPUT=standalone (see frontend/Dockerfile);
  // local dev/start keep the default output.
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  experimental: {
    typedRoutes: false,
  },
};

module.exports = nextConfig;