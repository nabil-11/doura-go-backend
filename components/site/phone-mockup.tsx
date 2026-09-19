import { HardHatIcon, MotorbikeIcon, StarIcon } from "lucide-react";

import type { Dictionary } from "@/lib/i18n/dictionaries/en";

type MockCopy = Dictionary["site"]["mock"];

/**
 * Illustrative rider app screen: a stylised map of the route and the
 * matched driver. Pure markup — no images to load.
 */
export function PhoneMockup({ copy, fare }: { copy: MockCopy; fare: string }) {
  return (
    <div className="relative mx-auto w-[272px] sm:w-[300px]">
      <div className="relative rounded-[2.9rem] bg-[#1B1E24] p-2.5 shadow-[0_40px_80px_-20px_rgb(0_0_0/0.65)] ring-1 ring-white/10">
        <div className="absolute start-1/2 top-4 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-black rtl:translate-x-1/2" />
        <div className="relative overflow-hidden rounded-[2.25rem] bg-[#ECEAE3]">
          <RouteMap />

          {/* Route summary */}
          <div className="absolute inset-x-3 top-11 rounded-2xl bg-white/95 p-3 text-[11px] text-asphalt shadow-lg backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full border-[3px] border-asphalt" aria-hidden="true" />
              <span className="text-[#6B6A64]">{copy.pickup}</span>
              <span className="ms-auto truncate font-semibold">{copy.pickupValue}</span>
            </div>
            <div className="my-1.5 ms-[4px] h-3 border-s border-dashed border-[#B9B6AC]" aria-hidden="true" />
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-[3px] bg-asphalt" aria-hidden="true" />
              <span className="text-[#6B6A64]">{copy.dropoff}</span>
              <span className="ms-auto truncate font-semibold">{copy.dropoffValue}</span>
            </div>
          </div>

          {/* Driver sheet */}
          <div className="absolute inset-x-0 bottom-0 rounded-t-[1.6rem] bg-white p-4 pb-5 text-asphalt shadow-[0_-12px_30px_-12px_rgb(0_0_0/0.25)]">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#DDDAD2]" aria-hidden="true" />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold">{copy.status}</p>
              <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold">{copy.eta}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#EFEDE6]" aria-hidden="true">
              <div className="h-full w-2/3 rounded-full bg-asphalt" />
            </div>
            <div className="mt-3.5 flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-full bg-asphalt text-sm font-bold text-brand">
                SB
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-sm font-semibold">
                  {copy.driverName}
                  <StarIcon className="size-3 fill-brand text-brand" aria-hidden="true" />
                  <span className="text-xs font-medium text-[#6B6A64]">4.9</span>
                </p>
                <p className="truncate text-[11px] text-[#6B6A64]">{copy.vehicle}</p>
              </div>
              <span dir="ltr" className="rounded-md border border-[#DDDAD2] px-1.5 py-1 text-[10px] font-bold tracking-wide">
                123 TU 4567
              </span>
            </div>
            <div className="mt-3.5 flex items-center justify-between rounded-xl bg-[#F4F2EC] px-3 py-2">
              <span className="flex items-center gap-1.5 text-[11px] font-medium">
                <HardHatIcon className="size-3.5" aria-hidden="true" />
                {copy.helmet}
              </span>
              <span className="text-[11px] text-[#6B6A64]">
                {copy.fare} <strong className="text-sm text-asphalt">{fare}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Stylised streets, the lake and the animated route. */
function RouteMap() {
  return (
    <svg viewBox="0 0 280 560" className="block h-[540px] w-full sm:h-[580px]" aria-hidden="true">
      <rect width="280" height="560" fill="#ECEAE3" />
      {/* Lake */}
      <path d="M180 0h100v210c-30 10-60 4-80-18s-40-60-20-120z" fill="#C9DDEB" />
      {/* Parks */}
      <rect x="18" y="300" width="70" height="52" rx="10" fill="#D6E3C6" />
      <rect x="150" y="360" width="58" height="40" rx="10" fill="#D6E3C6" />
      {/* Streets */}
      <g stroke="#FFFFFF" strokeWidth="14" strokeLinecap="round" fill="none">
        <path d="M-10 250 L300 190" />
        <path d="M60 -10 L110 600" />
        <path d="M-10 420 L300 380" />
        <path d="M200 230 L250 600" />
        <path d="M-10 120 L180 80" />
      </g>
      <g stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.9">
        <path d="M150 -10 L170 240" />
        <path d="M-10 340 L150 320" />
        <path d="M20 500 L280 470" />
        <path d="M30 180 L60 560" />
      </g>
      {/* Route */}
      <path
        d="M92 440 L86 330 L120 318 L112 244 L176 232 L190 150"
        fill="none"
        stroke="#0F1115"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M92 440 L86 330 L120 318 L112 244 L176 232 L190 150"
        fill="none"
        stroke="#FFC800"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="10 10"
        className="motion-safe:animate-route"
      />
      {/* Drop-off */}
      <g transform="translate(190 150)">
        <circle r="16" fill="#0F1115" opacity="0.12" />
        <rect x="-8" y="-8" width="16" height="16" rx="3" fill="#0F1115" />
        <rect x="-3" y="-3" width="6" height="6" rx="1" fill="#FFFFFF" />
      </g>
      {/* Pickup */}
      <g transform="translate(92 440)">
        <circle r="18" fill="#FFC800" opacity="0.25" className="motion-safe:animate-ping-slow" style={{ transformOrigin: "center", transformBox: "fill-box" }} />
        <circle r="9" fill="#FFFFFF" stroke="#0F1115" strokeWidth="5" />
      </g>
      {/* Driver, heading to the pickup point */}
      <g transform="translate(88 372)">
        <circle r="15" fill="#FFC800" stroke="#0F1115" strokeWidth="3" />
      </g>
      <foreignObject x="76" y="360" width="24" height="24">
        <div className="grid size-6 place-items-center text-asphalt">
          <MotorbikeIcon className="size-4" />
        </div>
      </foreignObject>
    </svg>
  );
}
