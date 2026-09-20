import {
  BanIcon,
  BanknoteIcon,
  CircleCheckIcon,
  CirclePauseIcon,
  CircleXIcon,
  InboxIcon,
  KeyRoundIcon,
  RotateCcwIcon,
  ShieldUserIcon,
  SquarePenIcon,
  StickyNoteIcon,
  TagsIcon,
  Trash2Icon,
  UploadIcon,
  UserCheckIcon,
  UserPlusIcon,
  type LucideIcon,
} from "lucide-react";

import type { ActivityAction } from "@/lib/db/models/activity";
import { DOCUMENT_KINDS, type DocumentKind } from "@/lib/domain/driver";
import { isAdminRole } from "@/lib/auth/roles";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { formatDateTime, formatRelative, interpolate } from "@/lib/i18n/format";
import type { ActivityItem } from "@/lib/services/activity";
import { cn } from "@/lib/utils";

const icons: Record<ActivityAction, { icon: LucideIcon; tone: string }> = {
  "driver.applied": { icon: InboxIcon, tone: "bg-brand/20 text-brand-deep dark:text-brand" },
  "driver.created": { icon: UserPlusIcon, tone: "bg-muted text-foreground" },
  "driver.updated": { icon: SquarePenIcon, tone: "bg-muted text-foreground" },
  "driver.approved": { icon: CircleCheckIcon, tone: "bg-status-good/15 text-[#0a6b0a] dark:text-[#8ae68a]" },
  "driver.rejected": { icon: CircleXIcon, tone: "bg-status-critical/12 text-[#a82424] dark:text-[#ffa3a3]" },
  "driver.suspended": { icon: CirclePauseIcon, tone: "bg-status-serious/16 text-[#9a3c14] dark:text-[#ffb393]" },
  "driver.reactivated": { icon: RotateCcwIcon, tone: "bg-status-good/15 text-[#0a6b0a] dark:text-[#8ae68a]" },
  "driver.reopened": { icon: RotateCcwIcon, tone: "bg-muted text-foreground" },
  "driver.deleted": { icon: Trash2Icon, tone: "bg-status-critical/12 text-[#a82424] dark:text-[#ffa3a3]" },
  "driver.document_uploaded": { icon: UploadIcon, tone: "bg-muted text-foreground" },
  "driver.note_added": { icon: StickyNoteIcon, tone: "bg-muted text-foreground" },
  "driver.payment_recorded": { icon: BanknoteIcon, tone: "bg-status-good/15 text-[#0a6b0a] dark:text-[#8ae68a]" },
  "rider.blocked": { icon: BanIcon, tone: "bg-status-critical/12 text-[#a82424] dark:text-[#ffa3a3]" },
  "rider.unblocked": { icon: UserCheckIcon, tone: "bg-muted text-foreground" },
  "pricing.updated": { icon: TagsIcon, tone: "bg-muted text-foreground" },
  "admin.created": { icon: ShieldUserIcon, tone: "bg-muted text-foreground" },
  "admin.role_changed": { icon: ShieldUserIcon, tone: "bg-muted text-foreground" },
  "admin.disabled": { icon: BanIcon, tone: "bg-muted text-foreground" },
  "admin.enabled": { icon: UserCheckIcon, tone: "bg-muted text-foreground" },
  "admin.password_changed": { icon: KeyRoundIcon, tone: "bg-muted text-foreground" },
};

/** Extra line under an entry: a reason, a note, the document type or the new role. */
function detailFor(item: ActivityItem, dict: Dictionary) {
  if (!item.message) return null;
  if (item.action === "driver.document_uploaded" && (DOCUMENT_KINDS as readonly string[]).includes(item.message)) {
    return { text: dict.admin.drivers.documents[item.message as DocumentKind], quote: false };
  }
  if (item.action === "admin.role_changed" && isAdminRole(item.message)) {
    return { text: dict.admin.roles[item.message], quote: false };
  }
  return { text: item.message, quote: true };
}

export function ActivityFeed({
  items,
  dict,
  locale,
  emptyText,
  now,
}: {
  items: ActivityItem[];
  dict: Dictionary;
  locale: Locale;
  emptyText: string;
  now: number;
}) {
  if (!items.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ol className="relative space-y-5 before:absolute before:inset-y-3 before:start-4 before:w-px before:bg-border">
      {items.map((item) => {
        const { icon: Icon, tone } = icons[item.action];
        const detail = detailFor(item, dict);
        const sentence = interpolate(dict.admin.activity[item.action], {
          actor: item.actorName ?? dict.admin.activity.system,
          subject: item.subjectLabel,
        });
        return (
          <li key={item.id} className="relative flex gap-3">
            <span className={cn("relative z-10 grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-card", tone)}>
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm leading-snug">{sentence}</p>
              {detail ? (
                <p
                  className={cn(
                    "mt-1.5 text-sm text-muted-foreground",
                    detail.quote && "rounded-md border-s-2 border-brand bg-muted/60 px-2.5 py-1.5",
                  )}
                >
                  {detail.text}
                </p>
              ) : null}
              <time
                dateTime={item.createdAt.toISOString()}
                title={formatDateTime(locale, item.createdAt)}
                className="mt-1 block text-xs text-muted-foreground"
              >
                {formatRelative(locale, item.createdAt, now)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
