/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      'firebasestorage.googleapis.com',
      // add any other domains you use for images
    ],
  },
}

module.exports = nextConfig 