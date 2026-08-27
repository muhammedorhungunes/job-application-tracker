import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@job-tracker/types"],
};

export default nextConfig;
