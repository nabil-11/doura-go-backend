"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useDictionary } from "@/components/i18n/locale-provider";
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
import { Spinner } from "@/components/ui/spinner";
import { resolveMessage, type ActionState } from "@/lib/validation/common";

/** Confirmation dialog that runs a server action with a loader and reports the result. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  successMessage,
  destructive = false,
  run,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  successMessage: string;
  destructive?: boolean;
  run: () => Promise<ActionState<unknown>>;
}) {
  const dict = useDictionary();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  function confirm() {
    startTransition(async () => {
      const result = await run();
      if (result.status === "success") {
        toast.success(successMessage);
        setError(undefined);
        onOpenChange(false);
      } else if (result.status === "error") {
        setError(resolveMessage(dict, result.error) ?? dict.errors.generic);
      }
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) setError(undefined);
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <FormAlert message={error} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{dict.common.cancel}</AlertDialogCancel>
          <Button variant={destructive ? "destructive" : "default"} onClick={confirm} disabled={pending} aria-busy={pending}>
            {pending ? <Spinner aria-hidden="true" /> : null}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
