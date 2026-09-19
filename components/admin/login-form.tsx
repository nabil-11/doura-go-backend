"use client";

import { EyeIcon, EyeOffIcon, LockKeyholeIcon, MailIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { FieldShell, FormAlert, SubmitButton, focusFirstInvalid, useFormAction } from "@/components/shared/form";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { loginAction } from "@/lib/actions/auth";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { idleState, resolveMessage, type ActionState } from "@/lib/validation/common";

type Props = {
  locale: Locale;
  next?: string;
  copy: Dictionary["admin"]["login"];
  messages: Pick<Dictionary, "validation" | "errors">;
};

export function LoginForm({ locale, next, copy, messages }: Props) {
  const { state, pending, onSubmit } = useFormAction<ActionState>(loginAction, idleState);
  const [showPassword, setShowPassword] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "error") focusFirstInvalid(formRef.current);
  }, [state]);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const formError = state.status === "error" && state.error ? resolveMessage(messages, state.error) : undefined;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-5">
      <input type="hidden" name="locale" value={locale} />
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <FormAlert message={formError} />

      <FieldShell label={copy.email} error={resolveMessage(messages, fieldErrors?.email)}>
        {(control) => (
          <InputGroup className="h-10">
            <InputGroupAddon>
              <MailIcon aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              {...control}
              name="email"
              type="email"
              autoComplete="username"
              dir="ltr"
              required
              autoFocus
              className="text-start rtl:text-end"
            />
          </InputGroup>
        )}
      </FieldShell>

      <FieldShell label={copy.password} error={resolveMessage(messages, fieldErrors?.password)}>
        {(control) => (
          <InputGroup className="h-10">
            <InputGroupAddon>
              <LockKeyholeIcon aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              {...control}
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              dir="ltr"
              required
              className="text-start rtl:text-end"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        )}
      </FieldShell>

      <SubmitButton pending={pending} pendingLabel={copy.submitting} className="h-10 w-full text-sm font-semibold">
        {copy.submit}
      </SubmitButton>
    </form>
  );
}
