import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-brand px-4 py-2 font-semibold text-asphalt focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {dict.common.skipToContent}
      </a>
      <SiteHeader dict={dict} locale={locale} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter dict={dict} locale={locale} />
    </div>
  );
}
