import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // @sift/core and @sift/db ship raw TypeScript source (no build step), so
  // Next must run its own compiler over them to resolve `.js`-suffixed
  // imports that actually point at `.ts` files.
  transpilePackages: ["@sift/core", "@sift/db"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
