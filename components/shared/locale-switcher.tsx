"use client";

import { CheckIcon, LanguagesIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { localeMeta, locales, switchLocalePath } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({
  label,
  tone = "auto",
  className,
}: {
  label: string;
  tone?: "auto" | "light";
  className?: string;
}) {
  const locale = useLocale();
  const pathname = usePathname();
  const dir = localeMeta[locale].dir;

  return (
    <DropdownMenu dir={dir}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={label}
          className={cn(
            "gap-1.5 font-medium",
            tone === "light" && "text-white/80 hover:bg-white/10 hover:text-white aria-expanded:bg-white/10 aria-expanded:text-white",
            className,
          )}
        >
          <LanguagesIcon />
          <span>{localeMeta[locale].short}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {locales.map((item) => (
          <DropdownMenuItem key={item} asChild>
            <Link
              href={switchLocalePath(pathname, item)}
              hrefLang={item}
              lang={item}
              className="justify-between"
            >
              <span>{localeMeta[item].label}</span>
              {item === locale ? <CheckIcon className="text-foreground" /> : null}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
