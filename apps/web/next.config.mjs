/** @type {import('next').NextConfig} */
const nextConfig = {
  // @scout/core ships TypeScript source — let Next compile it.
  transpilePackages: ["@scout/core"],
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
