/**
 * The app is mounted under a sub-path on the main site
 * (https://www.cpr-one.com/coffee-cost-report), alongside the other
 * sub-apps served from that vhost.
 *
 * Next.js rewrites its own URLs (pages, /_next assets, Link hrefs) from the
 * `basePath` in next.config.ts, but it does NOT touch URLs we build by hand.
 * So every hand-written absolute URL — fetch() calls and <a href> download
 * links to /api/* — must go through `apiUrl()` or it will hit the main site
 * root instead of this app and 404.
 *
 * next.config.ts imports BASE_PATH from here so there is a single source of
 * truth. To move the app, change this one line and rebuild.
 */
export const BASE_PATH = "/coffee-cost-report";

/** Prefix an app-absolute path (e.g. "/api/export") with the base path. */
export function apiUrl(path: string): string {
  return `${BASE_PATH}${path}`;
}
