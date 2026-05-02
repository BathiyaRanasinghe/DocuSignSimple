/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  webpack: (config) => {
    // Suppress canvas module in Node environment (required by react-pdf)
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
