"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useDictionary } from "@/components/i18n/locale-provider";
import { SubmitButton, useFormAction } from "@/components/shared/form";
import { Field, FieldError } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { addDriverNoteAction } from "@/lib/actions/drivers";
import { idleState, resolveMessage, type ActionState } from "@/lib/validation/common";

export function NoteForm({ driverId }: { driverId: string }) {
  const dict = useDictionary();
  const formRef = useRef<HTMLFormElement>(null);
  const { state, pending, onSubmit } = useFormAction<ActionState>(addDriverNoteAction.bind(null, driverId), idleState);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      toast.success(dict.admin.drivers.detail.noteAdded);
    } else if (state.status === "error" && state.error) {
      toast.error(resolveMessage(dict, state.error));
    }
  }, [state, dict]);

  const error = state.status === "error" ? resolveMessage(dict, state.fieldErrors?.note) : undefined;

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-2">
      <Field data-invalid={!!error}>
        <Textarea
          name="note"
          rows={2}
          maxLength={1000}
          placeholder={dict.admin.drivers.detail.notePlaceholder}
          aria-label={dict.admin.drivers.detail.notePlaceholder}
          aria-invalid={!!error}
          className="min-h-16 resize-y"
        />
        <FieldError>{error}</FieldError>
      </Field>
      <div className="flex justify-end">
        <SubmitButton pending={pending} size="sm" variant="secondary">
          {dict.admin.drivers.detail.addNote}
        </SubmitButton>
      </div>
    </form>
  );
}
