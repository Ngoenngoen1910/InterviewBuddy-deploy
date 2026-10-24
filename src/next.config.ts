import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components (and partialPrefetching, which depends on it) is turned off
  // for now: with it on, every page that reads the Supabase session cookie must
  // sit inside <Suspense>, otherwise the build fails. We can enable it later.
  cacheComponents: false,
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
