import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** KPI tile: label, one number, and an optional context line. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  highlight = false,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  href?: string;
  highlight?: boolean;
}) {
  const content = (
    <Card
      className={cn(
        "relative h-full gap-3 px-5 py-5 transition-shadow",
        href && "hover:shadow-md",
        highlight && "bg-asphalt text-white ring-transparent dark:bg-asphalt-2",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-sm font-medium", highlight ? "text-white/70" : "text-muted-foreground")}>{label}</p>
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg",
            highlight ? "bg-brand text-asphalt" : "bg-muted text-foreground",
          )}
        >
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
      </div>
      <p className="text-3xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className={cn("text-xs", highlight ? "text-white/60" : "text-muted-foreground")}>{hint}</p> : null}
    </Card>
  );

  return href ? (
    <Link href={href} className="rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      {content}
    </Link>
  ) : (
    content
  );
}
