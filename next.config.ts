import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/og/:username.png',
        destination: '/api/og/:username',
      },
    ]
  },
}

export default nextConfig
