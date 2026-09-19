"use client";

import { BanIcon, UserCheckIcon } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { useDictionary } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { setRiderBlockedAction } from "@/lib/actions/backoffice";
import type { RiderStatus } from "@/lib/domain/ride";
import { interpolate } from "@/lib/i18n/format";

export function RiderActions({ rider }: { rider: { id: string; name: string; status: RiderStatus } }) {
  const dict = useDictionary();
  const t = dict.admin.riders;
  const [open, setOpen] = useState(false);
  const blocking = rider.status === "active";

  return (
    <>
      <Button
        variant={blocking ? "ghost" : "outline"}
        size="sm"
        onClick={() => setOpen(true)}
        className={blocking ? "text-destructive hover:text-destructive" : undefined}
      >
        {blocking ? <BanIcon /> : <UserCheckIcon />}
        {blocking ? t.actions.block : t.actions.unblock}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        destructive={blocking}
        title={interpolate(blocking ? t.dialogs.blockTitle : t.dialogs.unblockTitle, { name: rider.name })}
        description={blocking ? t.dialogs.blockDescription : t.dialogs.unblockDescription}
        confirmLabel={blocking ? t.actions.block : t.actions.unblock}
        successMessage={blocking ? t.toasts.blocked : t.toasts.unblocked}
        run={() => setRiderBlockedAction(rider.id, blocking)}
      />
    </>
  );
}
