"use client";

import { ThemeProvider } from "next-themes";

import { LocaleProvider } from "@/components/i18n/locale-provider";
import { DirectionProvider } from "@/components/ui/direction";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Locale } from "@/lib/i18n/config";

export function Providers({
  locale,
  dir,
  children,
}: {
  locale: Locale;
  dir: "ltr" | "rtl";
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <DirectionProvider dir={dir}>
        <LocaleProvider locale={locale}>
          <TooltipProvider delayDuration={250}>
            {children}
            <Toaster dir={dir} position={dir === "rtl" ? "bottom-left" : "bottom-right"} closeButton />
          </TooltipProvider>
        </LocaleProvider>
      </DirectionProvider>
    </ThemeProvider>
  );
}
