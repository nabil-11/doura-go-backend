"use client";

import { ArrowRightIcon, MenuIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { localeMeta } from "@/lib/i18n/config";

type Item = { href: string; label: string };

export function MobileNav({
  items,
  cta,
  labels,
}: {
  items: Item[];
  cta: Item;
  labels: { open: string; title: string };
}) {
  const [open, setOpen] = useState(false);
  const dir = localeMeta[useLocale()].dir;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-white/80 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label={labels.open}
        >
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent
        side={dir === "rtl" ? "left" : "right"}
        dir={dir}
        className="w-80 border-white/10 bg-asphalt text-white"
      >
        <SheetHeader>
          <SheetTitle className="sr-only">{labels.title}</SheetTitle>
          <Logo tone="light" />
        </SheetHeader>
        <nav className="flex flex-col gap-1 px-4" aria-label={labels.title}>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-3 text-base font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto p-4">
          <Button asChild className="h-11 w-full text-base font-semibold">
            <Link href={cta.href} onClick={() => setOpen(false)}>
              {cta.label}
              <ArrowRightIcon className="rtl:rotate-180" />
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
