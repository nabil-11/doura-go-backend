"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ONGOING_RIDE_STATUSES } from "@/lib/domain/ride";
import {
  DriveApiError,
  acceptRide,
  declineRide,
  getActiveRide,
  getEarnings,
  getOffers,
  getProfile,
  getRide,
  sendLocation,
  setAvailability,
  signOut,
  type DriverProfile,
  type Earnings,
  type LatLng,
  type Offer,
  type Ride,
} from "@/lib/drive/api";
import { LocationDenied, currentPosition, watchPosition } from "@/lib/drive/geo";
import type { Locale } from "@/lib/i18n/config";

import { ActiveRide, RideFinished } from "./active-ride";
import { AccountScreen } from "./account";
import { EarningsScreen } from "./earnings";
import { HomeScreen } from "./home";
import { Onboarding } from "./onboarding";
import { CenteredStage, Notice, messageFor, type CommonCopy, type DriveCopy } from "./shell";
import { SignIn } from "./sign-in";
import { TabBar, type DriveTab } from "./tabs";

/** The server drops a driver from dispatch after two minutes of silence. */
const HEARTBEAT_MS = 15_000;
/** Offers, while online and free. An offer only lasts half a minute. */
const OFFERS_MS = 4_000;
/** The ride itself — mainly to notice a rider who cancelled. */
const RIDE_MS = 6_000;

function isOngoing(ride: Ride) {
  return (ONGOING_RIDE_STATUSES as readonly string[]).includes(ride.status);
}

/**
 * The driver web app.
 *
 * One question at a time, in the order they stop mattering: is there a
 * session? Is the account approved? Is there a ride in hand? Only when all
 * three are answered does the driver get tabs — a ride takes the whole screen,
 * because a driver on a moto has no business navigating.
 *
 * Three loops run here, and only while they are needed: the position heartbeat
 * while the driver is out, the offer poll while they are online and free, and
 * the ride poll while they are carrying someone. All three stop when the tab
 * goes to the background — a phone in a jacket pocket should not be talking to
 * the server, and a driver's data is their own.
 */
