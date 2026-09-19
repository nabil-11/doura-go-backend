import { CheckIcon, ShieldCheckIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/admin/login-form";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/shared/locale-switcher";
import { getCurrentAdmin } from "@/lib/auth/dal";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.admin.login.title, robots: { index: false, follow: false } };
}

async function isSignedIn() {
  try {
    return !!(await getCurrentAdmin());
  } catch {
    // Database unreachable: show the form; signing in will explain the problem.
    return false;
  }
}

export default async function LoginPage({ searchParams }: PageProps<"/[lang]/admin/login">) {
  const [dict, locale, query] = await Promise.all([getDictionary(), getLocale(), searchParams]);
  if (await isSignedIn()) redirect(`/${locale}/admin`);

  const next = typeof query.next === "string" ? query.next : undefined;
  const t = dict.admin.login;

  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative isolate hidden flex-col justify-between overflow-hidden bg-asphalt p-10 text-white lg:flex xl:p-14">
        <div className="bg-road-grid absolute inset-0 -z-10 opacity-70" aria-hidden="true" />
        <div className="absolute -bottom-40 -start-24 -z-10 size-[520px] rounded-full bg-brand/25 blur-[120px]" aria-hidden="true" />
        <Link href={`/${locale}`} className="w-fit">
          <Logo tone="light" suffix={dict.admin.brand} />
        </Link>
        <div className="max-w-md">
          <h2 className="text-4xl leading-tight font-bold tracking-tight">{t.panelTitle}</h2>
          <p className="mt-4 text-base leading-relaxed text-white/65">{t.panelSubtitle}</p>
          <ul className="mt-8 space-y-3">
            {t.panelPoints.map((point) => (
              <li key={point} className="flex items-center gap-3 text-sm text-white/80">
                <span className="grid size-5 place-items-center rounded-full bg-brand text-asphalt">
                  <CheckIcon className="size-3" aria-hidden="true" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="flex items-center gap-2 text-xs text-white/45">
          <ShieldCheckIcon className="size-4" aria-hidden="true" />
          {t.footer}
        </p>
      </aside>

      <main className="flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6">
          <Link href={`/${locale}`} className="lg:invisible">
            <Logo />
          </Link>
          <LocaleSwitcher label={dict.common.language} />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-16 sm:px-6">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{t.subtitle}</p>
            <div className="mt-8">
              <LoginForm
                locale={locale}
                next={next}
                copy={t}
                messages={{ validation: dict.validation, errors: dict.errors }}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
