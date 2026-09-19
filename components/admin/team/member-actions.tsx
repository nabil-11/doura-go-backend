"use client";

import { BanIcon, EllipsisIcon, ShieldUserIcon, UserCheckIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useDictionary } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { changeAdminRoleAction, setAdminActiveAction } from "@/lib/actions/backoffice";
import { ADMIN_ROLES, type AdminRole } from "@/lib/auth/roles";
import { interpolate } from "@/lib/i18n/format";
import { resolveMessage } from "@/lib/validation/common";

export function MemberActions({ member }: { member: { id: string; name: string; role: AdminRole; isActive: boolean } }) {
  const dict = useDictionary();
  const t = dict.admin.team;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [changingRole, startRoleChange] = useTransition();

  function changeRole(role: string) {
    if (role === member.role) return;
    startRoleChange(async () => {
      const result = await changeAdminRoleAction(member.id, role);
      if (result.status === "success") toast.success(t.toasts.roleChanged);
      else if (result.status === "error") toast.error(resolveMessage(dict, result.error) ?? dict.errors.generic);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`${dict.common.actions} — ${member.name}`} disabled={changingRole}>
            {changingRole ? <Spinner /> : <EllipsisIcon />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ShieldUserIcon />
              {t.actions.changeRole}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value={member.role} onValueChange={changeRole}>
                {ADMIN_ROLES.map((role) => (
                  <DropdownMenuRadioItem key={role} value={role}>
                    {dict.admin.roles[role]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant={member.isActive ? "destructive" : "default"} onSelect={() => setConfirmOpen(true)}>
            {member.isActive ? <BanIcon /> : <UserCheckIcon />}
            {member.isActive ? t.actions.disable : t.actions.enable}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        destructive={member.isActive}
        title={interpolate(member.isActive ? t.dialogs.disableTitle : t.dialogs.enableTitle, { name: member.name })}
        description={member.isActive ? t.dialogs.disableDescription : t.dialogs.enableDescription}
        confirmLabel={member.isActive ? t.actions.disable : t.actions.enable}
        successMessage={member.isActive ? t.toasts.disabled : t.toasts.enabled}
        run={() => setAdminActiveAction(member.id, !member.isActive)}
      />
    </>
  );
}
