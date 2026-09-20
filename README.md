# Doura Go

Moto ride-hailing platform. This repository is the **whole backend**: the public
website, the backoffice used by the operations team, and the REST API the two
mobile apps run on.

One Next.js app, three entry points on the same domain:

| Path | What it is | Rendering |
| --- | --- | --- |
| `/{lang}` | Public website (home, become a driver) | Static, prerendered per language |
| `/{lang}/admin` | Backoffice (drivers, riders, rides, live map, pricing, team) | Server-rendered per request |
| `/api/v1/*` | Mobile API for the rider and driver apps — see [docs/api.md](docs/api.md) | Route handlers |

The apps live in their own repositories next to this one:

| Repository | What it is |
| --- | --- |
| `doura-go-client` | Rider app (Ionic React + Capacitor) |
| `doura-go-driver` | Driver app (Ionic React + Capacitor) |

Languages: **French (default), Arabic (right-to-left), English**. The language is
part of the URL, so every page is shareable and indexable in each language.

---

## Getting started

```bash
npm install
```

Create `.env` (already present in this checkout — never commit it):

```bash
MONGO_URL=mongodb+srv://…/doura_go   # MongoDB connection string
JWT_SECRET=…                          # 64 random bytes, hex (see below)
CLOUDINARY_URL=cloudinary://key:secret@cloud   # optional: file uploads
NEXT_PUBLIC_SITE_URL=https://douragoo.tn       # optional: canonical URLs, sitemap
MOBILE_APP_ORIGINS=https://app.douragoo.tn     # optional: extra CORS origins for the apps
GOOGLE_MAPS_API_KEY=                           # optional: switches maps, routes and search to Google
ROUTING_URL=https://router.project-osrm.org    # optional: your own OSRM
GEOCODER_URL=https://nominatim.openstreetmap.org  # optional: your own Nominatim
NEXT_PUBLIC_MAP_TILES=https://…/{z}/{x}/{y}.png  # optional: your own map tiles
SMS_PROVIDER=                                  # twilio | http — unset: codes are logged, not sent
TEST_PHONE_NUMBERS=+216…:123456                # optional: demo accounts, no SMS
```

> **Sign-in needs an SMS provider.** Without one the verification code is
> logged, and outside production it also comes back in the API response so the
> apps can be built against a real server — but nobody with a real phone can
> sign in. Two are implemented; pick one and fill in its variables:
>
> ```bash
> SMS_PROVIDER=twilio
> TWILIO_ACCOUNT_SID=AC…
> TWILIO_AUTH_TOKEN=…
> TWILIO_SENDER=+1…            # a number you own, or an approved sender id
>
> # …or a Tunisian aggregator with a JSON endpoint
> SMS_PROVIDER=http
> SMS_ENDPOINT=https://…/send
> SMS_API_KEY=…
> ```
>
> Twilio is the fastest way to be sending for real; a local aggregator is
> usually cheaper per message once volume arrives. Either way, the only message
> the platform sends is the verification code.

Generate a new `JWT_SECRET` at any time (this invalidates existing sessions):

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Create the first backoffice account, then start the app:

```bash
npm run admin:create -- --email you@company.com --name "Your Name"
npm run dev            # http://localhost:3000 → redirects to /fr
```

Optional demo data (24 drivers, 40 riders, ~30 days of rides) so the dashboard
isn't empty before the apps exist. Everything it writes is tagged `isDemo: true`:

```bash
npm run db:seed            # add (replaces previous demo data)
npm run db:seed -- --reset # remove demo data, add nothing
```

### Test accounts

Signing in needs an SMS, which is awkward while building the apps and
impossible for an app-store reviewer in California. Two demo accounts sign in
with a fixed code and no SMS at all:

```bash
npm run test:accounts            # create them and print their codes
npm run test:accounts -- --remove   # delete them
```

Put the line it prints in `.env` and restart. The numbers are in a range Tunisia
does not assign, so they can never belong to a real person, and nothing works
until `TEST_PHONE_NUMBERS` is set — an environment without it has no back door.
Re-run the command to roll the codes.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | Route types + `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run admin:create` | Create a backoffice account (`--reset` to set a new password) |
| `npm run db:seed` | Demo data (`--reset` to remove it) |
| `npm run api:test` | End-to-end check of the mobile API against a running server |
| `npm run test:accounts` | Demo rider and driver that sign in without SMS (`--remove` to delete) |

---

## How it's organised

