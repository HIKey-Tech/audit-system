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
  // The Systems audit module was merged into System/IT. Keep old links working.
  async redirects() {
    return [
      { source: '/audit/domains/systems', destination: '/audit/domains/it', permanent: false },
    ];
  },
};

module.exports = nextConfig;