import { cn } from "@/lib/utils";

/**
 * Doura Go mark: a forward-leaning "D" whose round counter reads as a wheel
 * hub, with speed lines — a moto on the move. Taxi yellow + asphalt.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={cn("size-8 shrink-0", className)}
    >
      {title ? <title>{title}</title> : null}
      <rect width="48" height="48" rx="13" fill="#FFC800" />
      <g transform="translate(7 0) skewX(-10)">
        <path d="M17 12h9.5a12 12 0 0 1 0 24H17z" fill="#0F1115" />
        <circle cx="26.5" cy="24" r="4.4" fill="#FFC800" />
        <path
          d="M7.5 18.5h5M4 24h8.5M7.5 29.5h5"
          stroke="#0F1115"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

type LogoProps = {
  className?: string;
  markClassName?: string;
  /** "light" wordmark for dark backgrounds */
  tone?: "auto" | "light";
  /** Small label shown after the wordmark, e.g. "Backoffice" */
  suffix?: string;
};

export function Logo({ className, markClassName, tone = "auto", suffix }: LogoProps) {
  return (
    <span
      dir="ltr"
      className={cn("inline-flex items-center gap-2.5", className)}
    >
      <LogoMark className={markClassName} />
      <span
        className={cn(
          "flex items-baseline gap-1 font-heading text-lg leading-none font-extrabold tracking-tight",
          tone === "light" ? "text-white" : "text-foreground",
        )}
      >
        doura
        <span className="rounded-md bg-brand px-1.5 py-0.5 text-[0.8em] leading-none font-black text-asphalt">
          go
        </span>
      </span>
      {suffix ? (
        <span
          className={cn(
            "ms-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase",
            tone === "light" ? "border-white/15 text-white/70" : "border-border text-muted-foreground",
          )}
        >
          {suffix}
        </span>
      ) : null}
    </span>
  );
}
