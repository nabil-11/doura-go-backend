"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ONGOING_RIDE_STATUSES } from "@/lib/domain/ride";
import type { Locale } from "@/lib/i18n/config";
import {
  RideApiError,
  getActiveRide,
  getConfig,
  getProfile,
  getRide,
  signOut,
  type AppConfig,
  type Ride,
  type RiderProfile,
} from "@/lib/ride/api";

import { BookScreen } from "./book";
import { OutcomeScreen } from "./outcome";
import { CenteredStage, Notice, messageFor, type CommonCopy, type RideCopy } from "./shell";
import { SignIn } from "./sign-in";
import { TrackScreen } from "./tracking";

/** Waiting or riding: how long between looks at the ride. */
const FAST_MS = 4_000;
/** Once aboard, less changes — and the trip can be a while. */
const SLOW_MS = 9_000;

function isOngoing(ride: Ride) {
  return (ONGOING_RIDE_STATUSES as readonly string[]).includes(ride.status);
}

/**
 * The rider web app.
 *
 * One screen at a time, chosen by two questions: is there a session, and is
 * there a ride? The session is an httpOnly cookie this code cannot read, so
 * the answer to the first comes from `GET /me` — 401 means signed out.
 */
export function RideApp({ copy, common, locale }: { copy: RideCopy; common: CommonCopy; locale: Locale }) {
  const [rider, setRider] = useState<RiderProfile | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [ride, setRide] = useState<Ride | null>(null);
  const [finished, setFinished] = useState<Ride | null>(null);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  /** A ride that has stopped moving leaves the live screen for the last one. */
  const apply = useCallback((next: Ride) => {
    if (isOngoing(next)) {
      setRide(next);
      setFinished(null);
    } else {
      setRide(null);
      setFinished(next);
    }
  }, []);

  /**
   * Who is asking, and are they on a ride? Both answers come from the server:
   * the session is a cookie this code cannot read, so 401 — not a missing
   * token — is what "signed out" looks like here.
   */
  const boot = useCallback(async () => {
    try {
      const { rider: profile } = await getProfile();
      const active = await getActiveRide();
      setRider(profile);
      setBootError(null);
      if (active.ride) apply(active.ride);
      else {
        setRide(null);
        setFinished(null);
      }
    } catch (failure) {
      const signedOut = failure instanceof RideApiError && failure.status === 401;
      setRider(null);
      setRide(null);
      setFinished(null);
      setBootError(signedOut ? null : messageFor(copy, failure));
    } finally {
      setBooting(false);
    }
  }, [apply, copy]);

  useEffect(() => {
    void boot();
  }, [boot]);

  /** Re-reads the account after a sign-in, or when a screen falls behind. */
  function reload() {
    setBooting(true);
    void boot();
  }

  // Public, and the same numbers the website shows, so it is fetched once and
  // a failure costs nothing but a missing city list.
  useEffect(() => {
    void getConfig()
      .then(setConfig)
      .catch(() => setConfig(null));
  }, []);

  // The poll reads the ride out of a ref so that its own result does not
  // restart the timer below on every tick.
  const live = useRef<Ride | null>(null);
  const polling = useRef(false);
  useEffect(() => {
    live.current = ride;
  }, [ride]);

  const refresh = useCallback(async () => {
    const current = live.current;
    if (!current || polling.current) return;
    polling.current = true;
    try {
      const { ride: next } = await getRide(current.id);
      apply(next);
    } catch (failure) {
      // A failed poll is ordinary on a moving connection and the next one will
      // do; only a lost session is worth acting on.
      if (failure instanceof RideApiError && failure.status === 401) setRider(null);
    } finally {
      polling.current = false;
    }
  }, [apply]);

  /**
   * The live channel, and the one thing that must not stop: **the rider's poll
   * is what moves the search on to the next round of drivers**, so a ride sits
   * still unless someone is watching it.
   */
  const rideId = ride?.id ?? null;
  const aboard = ride?.status === "in_progress";
  useEffect(() => {
    if (!rideId) return;
    const timer = window.setInterval(() => void refresh(), aboard ? SLOW_MS : FAST_MS);
    return () => window.clearInterval(timer);
  }, [rideId, aboard, refresh]);

  // A tab coming back to the front should not show a ride as it was five
  // minutes ago.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") void refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  async function leave() {
    try {
      await signOut();
    } finally {
      setRider(null);
      setRide(null);
      setFinished(null);
    }
  }

  if (booting) {
    return (
      <CenteredStage>
        <p className="flex items-center gap-3 text-white/70">
          <Spinner className="size-5" aria-hidden="true" />
          {copy.loading}
        </p>
      </CenteredStage>
    );
  }

  if (bootError) {
    return (
      <CenteredStage>
        <div className="w-full max-w-sm text-center">
          <Notice message={bootError} className="bg-destructive/20 text-destructive-foreground" />
          <Button onClick={reload} className="mt-4 h-11 w-full font-semibold">
            {common.retry}
          </Button>
        </div>
      </CenteredStage>
    );
  }

  if (!rider) return <SignIn copy={copy} onSignedIn={reload} />;

  if (finished) {
    return (
      <OutcomeScreen
        copy={copy}
        common={common}
        locale={locale}
        ride={finished}
        onDone={() => setFinished(null)}
      />
    );
  }

  if (ride) {
    return (
      <TrackScreen
        copy={copy}
        common={common}
        locale={locale}
        config={config}
        ride={ride}
        onUpdated={apply}
      />
    );
  }

  return (
    <BookScreen
      copy={copy}
      common={common}
      locale={locale}
      config={config}
      rider={rider}
      onRequested={apply}
      onRecheck={reload}
      onSignOut={() => void leave()}
    />
  );
}
