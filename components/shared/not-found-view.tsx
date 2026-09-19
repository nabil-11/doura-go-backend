import { ArrowLeftIcon, SignpostIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function NotFoundView({
  title,
  description,
  cta,
  href,
}: {
  title: string;
  description: string;
  cta: string;
  href: string;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 py-20 text-center">
      <div className="relative">
        <span className="font-heading text-8xl font-black tracking-tighter text-foreground/10 select-none">404</span>
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand text-asphalt shadow-lg">
            <SignpostIcon className="size-7" aria-hidden="true" />
          </span>
        </span>
      </div>
      <h1 className="mt-6 text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-muted-foreground">{description}</p>
      <Button asChild className="mt-8">
        <Link href={href}>
          <ArrowLeftIcon className="rtl:rotate-180" />
          {cta}
        </Link>
      </Button>
    </div>
  );
}
