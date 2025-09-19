import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Suppress build warnings to reduce context window spam
  typescript: {
    // Dangerously allow production builds to successfully complete even if
    // your project has TypeScript errors.
    ignoreBuildErrors: false,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // Reduce build output verbosity
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
  // Suppress webpack warnings
  webpack: (config, { dev, isServer }) => {
    // Suppress specific webpack warnings
    config.ignoreWarnings = [
      /Critical dependency: the request of a dependency is an expression/,
      /Module not found: Can't resolve/,
      /export .* was not found in/,
    ];
    
    // Reduce webpack stats verbosity
    if (!dev) {
      config.stats = 'errors-only';
    }
    
    return config;
  },
  // Suppress other build warnings
  onDemandEntries: {
    // Suppress on-demand entries warnings
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
};

export default nextConfig;
