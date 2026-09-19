"use client";

import { CircleAlertIcon } from "lucide-react";
import { startTransition, useActionState, useId } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * useActionState wired to onSubmit instead of the `action` prop, so React
 * doesn't reset the form after submitting: values (and selected files) stay
 * in place when the server returns validation errors.
 */
export function useFormAction<State>(
  action: (state: Awaited<State>, formData: FormData) => State | Promise<State>,
  initialState: Awaited<State>,
) {
  const [state, dispatch, pending] = useActionState(action, initialState);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  return { state, pending, onSubmit };
}

/** Focus the first invalid control after a failed submit. */
export function focusFirstInvalid(form: HTMLFormElement | null) {
  const target = form?.querySelector<HTMLElement>("[aria-invalid='true']");
  target?.focus({ preventScroll: true });
  target?.scrollIntoView({ block: "center", behavior: "smooth" });
}

export function SubmitButton({
  pending,
  pendingLabel,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { pending: boolean; pendingLabel?: string }) {
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} className={className} {...props}>
      {pending ? <Spinner aria-hidden="true" /> : null}
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

type FieldShellProps = {
  label: React.ReactNode;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => React.ReactNode;
};

/** Label + control + hint/error, with ids wired for accessibility. */
export function FieldShell({ label, error, hint, className, children }: FieldShellProps) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <Field data-invalid={!!error} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children({ id, "aria-invalid": !!error, "aria-describedby": describedBy })}
      {error ? (
        <FieldError id={`${id}-error`}>{error}</FieldError>
      ) : hint ? (
        <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription>
      ) : null}
    </Field>
  );
}

type TextFieldProps = Omit<React.ComponentProps<typeof Input>, "id"> & {
  label: React.ReactNode;
  error?: string;
  hint?: React.ReactNode;
  fieldClassName?: string;
};

export function TextField({ label, error, hint, fieldClassName, ...inputProps }: TextFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} className={fieldClassName}>
      {(controlProps) => <Input {...controlProps} {...inputProps} />}
    </FieldShell>
  );
}

type TextAreaFieldProps = Omit<React.ComponentProps<typeof Textarea>, "id"> & {
  label: React.ReactNode;
  error?: string;
  hint?: React.ReactNode;
  fieldClassName?: string;
};

export function TextAreaField({ label, error, hint, fieldClassName, ...props }: TextAreaFieldProps) {
  return (
    <FieldShell label={label} error={error} hint={hint} className={fieldClassName}>
      {(controlProps) => <Textarea {...controlProps} {...props} />}
    </FieldShell>
  );
}

export function FormAlert({ message, className }: { message?: string; className?: string }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" className={cn(className)} role="alert">
      <CircleAlertIcon />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
