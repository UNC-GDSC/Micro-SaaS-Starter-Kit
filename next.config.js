/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
  turbopack: {
    root: __dirname,
  },
  output: 'standalone',
}

// Only wire up the Sentry webpack plugin when we have real credentials.
// Without SENTRY_AUTH_TOKEN the plugin cannot upload source maps and in some
// @sentry/nextjs v9 versions it will hard-fail the build even with silent:true.
// Runtime error tracking (sentry.client/server.config.ts) is unaffected.
if (process.env.SENTRY_AUTH_TOKEN) {
  const { withSentryConfig } = require('@sentry/nextjs')
  module.exports = withSentryConfig(nextConfig, {
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    widenClientFileUpload: true,
    tunnelRoute: '/monitoring',
    hideSourceMaps: true,
    disableLogger: true,
  })
} else {
  module.exports = nextConfig
}
