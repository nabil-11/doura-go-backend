"use client";

import {
  CircleCheckIcon,
  CirclePauseIcon,
  CircleXIcon,
  EllipsisIcon,
  EyeIcon,
  PencilIcon,
  RotateCcwIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useDictionary, useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { availableActions, type DriverAction, type DriverStatus } from "@/lib/domain/driver";

import { DriverActionDialog, type DriverDialogAction } from "./driver-action-dialog";

export const actionIcons: Record<DriverAction, LucideIcon> = {
  approve: CircleCheckIcon,
  reject: CircleXIcon,
  suspend: CirclePauseIcon,
  reactivate: RotateCcwIcon,
  reopen: RotateCcwIcon,
};

export function DriverRowActions({
  driver,
  permissions,
}: {
  driver: { id: string; name: string; status: DriverStatus };
  permissions: { manage: boolean; review: boolean; remove: boolean };
}) {
  const dict = useDictionary();
  const locale = useLocale();
  const [dialog, setDialog] = useState<DriverDialogAction | null>(null);
  const actions = permissions.review ? availableActions(driver.status) : [];
  const base = `/${locale}/admin/drivers/${driver.id}`;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`${dict.common.actions} — ${driver.name}`}>
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuItem asChild>
            <Link href={base}>
              <EyeIcon />
              {dict.admin.drivers.actions.view}
            </Link>
          </DropdownMenuItem>
          {permissions.manage ? (
            <DropdownMenuItem asChild>
              <Link href={`${base}/edit`}>
                <PencilIcon />
                {dict.admin.drivers.actions.edit}
              </Link>
            </DropdownMenuItem>
          ) : null}
          {actions.length ? <DropdownMenuSeparator /> : null}
          {actions.map((action) => {
            const Icon = actionIcons[action];
            return (
              <DropdownMenuItem
                key={action}
                variant={action === "reject" || action === "suspend" ? "destructive" : "default"}
                onSelect={() => setDialog(action)}
              >
                <Icon />
                {dict.admin.drivers.actions[action]}
              </DropdownMenuItem>
            );
          })}
          {permissions.remove ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
                <Trash2Icon />
                {dict.admin.drivers.actions.delete}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <DriverActionDialog driver={driver} action={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
