/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  trailingSlash: false,
  images: {
    unoptimized: true,
    domains: [
      'firebasestorage.googleapis.com',
      // add any other domains you use for images
    ],
  },
}

module.exports = nextConfig 