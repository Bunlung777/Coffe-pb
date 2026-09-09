import type { NextConfig } from "next";
import { BASE_PATH } from "./lib/basePath";

const nextConfig: NextConfig = {
  /**
   * Served under a sub-path of the main site (see lib/basePath.ts).
   * Apache reverse-proxies /coffee-cost-report to this app's Node server
   * WITHOUT stripping the prefix, so the app owns the full path.
   */
  basePath: BASE_PATH,
};

export default nextConfig;
