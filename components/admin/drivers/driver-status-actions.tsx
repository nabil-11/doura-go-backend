"use client";

import { EllipsisIcon, PencilIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useDictionary, useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { availableActions, type DriverStatus } from "@/lib/domain/driver";

import { DriverActionDialog, type DriverDialogAction } from "./driver-action-dialog";
import { actionIcons } from "./driver-row-actions";

/** Primary actions on the driver page: the allowed status changes, edit and delete. */
export function DriverStatusActions({
  driver,
  checklistReady,
  permissions,
}: {
  driver: { id: string; name: string; status: DriverStatus };
  checklistReady: boolean;
  permissions: { manage: boolean; review: boolean; remove: boolean };
}) {
  const dict = useDictionary();
  const locale = useLocale();
  const [dialog, setDialog] = useState<DriverDialogAction | null>(null);
  const actions = permissions.review ? availableActions(driver.status) : [];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((action) => {
        const Icon = actionIcons[action];
        const needsChecklist = action === "approve" || action === "reactivate";
        const blocked = needsChecklist && !checklistReady;
        const button = (
          <Button
            key={action}
            variant={action === "approve" || action === "reactivate" ? "default" : action === "reopen" ? "outline" : "destructive"}
            disabled={blocked}
            onClick={() => setDialog(action)}
          >
            <Icon />
            {dict.admin.drivers.actions[action]}
          </Button>
        );
        return blocked ? (
          <Tooltip key={action}>
            <TooltipTrigger asChild>
              <span tabIndex={0}>{button}</span>
            </TooltipTrigger>
            <TooltipContent>{dict.admin.drivers.detail.checklist.notReady}</TooltipContent>
          </Tooltip>
        ) : (
          button
        );
      })}
      {permissions.manage ? (
        <Button asChild variant="outline">
          <Link href={`/${locale}/admin/drivers/${driver.id}/edit`}>
            <PencilIcon />
            {dict.admin.drivers.actions.edit}
          </Link>
        </Button>
      ) : null}
      {permissions.remove ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={dict.common.actions}>
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" onSelect={() => setDialog("delete")}>
              <Trash2Icon />
              {dict.admin.drivers.actions.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <DriverActionDialog driver={driver} action={dialog} onClose={() => setDialog(null)} redirectOnDelete />
    </div>
  );
}
