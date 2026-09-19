import type { Metadata, Viewport } from "next";
import { Alexandria } from "next/font/google";
import { notFound } from "next/navigation";

import "../globals.css";

import { Providers } from "@/components/providers";
import { siteConfig } from "@/lib/config/site";
import { getDirection, hasLocale, localeMeta, locales } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";

// One family for Latin and Arabic keeps the brand consistent across languages.
const fontSans = Alexandria({
  subsets: ["latin", "arabic"],
  variable: "--font-sans",
  display: "swap",
});

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);

  return {
    metadataBase: new URL(siteConfig.url),
    title: { default: dict.meta.siteTitle, template: `%s · ${siteConfig.name}` },
    description: dict.meta.siteDescription,
    applicationName: siteConfig.name,
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      locale: localeMeta[lang].og,
      title: dict.meta.siteTitle,
      description: dict.meta.siteDescription,
    },
    twitter: { card: "summary_large_image" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF9F5" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1115" },
  ],
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dir = getDirection(lang);

  return (
    <html lang={lang} dir={dir} className={fontSans.variable} suppressHydrationWarning>
      <body className="min-h-svh">
        <Providers locale={lang} dir={dir}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
