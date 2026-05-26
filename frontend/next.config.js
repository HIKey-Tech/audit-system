/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  experimental: {
    typedRoutes: false,
  },
};

module.exports = nextConfig;