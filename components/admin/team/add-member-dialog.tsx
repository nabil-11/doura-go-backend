"use client";

import { RefreshCwIcon, UserPlusIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useDictionary } from "@/components/i18n/locale-provider";
import { FieldShell, FormAlert, SubmitButton, TextField, focusFirstInvalid, useFormAction } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createAdminAction } from "@/lib/actions/backoffice";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { idleState, resolveMessage, type ActionState } from "@/lib/validation/common";

/** Readable, strong temporary password (no ambiguous characters). */
function generatePassword() {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = letters + digits;
  const bytes = crypto.getRandomValues(new Uint32Array(14));
  const chars = Array.from(bytes, (value) => all[value % all.length]);
  chars[3] = digits[bytes[3] % digits.length];
  chars[9] = letters[bytes[9] % letters.length];
  return chars.join("");
}

export function AddMemberDialog() {
  const dict = useDictionary();
  const t = dict.admin.team;
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setRound((value) => value + 1);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlusIcon />
          {t.add}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.form.title}</DialogTitle>
          <DialogDescription>{t.form.description}</DialogDescription>
        </DialogHeader>
        <MemberForm key={round} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function MemberForm({ onDone }: { onDone: () => void }) {
  const dict = useDictionary();
  const t = dict.admin.team;
  const formRef = useRef<HTMLFormElement>(null);
  const { state, pending, onSubmit } = useFormAction<ActionState>(createAdminAction, idleState);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (state.status === "success") {
      toast.success(t.toasts.added);
      onDone();
    } else if (state.status === "error") {
      focusFirstInvalid(formRef.current);
    }
  }, [state, onDone, t.toasts.added]);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const error = (name: string) => resolveMessage(dict, fieldErrors?.[name]);
  const formError = state.status === "error" && state.error ? resolveMessage(dict, state.error) : undefined;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={formError} />
      <TextField name="name" label={t.form.name} required autoComplete="off" error={error("name")} />
      <TextField name="email" type="email" dir="ltr" label={t.form.email} required autoComplete="off" error={error("email")} className="text-start rtl:text-end" />
      <FieldShell label={t.form.role} error={error("role")}>
        {(control) => (
          <Select name="role" defaultValue="operations">
            <SelectTrigger {...control} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {ADMIN_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  <span className="grid">
                    <span>{dict.admin.roles[role]}</span>
                    <span className="text-xs text-muted-foreground">{dict.admin.roleDescriptions[role]}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FieldShell>
      <FieldShell label={t.form.password} error={error("password")}>
        {(control) => (
          <InputGroup>
            <InputGroupInput
              {...control}
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              dir="ltr"
              autoComplete="new-password"
              className="font-mono text-start rtl:text-end"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton onClick={() => setPassword(generatePassword())}>
                <RefreshCwIcon />
                {t.form.generate}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        )}
      </FieldShell>
      <DialogFooter>
        <SubmitButton pending={pending} pendingLabel={dict.common.saving}>
          {t.form.submit}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}
