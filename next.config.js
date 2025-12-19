const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '3072mb', // 3GB
    },
    // Required to allow large body sizes to pass through middleware
    // See https://nextjs.org/docs/app/api-reference/config/next-config-js/middlewareClientMaxBodySize
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'], 
    middlewareClientMaxBodySize: '3072mb',
  },
};

module.exports = withPWA(nextConfig);
