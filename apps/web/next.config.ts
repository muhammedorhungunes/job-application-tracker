import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@job-tracker/types"],
  experimental: {
    // CSV import uploads files of up to 1 MB through a server action; the default limit is 1 MB including overhead.
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
