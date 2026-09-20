"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect } from "react";

import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n/config";

// Kept tiny on purpose: this boundary can render when nothing else loaded.
const copy: Record<Locale, { title: string; description: string; database: string; retry: string }> = {
  fr: {
    title: "Une erreur est survenue",
    description: "Un problème inattendu s'est produit. Vous pouvez réessayer.",
    database: "Impossible de joindre la base de données. Vérifiez MONGO_URL et la liste d'accès réseau.",
    retry: "Réessayer",
  },
  ar: {
    title: "حدث خطأ ما",
    description: "وقع خطأ غير متوقع. يمكنك المحاولة مرة أخرى.",
    database: "تعذّر الاتصال بقاعدة البيانات. تحقّق من MONGO_URL ومن قائمة الوصول إلى الشبكة.",
    retry: "إعادة المحاولة",
  },
  en: {
    title: "Something went wrong",
    description: "An unexpected error happened. You can try again.",
    database: "Can't reach the database. Check MONGO_URL and the network access list.",
    retry: "Try again",
  },
};

export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = useLocale();
  const t = copy[locale];

  useEffect(() => {
    console.error(error);
  }, [error]);

  const isDatabase = /Mongo|ECONNREFUSED|querySrv|Server selection/i.test(`${error.name} ${error.message}`);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-brand text-asphalt">
        <TriangleAlertIcon className="size-7" aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <p className="max-w-md text-muted-foreground">{isDatabase ? t.database : t.description}</p>
      <Button onClick={reset}>
        <RotateCcwIcon />
        {t.retry}
      </Button>
      {error.digest ? <p className="font-mono text-xs text-muted-foreground">{error.digest}</p> : null}
    </div>
  );
}
