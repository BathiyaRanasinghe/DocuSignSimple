import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const isDocker = process.env.DOCKER_BUILD === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone + tracing root only needed for Docker; Vercel uses its own output strategy
  ...(isDocker && {
    output: 'standalone',
    experimental: {
      outputFileTracingRoot: path.join(__dirname, '../../'),
    },
  }),
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