export function DriveApp({
  copy,
  common,
  locale,
}: {
  copy: DriveCopy;
  common: CommonCopy;
  locale: Locale;
}) {
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [ride, setRide] = useState<Ride | null>(null);
  const [finished, setFinished] = useState<Ride | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerSeconds, setOfferSeconds] = useState(30);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [tab, setTab] = useState<DriveTab>("drive");
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** A ride that has stopped moving leaves the live screen for the last one. */
  const apply = useCallback((next: Ride) => {
    if (isOngoing(next)) {
      setRide(next);
      setOffers([]);
      setFinished(null);
    } else {
      setRide(null);
      setFinished(next.status === "completed" ? next : null);
    }
  }, []);

  /**
   * Who is asking, and are they on a ride? Both answers come from the server:
   * the session is a cookie this code cannot read, so 401 — not a missing
   * token — is what "signed out" looks like here.
   */
  const boot = useCallback(async () => {
    try {
      const { driver: profile } = await getProfile();
      setDriver(profile);
      setBootError(null);
      // Only an approved driver can have a ride, and asking for one before
      // then would 403 on an account that is simply still being reviewed.
      if (profile.status === "active") {
        const active = await getActiveRide();
        if (active.ride) apply(active.ride);
        else setRide(null);
      }
    } catch (failure) {
      const signedOut = failure instanceof DriveApiError && failure.status === 401;
      setDriver(null);
      setRide(null);
      setFinished(null);
      setBootError(signedOut ? null : messageFor(copy, failure));
    } finally {
      setBooting(false);
    }
  }, [apply, copy]);

  // Queued rather than called outright: an effect body should not itself cause
  // a render, and everything `boot` sets arrives with a network answer anyway.
  useEffect(() => {
    const timer = window.setTimeout(() => void boot(), 0);
    return () => window.clearTimeout(timer);
  }, [boot]);

  /** Re-reads the account: after a sign-in, and after anything that pays. */
  const reload = useCallback(async () => {
    const { driver: profile } = await getProfile();
    setDriver(profile);
  }, []);

  const approved = driver?.status === "active";
  const availability = driver?.availability ?? "offline";
  const out = availability !== "offline";
  const free = availability === "online" && ride === null;
  // Offers are only ever worth showing while both of those hold. Reading it
  // here means the last poll's answer cannot flash back up on the way offline.
  const open = free ? offers : [];

  // ------------------------------------------------------------- earnings ---

  useEffect(() => {
    if (!approved) return;
    const controller = new AbortController();
    void getEarnings(controller.signal)
      .then((result) => setEarnings(result.earnings))
      .catch(() => undefined);
    return () => controller.abort();
    // Re-read whenever a ride ends or the switch moves: both change the total.
  }, [approved, availability, finished]);

  // ------------------------------------------------------------- position ---

  // Watched continuously while out, but only sent every fifteen seconds.
  const lastSent = useRef(0);
  const latest = useRef<LatLng | null>(null);

  useEffect(() => {
    if (!out) return;

    const push = (point: LatLng) => {
      lastSent.current = Date.now();
      void sendLocation(point).catch(() => undefined);
    };

    const stop = watchPosition((point) => {
      latest.current = point;
      setPosition(point);
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastSent.current < HEARTBEAT_MS) return;
      push(point);
    });

    // A driver sitting still stops producing position events, so the heartbeat
    // resends the last known point on its own schedule.
    const timer = window.setInterval(() => {
      const point = latest.current;
      if (point && document.visibilityState === "visible") push(point);
    }, HEARTBEAT_MS);

    return () => {
      stop();
      window.clearInterval(timer);
    };
  }, [out]);

  // --------------------------------------------------------------- offers ---

  useEffect(() => {
    if (!free) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void getOffers()
        .then((result) => {
          setOffers(result.offers);
          setOfferSeconds(result.offerSeconds);
        })
        .catch(() => undefined);
    };
    tick();
    const timer = window.setInterval(tick, OFFERS_MS);
    return () => window.clearInterval(timer);
  }, [free]);

  // ----------------------------------------------------------------- ride ---

  // The poll reads the ride out of a ref so that its own result does not
  // restart the timer below on every tick.
  const live = useRef<Ride | null>(null);
  const polling = useRef(false);
  useEffect(() => {
    live.current = ride;
  }, [ride]);

  const refreshRide = useCallback(async () => {
    const current = live.current;
    if (!current || polling.current) return;
    polling.current = true;
    try {
      const result = await getRide(current.id);
      apply(result.ride);
      if (!isOngoing(result.ride)) await reload().catch(() => undefined);
    } catch (failure) {
      // A failed poll is ordinary on a moving connection and the next one will
      // do; only a lost session is worth acting on.
      if (failure instanceof DriveApiError && failure.status === 401) setDriver(null);
    } finally {
      polling.current = false;
    }
  }, [apply, reload]);

  const rideId = ride?.id ?? null;
  useEffect(() => {
    if (!rideId) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshRide();
    }, RIDE_MS);
    return () => window.clearInterval(timer);
  }, [rideId, refreshRide]);

  // A tab coming back to the front should not show a ride as it was five
  // minutes ago.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") void refreshRide();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refreshRide]);

  // -------------------------------------------------------------- actions ---

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      if (out) {
        const result = await setAvailability("offline");
        setDriver(result.driver);
        setOffers([]);
      } else {
        // Going online needs a position: dispatch has nothing to work with
        // otherwise, so it is fetched here rather than hoped for.
        const point = await currentPosition();
        setPosition(point);
        latest.current = point;
        lastSent.current = Date.now();
        const result = await setAvailability("online", point);
        setDriver(result.driver);
      }
    } catch (caught) {
      // Being refused permission, failing to get a fix and having no
      // geolocation at all need three different answers; "something went
      // wrong" would leave a driver tapping a button that cannot work.
      setError(
        caught instanceof LocationDenied
          ? caught.reason === "denied"
            ? copy.home.locationDenied
            : caught.reason === "unsupported"
              ? copy.home.locationUnsupported
              : copy.home.locationUnavailable
          : messageFor(copy, caught),
      );
    } finally {
      setBusy(false);
    }
  }

  async function accept(id: string) {
    setBusy(true);
    setError(null);
    try {
      const result = await acceptRide(id);
      apply(result.ride);
      await reload().catch(() => undefined);
    } catch (caught) {
      setError(messageFor(copy, caught));
      // Whoever else took it is gone from the list on the next poll.
      setOffers((current) => current.filter((offer) => offer.id !== id));
    } finally {
      setBusy(false);
    }
  }

  function decline(id: string) {
    setOffers((current) => current.filter((offer) => offer.id !== id));
    void declineRide(id).catch(() => undefined);
  }

  async function leave() {
    try {
      await signOut();
    } finally {
      setDriver(null);
      setRide(null);
      setFinished(null);
      setOffers([]);
      setTab("drive");
    }
  }

  // --------------------------------------------------------------- screen ---

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
          <Button
            onClick={() => {
              setBooting(true);
              void boot();
            }}
            className="mt-4 h-11 w-full font-semibold"
          >
            {common.retry}
          </Button>
        </div>
      </CenteredStage>
    );
  }

  if (!driver) {
    return (
      <SignIn
        copy={copy}
        locale={locale}
        onSignedIn={() => {
          setBooting(true);
          void boot();
        }}
      />
    );
  }

  if (driver.status !== "active") {
    return (
      <Onboarding
        copy={copy}
        locale={locale}
        driver={driver}
        onRecheck={reload}
        onSignOut={() => void leave()}
      />
    );
  }

  // A ride, finished or under way, owns the screen: no tabs under it.
  const frame = "flex h-full flex-col";

  if (finished) {
    return (
      <div className={frame}>
        <RideFinished copy={copy} locale={locale} ride={finished} onDone={() => setFinished(null)} />
      </div>
    );
  }

  if (ride) {
    return (
      <div className={frame}>
        <ActiveRide
          copy={copy}
          common={common}
          locale={locale}
          ride={ride}
          position={position}
          onUpdated={apply}
          onRefresh={() => void refreshRide()}
        />
      </div>
    );
  }

  return (
    <div className={frame}>
      <div className="relative min-h-0 flex-1">
        {tab === "drive" ? (
          <HomeScreen
            copy={copy}
            common={common}
            locale={locale}
            driver={driver}
            position={position}
            earnings={earnings}
            offers={open}
            offerSeconds={offerSeconds}
            busy={busy}
            error={error}
            onToggle={() => void toggle()}
            onAccept={(id) => void accept(id)}
            onDecline={decline}
          />
        ) : null}

        {tab === "earnings" ? (
          <EarningsScreen
            copy={copy}
            locale={locale}
            earnings={earnings}
            balance={driver.balance}
            error={null}
          />
        ) : null}

        {tab === "account" ? (
          <AccountScreen
            copy={copy}
            common={common}
            locale={locale}
            driver={driver}
            onDriver={setDriver}
            onSignOut={() => void leave()}
          />
        ) : null}
      </div>

      <TabBar copy={copy} tab={tab} onTab={setTab} />
    </div>
  );
}