```
app/
  [lang]/                    every page lives under a language segment
    (site)/                  public website
    admin/login/             sign-in (outside the protected layout)
    admin/(panel)/           protected backoffice: sidebar + header + pages
  api/v1/                    mobile API (auth, rides, dispatch, driver)
  api/admin/                 backoffice-only endpoints (documents, live map)
proxy.ts                     language redirects + optimistic auth (replaces middleware)
lib/
  domain/                    business rules, no database or UI (status changes,
                             approval checklist, fare calculation)
  services/                  database reads/writes returning plain objects
  actions/                   server actions: authorize → validate → service → revalidate
  validation/                Zod schemas; messages are dictionary keys, not sentences
  db/                        Mongoose connection and models
  auth/                      session tokens, data access layer, roles
  i18n/                      locales, dictionaries, formatting
  storage/                   Cloudinary uploads and signed URLs
  notifications/             SMS (no provider wired yet — one seam to fill)
components/
  ui/                        shadcn/ui (Radix, "nova" style, RTL enabled)
  site/ admin/ brand/        app components
  map/                       Leaflet map, loaded in the browser only
scripts/                     CLI tools (admin, demo data, API test)
docs/api.md                  the mobile API, for whoever builds against it
```

**The domain and service layers know nothing about the UI.** `app/api/v1/*` calls
the same services the backoffice does, so there is one definition of "can this
driver be approved" and one of "what does this ride cost" — the apps and the
office can never disagree about either.

---

## Decisions worth knowing

**Authentication.** Email + password (bcrypt), session in a signed JWT stored in an
httpOnly cookie. The proxy does a cheap cookie check to keep unauthenticated
visitors out; the real check happens in `lib/auth/dal.ts` on every page, server
action and route handler, and it re-reads the account from the database. Changing
a password or disabling an account bumps `sessionVersion`, which invalidates every
existing session immediately. Five failed sign-ins lock an account for 15 minutes.

**Roles.** `super_admin`, `admin`, `operations`, `support` — defined in
`lib/auth/roles.ts`. Permissions are checked on the server for every action; the
UI only uses them to hide what you can't do.

**Driver lifecycle.** `pending → active | rejected`, `active ↔ suspended`,
`rejected → pending`. Rejecting and suspending require a reason. A driver can only
become active when the approval checklist passes: required documents uploaded,
license valid (not expired), vehicle complete. The transition is applied with the
previous status as a condition, so two reviewers can't approve twice.

**Mobile sessions.** The apps sign in with a phone number and a six-digit code,
never a password. The code is stored only as a keyed hash, so a leaked
collection reveals nothing even though six digits are trivial to brute force.
Access tokens last half an hour; refresh tokens are rotated on every use, and
presenting one that was already rotated revokes the whole family — the sign of a
copied token. Riders sign themselves up; drivers cannot, because the team
onboards them.

**Dispatch.** A ride request goes to the five nearest free drivers at once and
the first to accept wins — the accept is a conditional update, so two taps on
two phones can never both succeed. Nobody takes it within thirty seconds and the
next round goes out, skipping whoever declined; after four empty rounds the
platform cancels the ride itself. Re-dispatch is lazy: the waiting rider's poll
is what starts the next round, which needs no scheduler and costs nothing for a
ride nobody is watching. A driver drops out of dispatch two minutes after their
app stops reporting a position, even if it never said goodbye.

**Commission on cash rides.** Riders pay the driver directly, so the driver
holds the fare and owes Doura Go its share. That debt builds up on the driver's
record, and when it reaches the limit set on the pricing page their account
stops taking rides until they settle at the office. Operations record the
payment on the driver's page — usually the whole balance, which reopens the
account on the spot — and every settlement is a ledger row with the balance
before and after, not just a number that moved.

**Maps, routes and addresses.** A ride is priced on the streets it actually
follows, not the line between its ends — in Tunis the difference is routinely
half again as far. `lib/services/routing.ts` asks a routing engine for the path,
`lib/services/places.ts` turns words into places and back, and both pick their
provider from what is configured:

| | With `GOOGLE_MAPS_API_KEY` | Without |
| --- | --- | --- |
| Routes | Google Routes API, traffic-aware | OSRM |
| Address search | Google Places | Nominatim |
| Reverse geocoding | Google Geocoding | Nominatim |
| Map tiles | Google, in the apps | OpenStreetMap |

Google's data in Tunisia is well ahead — place names and business listings
especially, which is what the destination field lives on — but it needs a
billing account and costs per request. Without a key everything still works,
which is why the apps run the moment they are cloned. Either way a provider
that times out falls back to a straight-line estimate rather than blocking a
booking: a rider who can't be quoted can't ride.

**Address lookup runs here, not in the apps.** A key shipped inside a phone app
can be pulled out of the bundle and spent by anyone, so the apps call
`/api/v1/geo/*` and the key stays on the server. The one exception is drawing
the map itself, which needs a browser key — restrict that one to the app's
bundle id and to the Maps JavaScript API alone.

