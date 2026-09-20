import { statSync } from "node:fs";
import { join } from "node:path";

/**
 * The driver app build offered for download.
 *
 * Android has no equivalent of the App Store for a product this young: drivers
 * install the file directly. It lives in `public/downloads/`, so Vercel serves
 * it from the CDN and the page below only needs to describe it.
 *
 * The size and date are read while the page is being built, where the file is
 * on disk — a serverless function would not find it there.
 */

export const DRIVER_APK_PATH = "/downloads/doura-go-driver.apk";

/** Shown next to the button, and bumped in the driver app's package.json. */
export const DRIVER_APP_VERSION = "0.1.0";

/** The oldest Android the Capacitor shell supports. */
export const DRIVER_APP_MIN_ANDROID = "6.0";

export type ApkInfo = { available: boolean; bytes: number; updatedAt: Date | null };

export function driverApkInfo(): ApkInfo {
  try {
    const info = statSync(join(process.cwd(), "public", "downloads", "doura-go-driver.apk"));
    return { available: true, bytes: info.size, updatedAt: info.mtime };
  } catch {
    // No build has been dropped in yet: the page says so rather than offering
    // a link that 404s.
    return { available: false, bytes: 0, updatedAt: null };
  }
}

export function formatBytes(bytes: number) {
  return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
}
