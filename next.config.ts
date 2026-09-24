import type { NextConfig } from "next";

// NEXT_PUBLIC_STATIC_EXPORT=1 builds plain static files for GitHub Pages
// (see .github/workflows/deploy-pages.yml). There is no server in that mode, so
// only .tsx files count as routes: the .ts API routes are left out and the app
// calls Claude and the other services straight from the phone instead.
const isStatic = process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: { unoptimized: true },
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  ...(isStatic && { output: "export", trailingSlash: true, pageExtensions: ["tsx"] }),
};

export default nextConfig;
