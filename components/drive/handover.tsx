"use client";

import { KeyboardIcon, QrCodeIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { DriveApiError } from "@/lib/drive/api";
import { HANDOVER_CODE_LENGTH, cleanHandoverCode, isHandoverCode, readScan, type ScanMismatch } from "@/lib/drive/handover";
import type { Handover } from "@/lib/domain/ride";
import type { Locale } from "@/lib/i18n/config";
import { formatNumber, interpolate } from "@/lib/i18n/format";

import { messageFor, type CommonCopy, type DriveCopy } from "./shell";

// --------------------------------------------------------------- scanning ---

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> };
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

/**
 * Reading a QR in a browser, where it is available at all.
 *
 * `BarcodeDetector` ships on Chrome for Android — which is what a driver on a
 * phone is most likely holding — and on nothing else worth relying on. There
 * is no polyfill here on purpose: a scanner that decodes slowly in the sun
 * with an engine running is worse than no scanner, and the four digits beside
 * it always work.
 */
function detectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null;
}

function cameraAvailable() {
  return (
    detectorCtor() !== null &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

/** How often the preview is read. Faster than this is wasted work. */
const SCAN_INTERVAL_MS = 300;

// ------------------------------------------------------------------ sheet ---

/**
 * The rider's code, asked for at both ends of the ride.
 *
 * Starting and finishing are the same conversation — "read me your code" — so
 * they are the same sheet, told apart only by which handover it is confirming.
 * Two ways in, and both have to work: pointing the camera at the rider's QR,
 * and typing four digits, which is what happens when the screen is cracked,
 * the sun is on it, the camera was refused, or this browser has no scanner at
 * all.
 *
 * A scan is checked against the ride in hand before anything leaves the
 * browser. A code from another rider's screen would be refused by the server
 * and would cost one of five tries, so it is caught here and named instead.
 *
 * `onConfirm` throws what the API threw, and the sheet stays open around a
 * code problem rather than dumping the driver back on the map with nothing to
 * do.
 */
export function HandoverSheet({
  copy,
  common,
  locale,
  handover,
  rideId,
  onConfirm,
  onDismiss,
}: {
  copy: DriveCopy;
  common: CommonCopy;
  locale: Locale;
  /** Which of the two codes we are after: the one that starts, or the one that ends. */
  handover: Handover;
  rideId: string;
  /** Resolves once the step went through. Throws the DriveApiError to explain. */
  onConfirm: (code: string) => Promise<void>;
  onDismiss: () => void;
}) {
  const t = copy.handover;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [note, setNote] = useState<{ text: string; hint?: string } | null>(null);
  const [canScan] = useState(cameraAvailable);

  const video = useRef<HTMLVideoElement>(null);
  const input = useRef<HTMLInputElement>(null);
  // The camera reports the same QR many times a second; these keep one scan
  // from turning into a pile of requests.
  const sending = useRef(false);
  const lastSeen = useRef<string | null>(null);

  const ready = isHandoverCode(code);

  // With no scanner the keypad is the whole sheet, so it takes the caret. With
  // one, focusing here would raise the on-screen keyboard over the scan button
  // the driver was reaching for.
  useEffect(() => {
    if (!canScan) input.current?.focus();
  }, [canScan]);
  const title = handover === "start" ? t.startTitle : t.finishTitle;
  const body = handover === "start" ? t.startBody : t.finishBody;
  const confirmLabel = handover === "start" ? t.confirmStart : t.confirmFinish;

  const submit = useCallback(
    async (value: string) => {
      if (sending.current) return;
      sending.current = true;
      setBusy(true);
      setNote(null);
      try {
        await onConfirm(value);
        // The ride moved on; the parent takes the sheet away.
      } catch (caught) {
        const api = caught instanceof DriveApiError ? caught : null;
        if (api?.code === "handoverWrong") {
          const left = Number(api.details?.remaining);
          setNote({
            text: copy.errors.handoverWrong,
            hint:
              !Number.isFinite(left) || left <= 0
                ? undefined
                : left === 1
                  ? t.lastTry
                  : interpolate(t.triesLeft, { count: formatNumber(locale, left) }),
          });
        } else if (api?.code === "handoverLocked") {
          // Not the end of the ride: the rider's screen already shows a fresh
          // code, and reading that one out is the whole fix.
          setNote({ text: copy.errors.handoverLocked, hint: t.askNewCode });
        } else {
          setNote({ text: messageFor(copy, caught) });
        }
        setCode("");
        setScanning(false);
        input.current?.focus();
      } finally {
        sending.current = false;
        setBusy(false);
      }
    },
    [copy, locale, onConfirm, t],
  );

  const onScanned = useCallback(
    (value: string) => {
      if (value === lastSeen.current || sending.current) return;
      lastSeen.current = value;

      const read = readScan(value, { rideId, handover });
      if (!read.ok) {
        // Still pointed at something — just not at this ride's code. The
        // camera stays on so they can swing it to the right screen.
        setNote({ text: mismatchText(t, handover, read.reason) });
        return;
      }

      setScanning(false);
      setCode(read.code);
      void submit(read.code);
    },
    [handover, rideId, submit, t],
  );

  // The camera loop lives and dies with `scanning`: the stream is opened here
  // and the cleanup stops every track, so leaving the sheet — or the ride
  // being called off under us mid-scan — always turns the light off.
  const latestScan = useRef(onScanned);
  useEffect(() => {
    latestScan.current = onScanned;
  }, [onScanned]);

  useEffect(() => {
    if (!scanning) return;
    const element = video.current;
    if (!element) return;

    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;

    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (stopped) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        element.srcObject = stream;
        await element.play();

        const Detector = detectorCtor();
        if (!Detector) throw new Error("no detector");
        const detector = new Detector({ formats: ["qr_code"] });

        timer = window.setInterval(() => {
          if (element.readyState < 2) return;
          void detector
            .detect(element)
            .then((found) => {
              const first = found[0]?.rawValue;
              if (first) latestScan.current(first);
            })
            .catch(() => undefined);
        }, SCAN_INTERVAL_MS);
      } catch (failure) {
        if (stopped) return;
        const denied = failure instanceof DOMException && failure.name === "NotAllowedError";
        setNote({ text: denied ? t.denied : t.failed });
        setScanning(false);
      }
    })();

    return () => {
      stopped = true;
      window.clearInterval(timer);
      element.srcObject = null;
      if (stream) for (const track of stream.getTracks()) track.stop();
    };
  }, [scanning, t]);

  function startScan() {
    setNote(null);
    lastSeen.current = null;
    setScanning(true);
  }

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) onDismiss();
      }}
    >
      <SheetContent side="bottom" showCloseButton={false} className="max-h-[92svh] gap-0 overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{body}</SheetDescription>
        </SheetHeader>

        <div className="mx-auto w-full max-w-md px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {note ? (
            <p role="alert" className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {note.text}
              {note.hint ? <span className="mt-1 block text-xs opacity-80">{note.hint}</span> : null}
            </p>
          ) : null}

          {scanning ? (
            <div className="mb-4">
              <div className="relative overflow-hidden rounded-xl bg-asphalt">
                {/* `playsInline` or iOS Safari takes the video fullscreen and
                    the frame the driver is aiming with disappears. */}
                <video
                  ref={video}
                  muted
                  playsInline
                  className="block h-56 w-full object-cover"
                  aria-label={t.scan}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute start-1/2 top-1/2 size-36 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-brand rtl:translate-x-1/2"
                />
              </div>
              <p className="mt-2 text-center text-xs text-muted-foreground">{t.scanHint}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setScanning(false)}
                className="mt-3 h-11 w-full font-semibold"
              >
                <XIcon aria-hidden="true" />
                {t.scanCancel}
              </Button>
            </div>
          ) : canScan ? (
            <Button type="button" variant="outline" onClick={startScan} disabled={busy} className="mb-4 h-12 w-full font-semibold">
              <QrCodeIcon aria-hidden="true" />
              {t.scan}
            </Button>
          ) : (
            <p className="mb-4 flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              <KeyboardIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{t.noCamera}</span>
            </p>
          )}

          <Label htmlFor="dg-handover-code" className="block">
            {t.codeLabel}
          </Label>
          <Input
            id="dg-handover-code"
            ref={input}
            dir="ltr"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={HANDOVER_CODE_LENGTH}
            placeholder="••••"
            value={code}
            disabled={busy}
            onChange={(event) => {
              setNote(null);
              setCode(cleanHandoverCode(event.target.value));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && ready && !busy) void submit(code);
            }}
            className="mt-2 h-16 text-center font-mono text-3xl tracking-[0.5em] tabular-nums"
          />
          <p className="mt-2 text-xs text-muted-foreground">{t.codeHint}</p>

          <Button
            type="button"
            onClick={() => void submit(code)}
            disabled={!ready || busy}
            className="mt-4 h-13 w-full text-base font-semibold"
          >
            {busy ? <Spinner aria-hidden="true" /> : null}
            {confirmLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onDismiss}
            disabled={busy}
            className="mt-1 h-11 w-full text-muted-foreground"
          >
            {common.cancel}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function mismatchText(t: DriveCopy["handover"], handover: Handover, reason: ScanMismatch) {
  if (reason === "otherRide") return t.otherRide;
  if (reason === "otherStep") return handover === "start" ? t.otherStepStart : t.otherStepFinish;
  return t.notOurs;
}
