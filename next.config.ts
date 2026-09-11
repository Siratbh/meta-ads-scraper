import type { NextConfig } from "next";

const scraperWorkerUrl = process.env.SCRAPER_WORKER_URL?.replace(/\/+$/, '');

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.fbcdn.net' },
      { protocol: 'https', hostname: '**.facebook.com' },
      { protocol: 'https', hostname: 'scontent**.fna.fbcdn.net' },
    ],
  },
  serverExternalPackages: ['better-sqlite3', 'playwright', 'playwright-extra', 'puppeteer-extra-plugin-stealth'],
  // Hosted mode keeps Playwright and SQLite on a long-lived worker. Rewrites
  // preserve the existing same-origin browser API without duplicating it in
  // Vercel Functions.
  async rewrites() {
    if (!scraperWorkerUrl) return [];
    return {
      beforeFiles: [
        { source: '/api/:path*', destination: `${scraperWorkerUrl}/api/:path*` },
      ],
    };
  },
};

export default nextConfig;
