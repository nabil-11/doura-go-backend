import { NotFoundView } from "@/components/shared/not-found-view";
import { getDictionary, getLocale } from "@/lib/i18n/get-dictionary";

export default async function NotFound() {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <NotFoundView
      title={dict.notFound.title}
      description={dict.notFound.description}
      cta={dict.notFound.cta}
      href={`/${locale}`}
    />
  );
}
