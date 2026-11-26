import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // ffmpeg-static resolves its binary relative to its own folder, so keep it unbundled.
  serverExternalPackages: ["ffmpeg-static", "@electric-sql/pglite", "postgres"],
  partialPrefetching: true,
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
