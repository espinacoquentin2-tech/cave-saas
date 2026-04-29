import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    ALLOW_DATABASE_RESET: process.env.ALLOW_DATABASE_RESET,
  },
};

export default nextConfig;
