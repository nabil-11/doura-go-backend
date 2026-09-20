"use client";

import { create } from "qrcode";
import { useMemo } from "react";

/**
 * A QR code, drawn in the page.
 *
 * The payload never leaves the browser: no image service is called, so this
 * still works on a phone with one bar of signal. The symbol is a single SVG
 * path — one <rect> per dark module would be hundreds of nodes for React to
 * keep track of, and this redraws only when the payload changes.
 *
 * The colours are deliberately fixed rather than themed. A scanner expects
 * dark modules on a light field, and an inverted code in the dark theme would
 * simply not read.
 */

/** Modules of blank margin. Four is what the spec asks of a scanner. */
const QUIET_ZONE = 4;

export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const symbol = useMemo(() => {
    try {
      const { modules } = create(value, { errorCorrectionLevel: "M" });
      let path = "";
      for (let row = 0; row < modules.size; row += 1) {
        for (let col = 0; col < modules.size; col += 1) {
          // A 1×1 square per dark module; they merge into solid blocks.
          if (modules.get(row, col)) path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`;
        }
      }
      return { span: modules.size + QUIET_ZONE * 2, path };
    } catch {
      // Nothing sensible to draw — the digits next to it still carry the ride.
      return null;
    }
  }, [value]);

  if (!symbol) return null;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${symbol.span} ${symbol.span}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={symbol.span} height={symbol.span} fill="#ffffff" />
      <path d={symbol.path} fill="#0f1115" />
    </svg>
  );
}
