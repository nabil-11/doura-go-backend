import {
  BanIcon,
  CircleCheckIcon,
  CirclePauseIcon,
  CircleXIcon,
  ClockIcon,
  HourglassIcon,
  MotorbikeIcon,
  NavigationIcon,
  UserCheckIcon,
  type LucideIcon,
} from "lucide-react";

import type { DriverAvailability, DriverStatus } from "@/lib/domain/driver";
import type { RideStatus, RiderStatus } from "@/lib/domain/ride";
import { cn } from "@/lib/utils";

// Status colours carry fixed meaning and always come with an icon and a label,
// so the state never depends on colour alone.
const tones = {
  good: "bg-status-good/12 text-[#0a6b0a] dark:bg-status-good/20 dark:text-[#8ae68a]",
  warning: "bg-status-warning/20 text-[#7a5000] dark:bg-status-warning/15 dark:text-[#ffd27a]",
  serious: "bg-status-serious/16 text-[#9a3c14] dark:bg-status-serious/18 dark:text-[#ffb393]",
  critical: "bg-status-critical/12 text-[#a82424] dark:bg-status-critical/22 dark:text-[#ffa3a3]",
  info: "bg-[#2a78d6]/12 text-[#1c5cab] dark:bg-[#3987e5]/20 dark:text-[#9ec5f4]",
  neutral: "bg-muted text-muted-foreground",
} as const;

export type StatusTone = keyof typeof tones;

export function StatusBadge({
  tone,
  icon: Icon,
  children,
  className,
}: {
  tone: StatusTone;
  icon: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full ps-1.5 pe-2 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {children}
    </span>
  );
}

export const driverStatusStyle: Record<DriverStatus, { tone: StatusTone; icon: LucideIcon; color: string }> = {
  active: { tone: "good", icon: CircleCheckIcon, color: "var(--color-status-good)" },
  pending: { tone: "warning", icon: HourglassIcon, color: "var(--color-status-warning)" },
  suspended: { tone: "serious", icon: CirclePauseIcon, color: "var(--color-status-serious)" },
  rejected: { tone: "critical", icon: CircleXIcon, color: "var(--color-status-critical)" },
};

export function DriverStatusBadge({ status, label }: { status: DriverStatus; label: string }) {
  const style = driverStatusStyle[status];
  return (
    <StatusBadge tone={style.tone} icon={style.icon}>
      {label}
    </StatusBadge>
  );
}

const rideStyle: Record<RideStatus, { tone: StatusTone; icon: LucideIcon }> = {
  requested: { tone: "neutral", icon: ClockIcon },
  accepted: { tone: "info", icon: UserCheckIcon },
  arriving: { tone: "info", icon: MotorbikeIcon },
  in_progress: { tone: "info", icon: NavigationIcon },
  completed: { tone: "good", icon: CircleCheckIcon },
  cancelled: { tone: "critical", icon: CircleXIcon },
};

export function RideStatusBadge({ status, label }: { status: RideStatus; label: string }) {
  const style = rideStyle[status];
  return (
    <StatusBadge tone={style.tone} icon={style.icon}>
      {label}
    </StatusBadge>
  );
}

export function RiderStatusBadge({ status, label }: { status: RiderStatus; label: string }) {
  return status === "active" ? (
    <StatusBadge tone="good" icon={CircleCheckIcon}>
      {label}
    </StatusBadge>
  ) : (
    <StatusBadge tone="critical" icon={BanIcon}>
      {label}
    </StatusBadge>
  );
}

const availabilityDot: Record<DriverAvailability, string> = {
  online: "bg-status-good",
  on_trip: "bg-[#2a78d6]",
  offline: "bg-muted-foreground/40",
};

export function AvailabilityIndicator({ availability, label }: { availability: DriverAvailability; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <span className={cn("size-2 rounded-full", availabilityDot[availability])} aria-hidden="true" />
      {label}
    </span>
  );
}
