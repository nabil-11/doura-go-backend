"use client";

import { ExternalLinkIcon, FileTextIcon, ImageOffIcon, UploadIcon } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { useDictionary } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { uploadDriverDocumentAction } from "@/lib/actions/drivers";
import { MAX_DOCUMENT_BYTES, type DocumentKind } from "@/lib/domain/driver";
import { interpolate } from "@/lib/i18n/format";
import { resolveMessage } from "@/lib/validation/common";
import { cn } from "@/lib/utils";

type Props = {
  driverId: string;
  kind: DocumentKind;
  required: boolean;
  canUpload: boolean;
  file: { format: string; uploadedAtLabel: string; version: string } | null;
};

/** One document slot: preview (served through an authenticated route), open, upload/replace. */
export function DocumentTile({ driverId, kind, required, canUpload, file }: Props) {
  const dict = useDictionary();
  const t = dict.admin.drivers.documents;
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const [broken, setBroken] = useState(false);

  const base = `/api/admin/drivers/${driverId}/documents/${kind}`;
  const accept = kind === "photo" ? "image/jpeg,image/png,image/webp" : "image/jpeg,image/png,image/webp,application/pdf";

  function onSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    if (!accept.split(",").includes(selected.type)) {
      toast.error(dict.validation.fileType);
      return;
    }
    if (selected.size > MAX_DOCUMENT_BYTES) {
      toast.error(dict.validation.fileTooLarge);
      return;
    }
    startUpload(async () => {
      const formData = new FormData();
      formData.set("file", selected);
      const result = await uploadDriverDocumentAction(driverId, kind, formData);
      if (result.status === "success") {
        setLoaded(false);
        setBroken(false);
        toast.success(t.uploaded);
      } else if (result.status === "error") {
        toast.error(resolveMessage(dict, result.error ?? result.fieldErrors?.file) ?? dict.errors.generic);
      }
    });
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <div className="relative aspect-[4/3] bg-muted/50">
        {file && !broken ? (
          <>
            {!loaded ? <Skeleton className="absolute inset-0 rounded-none" /> : null}
            {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-protected image */}
            <img
              key={file.version}
              src={`${base}?variant=preview&v=${file.version}`}
              alt={t[kind]}
              loading="lazy"
              onLoad={() => setLoaded(true)}
              onError={() => setBroken(true)}
              className={cn("size-full object-cover transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")}
            />
            {file.format === "pdf" ? (
              <Badge className="absolute start-2 top-2 bg-asphalt text-white">PDF</Badge>
            ) : null}
          </>
        ) : (
          <div className="grid size-full place-items-center text-muted-foreground">
            {file ? <ImageOffIcon className="size-7" aria-hidden="true" /> : <FileTextIcon className="size-7" aria-hidden="true" />}
          </div>
        )}
        {required ? (
          <Badge variant="outline" className="absolute end-2 top-2 bg-card/90 text-[0.65rem] backdrop-blur">
            {t.required}
          </Badge>
        ) : null}
        {uploading ? (
          <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-sm">
            <Spinner className="size-6" aria-label={dict.common.loading} />
          </div>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" title={t[kind]}>
            {t[kind]}
          </p>
          <p className={cn("text-xs", file ? "text-muted-foreground" : required ? "text-destructive" : "text-muted-foreground")}>
            {file ? interpolate(t.uploadedOn, { date: file.uploadedAtLabel }) : t.missing}
          </p>
        </div>
        <div className="mt-auto flex gap-2">
          {file ? (
            <Button asChild variant="outline" size="sm" className="flex-1">
              <a href={`${base}?variant=original&v=${file.version}`} target="_blank" rel="noreferrer">
                <ExternalLinkIcon />
                {t.open}
              </a>
            </Button>
          ) : null}
          {canUpload ? (
            <>
              <Button
                type="button"
                variant={file ? "ghost" : "secondary"}
                size="sm"
                className="flex-1"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? <Spinner aria-hidden="true" /> : <UploadIcon />}
                {file ? t.replace : t.upload}
              </Button>
              <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onSelect} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
