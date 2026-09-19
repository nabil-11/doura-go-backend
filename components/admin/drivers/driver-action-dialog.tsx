"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { useDictionary, useLocale } from "@/components/i18n/locale-provider";
import { FormAlert } from "@/components/shared/form";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { changeDriverStatusAction, deleteDriverAction } from "@/lib/actions/drivers";
import { DRIVER_ACTIONS, type DriverAction } from "@/lib/domain/driver";
import { interpolate } from "@/lib/i18n/format";
import { resolveMessage, type ActionState } from "@/lib/validation/common";

export type DriverDialogAction = DriverAction | "delete";

const TOAST_KEY = {
  approve: "approved",
  reject: "rejected",
  suspend: "suspended",
  reactivate: "reactivated",
  reopen: "reopened",
  delete: "deleted",
} as const;

/**
 * Confirmation for every status change (and deletion). Actions that need a
 * reason collect it here; the server re-checks the transition and checklist.
 */
export function DriverActionDialog({
  driver,
  action,
  onClose,
  redirectOnDelete = false,
}: {
  driver: { id: string; name: string };
  action: DriverDialogAction | null;
  onClose: () => void;
  redirectOnDelete?: boolean;
}) {
  const dict = useDictionary();
  const locale = useLocale();
  const router = useRouter();
  const reasonId = useId();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [result, setResult] = useState<ActionState<unknown> | null>(null);

  const t = dict.admin.drivers.dialogs;
  const needsReason = action !== null && action !== "delete" && DRIVER_ACTIONS[action].requiresReason;
  const destructive = action === "reject" || action === "suspend" || action === "delete";

  const copy: Record<DriverDialogAction, { title: string; description: string; confirm: string }> = {
    approve: { title: t.approveTitle, description: t.approveDescription, confirm: dict.admin.drivers.actions.approve },
    reject: { title: t.rejectTitle, description: t.rejectDescription, confirm: dict.admin.drivers.actions.reject },
    suspend: { title: t.suspendTitle, description: t.suspendDescription, confirm: dict.admin.drivers.actions.suspend },
    reactivate: {
      title: t.reactivateTitle,
      description: t.reactivateDescription,
      confirm: dict.admin.drivers.actions.reactivate,
    },
    reopen: { title: t.reopenTitle, description: t.reopenDescription, confirm: dict.admin.drivers.actions.reopen },
    delete: { title: t.deleteTitle, description: t.deleteDescription, confirm: dict.admin.drivers.actions.delete },
  };

  function close() {
    if (pending) return;
    setReason("");
    setResult(null);
    onClose();
  }

  function confirm() {
    if (!action) return;
    startTransition(async () => {
      const response =
        action === "delete"
          ? await deleteDriverAction(driver.id)
          : await changeDriverStatusAction(driver.id, action, reason.trim() || undefined);

      if (response.status === "success") {
        toast.success(dict.admin.drivers.toasts[TOAST_KEY[action]]);
        setReason("");
        setResult(null);
        onClose();
        if (action === "delete" && redirectOnDelete) router.push(`/${locale}/admin/drivers`);
      } else {
        setResult(response);
      }
    });
  }

  const errorState = result?.status === "error" ? result : null;
  const reasonError = resolveMessage(dict, errorState?.fieldErrors?.reason);
  const formError = errorState?.error ? resolveMessage(dict, errorState.error) : undefined;
  const text = action ? copy[action] : null;

  return (
    <AlertDialog open={action !== null} onOpenChange={(open) => !open && close()}>
      <AlertDialogContent>
        {text ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{interpolate(text.title, { name: driver.name })}</AlertDialogTitle>
              <AlertDialogDescription>{text.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <FormAlert message={formError} />
            {needsReason ? (
              <Field data-invalid={!!reasonError}>
                <FieldLabel htmlFor={reasonId}>{t.reasonLabel}</FieldLabel>
                <Textarea
                  id={reasonId}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={t.reasonPlaceholder}
                  maxLength={500}
                  rows={3}
                  aria-invalid={!!reasonError}
                  autoFocus
                />
                <FieldError>{reasonError}</FieldError>
              </Field>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>{dict.common.cancel}</AlertDialogCancel>
              <Button
                variant={destructive ? "destructive" : "default"}
                onClick={confirm}
                disabled={pending || (needsReason && reason.trim().length === 0)}
                aria-busy={pending}
              >
                {pending ? <Spinner aria-hidden="true" /> : null}
                {text.confirm}
              </Button>
            </AlertDialogFooter>
          </>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}
