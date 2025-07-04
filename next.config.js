const { i18n } = require('./next-i18next.config')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  i18n,
  images: {
    domains: [
      'firebasestorage.googleapis.com',
      // add any other domains you use for images
    ],
  },
}

module.exports = nextConfig 