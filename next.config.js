/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Versioned alias: /api/v1/* is served by the same handlers as /api/*
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: '/api/:path*' }]
  },
}

module.exports = nextConfig
