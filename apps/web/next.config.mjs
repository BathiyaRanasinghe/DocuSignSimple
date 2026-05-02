import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Tell Next.js file tracer the monorepo root so it bundles deps correctly in standalone mode
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  webpack: (config) => {
    // Suppress canvas module in Node environment (required by react-pdf)
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
