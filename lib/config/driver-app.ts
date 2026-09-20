import { statSync } from "node:fs";
import { join } from "node:path";

/**
 * The Android builds offered for download.
 *
 * Android has no equivalent of the App Store for a product this young: people
 * install the file directly. Both apps live in `public/downloads/`, so Vercel
 * serves them from the CDN and a page only needs to describe them.
 *
 * The size and date are read while the page is being built, where the file is
 * on disk — a serverless function would not find it there.
 */

const FILES = {
  driver: "doura-go-driver.apk",
  rider: "doura-go-rider.apk",
} as const;

export type AppId = keyof typeof FILES;

export const DRIVER_APK_PATH = apkPath("driver");
export const RIDER_APK_PATH = apkPath("rider");

/** Shown next to the button, and bumped in each app's package.json. */
export const DRIVER_APP_VERSION = "0.1.0";
export const RIDER_APP_VERSION = "0.1.0";

/** The oldest Android the Capacitor shell supports. */
export const DRIVER_APP_MIN_ANDROID = "6.0";
export const RIDER_APP_MIN_ANDROID = "6.0";

export type ApkInfo = { available: boolean; bytes: number; updatedAt: Date | null };

export function apkPath(app: AppId) {
  return `/downloads/${FILES[app]}`;
}

export function apkInfo(app: AppId): ApkInfo {
  try {
    const info = statSync(join(process.cwd(), "public", "downloads", FILES[app]));
    return { available: true, bytes: info.size, updatedAt: info.mtime };
  } catch {
    // No build has been dropped in yet: the page says so rather than offering
    // a link that 404s.
    return { available: false, bytes: 0, updatedAt: null };
  }
}

export function driverApkInfo(): ApkInfo {
  return apkInfo("driver");
}

export function riderApkInfo(): ApkInfo {
  return apkInfo("rider");
}

export function formatBytes(bytes: number) {
  return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
}
