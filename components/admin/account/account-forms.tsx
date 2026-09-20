"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useDictionary } from "@/components/i18n/locale-provider";
import { FormAlert, SubmitButton, TextField, focusFirstInvalid, useFormAction } from "@/components/shared/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { changePasswordAction, updateProfileAction } from "@/lib/actions/backoffice";
import { idleState, resolveMessage, type ActionState } from "@/lib/validation/common";

export function ProfileForm({ name, email, roleLabel }: { name: string; email: string; roleLabel: string }) {
  const dict = useDictionary();
  const t = dict.admin.account;
  const formRef = useRef<HTMLFormElement>(null);
  const { state, pending, onSubmit } = useFormAction<ActionState>(updateProfileAction, idleState);

  useEffect(() => {
    if (state.status === "success") toast.success(t.profileSaved);
    else if (state.status === "error") focusFirstInvalid(formRef.current);
  }, [state, t.profileSaved]);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <Card>
      <form ref={formRef} onSubmit={onSubmit} noValidate className="contents">
        <CardHeader>
          <CardTitle>{t.profile}</CardTitle>
          <CardDescription>{t.profileHint}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormAlert message={state.status === "error" && state.error ? resolveMessage(dict, state.error) : undefined} className="sm:col-span-2" />
          <TextField name="name" label={t.name} defaultValue={name} required error={resolveMessage(dict, fieldErrors?.name)} fieldClassName="sm:col-span-2" />
          <TextField label={t.email} value={email} readOnly disabled dir="ltr" className="text-start rtl:text-end" />
          <TextField label={t.role} value={roleLabel} readOnly disabled />
        </CardContent>
        <CardFooter className="justify-end">
          <SubmitButton pending={pending} pendingLabel={dict.common.saving}>
            {t.saveProfile}
          </SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}

export function PasswordForm() {
  const dict = useDictionary();
  const t = dict.admin.account;
  const formRef = useRef<HTMLFormElement>(null);
  const { state, pending, onSubmit } = useFormAction<ActionState>(changePasswordAction, idleState);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      toast.success(t.passwordSaved);
    } else if (state.status === "error") {
      focusFirstInvalid(formRef.current);
    }
  }, [state, t.passwordSaved]);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const error = (name: string) => resolveMessage(dict, fieldErrors?.[name]);

  return (
    <Card>
      <form ref={formRef} onSubmit={onSubmit} noValidate className="contents">
        <CardHeader>
          <CardTitle>{t.password}</CardTitle>
          <CardDescription>{t.passwordHint}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormAlert message={state.status === "error" && state.error ? resolveMessage(dict, state.error) : undefined} className="sm:col-span-2" />
          <TextField
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            dir="ltr"
            label={t.currentPassword}
            required
            error={error("currentPassword")}
            fieldClassName="sm:col-span-2"
            className="text-start rtl:text-end"
          />
          <TextField
            name="newPassword"
            type="password"
            autoComplete="new-password"
            dir="ltr"
            label={t.newPassword}
            hint={dict.validation.passwordTooShort}
            required
            error={error("newPassword")}
            className="text-start rtl:text-end"
          />
          <TextField
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            dir="ltr"
            label={t.confirmPassword}
            required
            error={error("confirmPassword")}
            className="text-start rtl:text-end"
          />
        </CardContent>
        <CardFooter className="justify-end">
          <SubmitButton pending={pending} pendingLabel={dict.common.saving}>
            {t.savePassword}
          </SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
