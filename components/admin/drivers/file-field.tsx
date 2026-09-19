"use client";

import { FileTextIcon, ImageUpIcon, XIcon } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MAX_DOCUMENT_BYTES } from "@/lib/domain/driver";
import { cn } from "@/lib/utils";

/**
 * File input styled as a drop zone, with an instant preview for images.
 * Client-side checks mirror the server rules for faster feedback.
 */
export function FileField({
  name,
  label,
  accept,
  required,
  requiredLabel,
  hint,
  error,
  labels,
}: {
  name: string;
  label: string;
  accept: string;
  required?: boolean;
  requiredLabel: string;
  hint: string;
  error?: string;
  labels: { remove: string; tooLarge: string; badType: string; selected: string };
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const preview = useMemo(
    () => (file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function onChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setLocalError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    const allowed = accept.split(",").map((type) => type.trim());
    const typeOk = allowed.some((type) => (type.endsWith("/*") ? selected.type.startsWith(type.slice(0, -1)) : selected.type === type));
    if (!typeOk) setLocalError(labels.badType);
    else if (selected.size > MAX_DOCUMENT_BYTES) setLocalError(labels.tooLarge);
    if (!typeOk || selected.size > MAX_DOCUMENT_BYTES) {
      event.target.value = "";
      setFile(null);
      return;
    }
    setFile(selected);
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    setFile(null);
    setLocalError(null);
  }

  const message = localError ?? error;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {required ? (
          <Badge variant="outline" className="text-[0.65rem] font-medium">
            {requiredLabel}
          </Badge>
        ) : null}
      </div>
      <div
        data-invalid={!!message}
        className={cn(
          "relative flex items-center gap-3 rounded-xl border border-dashed bg-muted/30 p-3 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40 hover:bg-muted/60",
          file && "border-solid bg-card",
          message && "border-destructive",
        )}
      >
        <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img src={preview} alt="" className="size-full object-cover" />
          ) : file ? (
            <FileTextIcon className="size-5" aria-hidden="true" />
          ) : (
            <ImageUpIcon className="size-5" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 flex-1 text-sm">
          <span className="block truncate font-medium">{file ? labels.selected.replace("{name}", file.name) : hint}</span>
        </span>
        {file ? (
          <Button type="button" variant="ghost" size="icon-sm" onClick={clear} aria-label={labels.remove} className="relative z-10">
            <XIcon />
          </Button>
        ) : null}
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="file"
          accept={accept}
          onChange={onChange}
          aria-invalid={!!message}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </div>
      {message ? (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}
    </div>
  );
}
