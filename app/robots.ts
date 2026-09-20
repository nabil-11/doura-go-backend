import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/config/site";
import { locales } from "@/lib/i18n/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", ...locales.map((locale) => `/${locale}/admin`)],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