Enable four APIs in Google Cloud if you go that way: **Routes**, **Places (New)**,
**Geocoding**, and **Maps JavaScript** for the apps.

**Documents are private.** The profile photo is public (riders see it in the app).
ID card, license, registration and insurance are uploaded to Cloudinary as
*authenticated* assets and are never linked directly: the browser requests
`/api/admin/drivers/{id}/documents/{kind}`, which checks the session and streams
the file. Originals use Cloudinary's signed download API, which works even though
most accounts block PDF delivery by default.

**Audit trail.** Every backoffice action writes an entry (who, what, when, plus the
reason or note) shown on the dashboard and on each driver's profile. Names are
copied at write time so history stays readable after a deletion.

**i18n.** Dictionaries are plain TypeScript objects (`lib/i18n/dictionaries`).
English is the reference shape; French and Arabic are typed against it, so a
missing or extra key is a compile error. Server actions return message *codes*,
never sentences, and the UI translates them. Dates, numbers and money use `Intl`
with the `Africa/Tunis` time zone and a 24-hour clock.

**Fares.** `lib/domain/pricing.ts` prices every ride: base + distance + time, with
a minimum fare, a booking fee, and a commission split. Amounts are rounded up to
0.100 TND. The pricing page previews the result live before saving.

Short rides skip the meter: anything up to `shortRideKm` costs `shortRideFare`,
all in — no booking fee on top and no minimum to apply, because it already is
the minimum. A hop across the neighbourhood is easier to sell as one number
than as a sum, and it is the price riders will repeat to each other. Set the
distance to 0 to meter everything. Keep the flat price near what the meter
would charge at that distance so the curve has no cliff in it.

**Money and dates.** Dinars are stored as numbers with 3 decimals (millimes).
Dashboard tiles round to whole dinars; detail pages show the exact amount.

---

## Brand

| | |
| --- | --- |
| **Doura Yellow** `#FFC800` | Primary actions and accents — always with Asphalt text on top |
| **Asphalt** `#0F1115` | Ink, dark sections, sidebar |
| **Sand** `#FAF9F5` | Page background |
| Status | good `#0ca30c` · warning `#fab219` · serious `#ec835a` · critical `#d03b3b` |
| Charts | amber `#b37d00` → blue `#2a78d6` → green `#1baf7a` (dark mode has its own steps) |
| Typeface | [Alexandria](https://fonts.google.com/specimen/Alexandria) — one family for Latin and Arabic |

The logo is a forward-leaning "D" whose round centre reads as a wheel hub, with
speed lines (`components/brand/logo.tsx`, `app/icon.svg`). Yellow is a nod to the
Tunisian taxi; the dark sidebar and yellow accents carry it into the product.

Chart colours were validated for contrast and colour-blind separation, and every
status is shown with an icon and a label, never colour alone.

---

## Good to know

- **Marketing copy is a starting point.** Cities, claims and FAQ answers live in
  `lib/i18n/dictionaries/*` and `lib/config/site.ts` — adapt them before launch.
- **No SMS provider.** Verification codes are logged, not sent. One branch in
  `lib/notifications/sms.ts` and sign-in works for real.
- **The free providers are demo services.** OSRM's public router, Nominatim and
  OpenStreetMap's tiles all work and cost nothing, but none of them promise
  uptime or allow heavy traffic. Self-host them (`ROUTING_URL`, `GEOCODER_URL`,
  `NEXT_PUBLIC_MAP_TILES`) or add a Google key before launch.
- **The backoffice stays on Leaflet** even with a Google key: it is an internal
  tool used by a handful of people, and a paid map load per staff page view
  buys nothing.
- **Cloudinary** is shared with another project in this checkout (`rentify-v1`);
  Doura Go files live under the `doura-go/` prefix. A dedicated account is cleaner
  for production.
- **Rate limiting** is in-memory: good for one server, replace with a shared
  store (Redis/Upstash) when you scale out.
- **Riders are created by the app**, not the backoffice, and rides are read-only
  there — the team watches them, the apps make them.

## Next steps

1. **Push notifications.** Everything polls today, which works and costs
   nothing, but a driver's phone should buzz when a ride is offered instead of
   needing the app open. Capacitor push plus a token per device.
2. **A routing provider** for real distances and ETAs, behind `estimateRoute`.
3. **Driver payouts and statements**, building on the commission ledger that
   already records every settlement.
4. **Service zones** managed from the backoffice instead of the static city list,
   with their own tariffs.
5. **Card payments**, which would turn the commission balance from a debt the
   driver carries into a split at the source.
