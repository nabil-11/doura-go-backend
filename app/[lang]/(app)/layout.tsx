import { SiteHeader } from "@/components/site/site-header";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";

/**
 * The frame for the two apps that run in the browser: booking a ride, and
 * driving.
 *
 * The same header as the rest of the site, and deliberately nothing else. A
 * screen that is a map from edge to edge has no page to scroll — putting the
 * marketing footer under it only invents one, and the reward for scrolling
 * past a live ride is a list of links about helmets.
 *
 * The window is divided here, once: the header takes its `h-16` and the app
 * gets exactly what is left. That is the `calc(100svh-4rem)` the map screens
 * size themselves to, so the two agree by construction.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-brand px-4 py-2 font-semibold text-asphalt focus:not-sr-only focus:fixed focus:start-4 focus:top-4"
      >
        {dict.common.skipToContent}
      </a>
      <SiteHeader dict={dict} locale={locale} />
      <main id="main" className="min-h-0 flex-1">
        {children}
      </main>
    </div>
  );
}
