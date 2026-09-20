import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/config/site";
import { locales } from "@/lib/i18n/config";

const PAGES = ["", "/drive"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap((page) =>
    locales.map((locale) => ({
      url: `${siteConfig.url}/${locale}${page}`,
      changeFrequency: "weekly" as const,
      priority: page === "" ? 1 : 0.8,
      alternates: {
        languages: Object.fromEntries(locales.map((other) => [other, `${siteConfig.url}/${other}${page}`])),
      },
    })),
  );
}
