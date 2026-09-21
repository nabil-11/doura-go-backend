# Doura Go mobile API (v1)

The HTTP interface behind the rider app (`doura-go-client`), the driver app
(`doura-go-driver`) and the two web apps on the website itself. Everything lives
under `/api/v1`, speaks JSON, and is never cached.

```
GET https://douragoo.tn/api/v1          # what's here, and every error code
GET https://douragoo.tn/api/v1/config   # cities, tariff, search window
```

---

## How a call is shaped

**Authentication** is a bearer token:

```http
Authorization: Bearer <accessToken>
```

The web apps send an httpOnly cookie instead of a header — see [Signing in from
a browser](#signing-in-from-a-browser). Everything below works the same either
way.

Access tokens last **30 minutes**; refresh tokens last **60 days** and are
rotated on every use. The account behind a token is re-read from the database on
every request, so blocking a rider or suspending a driver takes effect at once
rather than when the token expires.

**Errors** always come back in the same envelope:

```json
{
  "error": {
    "code": "outsideServiceArea",
    "message": "That pickup point is outside the service area.",
    "details": { "pickup.lat": "expected a number" }
  }
}
```

Switch on `code`. The `message` is for developers and logs — show your own
translated wording to riders and drivers. `details` appears on validation
failures and names the offending fields. `GET /api/v1` returns the full list of
codes with their HTTP statuses.

**Rate limits** return `429 rateLimited`. The tight ones are: 3 code requests per
phone per 15 minutes, 20 per address per hour, 10 ride requests per rider per
hour, 60 position updates per driver per minute.

**Cross-origin**: the Capacitor origins (`capacitor://localhost`,
`http://localhost`) are allowed, plus anything listed in `MOBILE_APP_ORIGINS`, plus
any localhost port while developing — Vite moves to the next free port when one
is taken, and a fixed list only produces a confusing "can't reach the server"
later. Tokens are not cookies, so no credentials ride along.

---

## Signing in

Both apps use the same flow: a phone number, a six-digit code by SMS.

### `POST /auth/otp`

```json
{ "phone": "+21612345678", "audience": "rider" }
```

`audience` is `rider` or `driver`. A driver number the office doesn't know gets
`403 notRegistered` — better than a code that leads nowhere. Rider numbers are
never confirmed or denied.

```json
{ "sent": true, "expiresAt": "2026-03-04T10:05:00.000Z", "debugCode": "483920" }
```

`debugCode` is present only outside production while no SMS provider is
configured, so the apps can be built against a real server. In production
without a provider the call fails with `502 smsUnavailable`.

### `POST /auth/verify`

```json
{ "phone": "+21612345678", "audience": "rider", "code": "483920", "name": "Amine" }
```

A rider signing in for the first time has no account yet: without `name` the
reply is `422 nameRequired`, and the same code can be sent again with one. The
code is only spent once it has produced a session. Five wrong tries retire it.

```json
{
  "accessToken": "…", "refreshToken": "…", "tokenType": "Bearer", "expiresIn": 1800,
  "account": { "id": "65f…", "audience": "rider", "isNew": true }
}
```

`201` for a new account, `200` for an existing one.

### Test numbers

`TEST_PHONE_NUMBERS` on the server maps phone numbers to fixed codes:

```
TEST_PHONE_NUMBERS=+21610000001:483920,+21610000002:774615
```

Those numbers skip SMS entirely and always accept their own code — in every
environment, production included, which is what makes them usable for an
app-store review. The code is never returned by `/auth/otp`: whoever configured
it already knows it. They are also exempt from the per-number rate limit, since
no message is sent and nobody can be disturbed. `npm run test:accounts` in the
backend creates a matching rider and driver.

### `POST /auth/refresh`

```json
{ "refreshToken": "…" }
```

Returns a new pair. **The old refresh token stops working immediately**, so
store what comes back before using it. Presenting a token that was already
rotated means it was copied: the whole family is revoked and both devices have
to sign in again.

### `POST /auth/logout`

```json
{ "refreshToken": "…" }
```

Always succeeds. The access token keeps working until it expires, so discard it
in the app too.

---

## Signing in from a browser

The website runs the same two apps — booking at `/{lang}/ride`, driving at
`/{lang}/driver` — and a browser has nowhere safe to keep a token: anything
JavaScript can read, an injected script can steal. So the web apps never hold
one. They sign in at their own door, get an **httpOnly cookie**, and every
later call is the ordinary endpoint below with that cookie instead of an
`Authorization` header.

### `POST /auth/web` — rider

```json
{ "phone": "+21622123456", "code": "123456", "name": "Amine" }
```

Same checks as `/auth/verify` with `audience: "rider"`. `name` is required the
first time and refused as `422 nameRequired` if missing. Sets `dg_rider` and
returns `{ account: { id, isNew } }` — no tokens. The refresh token issued
along the way is revoked immediately: the cookie is the session.

### `POST /auth/web/driver` — driver

```json
{ "phone": "+21698123456", "code": "123456" }
```

No `name`: a driver account is created by the team from a vetted application,
so an unknown number is `403 notRegistered` rather than a sign-up. Sets
`dg_driver` and returns `{ account: { id } }`.

`DELETE` on either path drops that cookie and leaves the other alone.

### Which app is asking

Both cookies live on one origin, so a browser can hold both and `GET /me` would
not know which account it was being asked about. The driver app says so on
**every** request:

```http
x-dg-space: driver
```

Without the header only the rider cookie is read, so the rider app needs no
change — and a rider cookie can never produce a driver principal, whatever else
is in the jar. The header is not in the CORS allow-list, which is deliberate: a
cross-origin page cannot ask for the driver space at all. Together with
`SameSite=Lax` on both cookies, that is the CSRF story.

---

## Account

### `GET /me`

Returns `{ audience, rider }` or `{ audience, driver }` depending on the token.

A driver profile carries what the apps need to decide what to show:

```json
{
  "audience": "driver",
  "driver": {
    "id": "65f…", "firstName": "Skander", "status": "active",
    "availability": "online",
    "rating": { "average": 4.8, "count": 37 },
    "stats": { "completedRides": 214, "earnings": 1840.25 },
    "vehicle": { "brand": "Yamaha", "model": "NMAX", "plateNumber": "123 TN 4567" },
    "balance": {
      "cashCollected": 96.5, "commissionDue": 14.475,
      "limit": 150, "blocked": false, "remaining": 53.5,
      "paidTotal": 340, "lastPaymentAt": "…", "currency": "TND"
    },
    "onboarding": {
      "ready": true, "documents": true, "license": true, "vehicle": true,
      "missingDocuments": [], "reviewReason": null
    }
  }
}
```

`onboarding` is the home screen before approval: show what is missing.
`balance` is explained under [Commission](#commission-cash-rides).

### `PATCH /me`

Riders may change `name` and `email`. Drivers may change `email` only — their
name comes from the ID document the team checked, and sending `name` returns
`403 forbidden`.

### `GET /config`

Public. Service cities with their centres and radii, the current tariff, and how
long a search lasts. Fetch it at launch; it is the same data the website shows.

---

## Riding (rider token)

### `POST /rides/estimate`

```json
{ "pickup": { "lat": 36.8, "lng": 10.18 }, "dropoff": { "lat": 36.83, "lng": 10.19 } }
```

Nothing is written, so it can be called while the rider drags a pin. A pickup
outside the service area returns `422 outsideServiceArea`.

The distance and duration are the real ones, routed along streets, and `route`
carries that path so the app can draw it. `fare.flat` is true when the ride was
short enough for the fixed short-ride price rather than the meter — say so in
the app, since it is the reason the number stops moving as the pin is nudged.

```json
{
  "estimate": {
    "city": "tunis", "distanceKm": 4.2, "durationMin": 11,
    "fare": { "base": 1, "distance": 1.89, "time": 0.55, "bookingFee": 0.2,
              "total": 3.7, "commission": 0.555, "driverEarnings": 3.145,
              "currency": "TND" },
    "cancellationFee": 1
  }
}
```

### `POST /rides`

```json
{
  "pickup": { "address": "Théâtre Municipal", "lat": 36.7992, "lng": 10.1806 },
  "dropoff": { "address": "Rue Oum Kalthoum", "lat": 36.8305, "lng": 10.1892 },
  "paymentMethod": "cash"
}
```

Prices the trip, creates the ride and starts looking for a driver. Only `cash`
is accepted today. A rider who already has a ride under way gets
`409 rideInProgress`.

### `GET /rides/{id}` — and how the search moves

This is the live channel. Poll it every few seconds while a ride is on; **the
rider's poll is also what advances the search**, so a waiting ride only moves
forward while someone is watching it.

While `status` is `requested` the ride carries a `search` object:

```json
"search": { "round": 2, "maxRounds": 4, "expiresAt": "2026-03-04T10:02:30.000Z" }
```

Each round offers the ride to the five nearest free drivers for 30 seconds.
After four rounds with no taker the platform cancels it itself
(`cancelledBy: "system"`, `cancellationReason: "no_driver_found"`).

Contact details appear only while the ride is happening: the rider sees the
driver's number and live position from `accepted` until it ends, the driver sees
the rider's number over the same window, and neither keeps it afterwards.

### `GET /rides/active`

The ride in progress or `{ "ride": null }`. Call it on launch to drop straight
back into a ride the app was closed during.

### `GET /rides?page=1&pageSize=20`

History, newest first, for whichever side the token belongs to.

### `POST /rides/{id}/cancel`

```json
{ "reason": "changed my mind" }
```

A **rider** ends the ride. Before a driver accepts it is free; once one is
riding over, the cancellation fee from the tariff applies and comes back as
`fee`. Once the rider is aboard, neither side can cancel —
`409 invalidTransition`, and that is a support matter.

A **driver** hands the ride back instead: it returns to the pool, they are not
offered it again, and the search resumes (`released: true`).

### `POST /rides/{id}/rate`

```json
{ "rating": 5 }
```

Riders only, once, on a completed ride. Folds into the driver's average.

---

## Driving (driver token)

Approval is required for everything here: a `pending`, `rejected` or `suspended`
driver can sign in and read `/me` — that is how they see where their application
stands — but gets `403 driverNotActive` on anything else.

### `POST /driver/availability`

```json
{ "availability": "online", "location": { "lat": 36.8, "lng": 10.18 } }
```

Going online needs a position: dispatch has nothing to work with otherwise. A
driver in the middle of a ride cannot go offline. Returns the updated profile.

### `POST /driver/location`

```json
{ "lat": 36.8005, "lng": 10.1791 }
```

The heartbeat, sent every 15 seconds or so while out. **A driver who stops
sending it drops out of dispatch after two minutes**, even if the app never said
goodbye — that is what stops requests going to a phone that has died.

### `GET /driver/offers`

Rides waiting for this driver's answer, nearest first.

```json
{
  "offers": [{
    "id": "65f…", "code": "DG-7F3K2Q",
    "pickup": { "address": "…", "lat": 36.8, "lng": 10.18 },
    "dropoff": { "address": "…", "lat": 36.83, "lng": 10.19 },
    "distanceKm": 4.2, "durationMin": 11,
    "earnings": 3.145, "total": 3.7, "currency": "TND",
    "pickupDistanceKm": 0.4, "expiresAt": "2026-03-04T10:02:30.000Z"
  }],
  "availability": "online", "offerSeconds": 30
}
```

Poll every few seconds while online and free. Each offer carries its own
`expiresAt`.

### `POST /rides/{id}/accept`

Several drivers see the same request, so this is a race by design: exactly one
succeeds and the rest get `409 offerExpired` — show that as "someone else took
it", not as an error.

### `POST /rides/{id}/decline`

Passes on the offer. Costs the driver nothing and keeps the search moving
instead of burning the whole window.

### The three steps

| Call | From | To |
| --- | --- | --- |
| `POST /rides/{id}/arrive` | `accepted` | `arriving` |
| `POST /rides/{id}/start` | `arriving` (or `accepted`) | `in_progress` |
| `POST /rides/{id}/complete` | `in_progress` | `completed` |

Each is refused unless the ride is in a status that step can follow, so a double
tap or a request that arrives late over a bad connection cannot skip ahead —
`409 invalidTransition`.

**`start` and `complete` both need the rider's code** — see
[Handover codes](#handover-codes).

```json
{ "code": "3449" }
```

`complete` takes the code plus, optionally, what was actually ridden:

```json
{ "distanceKm": 6.5, "durationMin": 20, "code": "3106" }
```

What was actually ridden. The ride is re-priced on it, clamped to twice the
estimate so a wrong or tampered reading can't invent a large fare. The reply
says whether it changed:

```json
{ "ride": { … }, "fareChanged": true }
```

Completing is also what credits the driver's earnings and adds the commission to
what they owe.

### `GET /driver/earnings`

Today, the last seven days, and all time — after commission, the figure they
keep. Days are counted in `Africa/Tunis`.

---

## Handover codes

A driver cannot start or finish a ride on their own word. The **rider** is given
two four-digit codes, and the driver has to be shown one to begin and the other
to close. That is what ties a completed ride — and the cash that changed hands
on it — to the two people who actually took it.

The codes reach the rider on their own ride resource, while the ride is live:

```json
"handover": {
  "start":  { "code": "3449", "qr": "DG1:6ab0…:start:3449" },
  "finish": { "code": "3106", "qr": "DG1:6ab0…:finish:3106" }
}
```

- **Riders only.** For a driver token `handover` is always `null`; sending the
  codes to the app that has to be told them would defeat the point.
- Each half becomes `null` once it has been used, so the same four digits can
  never move a ride twice.
- `qr` is the exact string the rider's QR encodes — `DG1:<rideId>:<start|finish>:<code>`.
  The driver app scans it, checks the ride id is the one it is on, and sends the
  `code`. Typing the digits does the same thing.

Wrong codes are counted. After five the code is **burned and reissued** to the
rider, and the call returns `423 handoverLocked` — the two of them are standing
together, so the answer is to read out the new one, not to abandon the ride.

| Result | Code | Meaning |
| --- | --- | --- |
| No code sent | `422 handoverRequired` | Ask the rider for it |
| Wrong code | `422 handoverWrong` | `details.remaining` tries left |
| Too many wrong | `423 handoverLocked` | A fresh code is now on the rider's screen |

Enforcement is an operator switch — **Require the rider's code** on the
backoffice pricing page. It exists for the window where the server asks for a
code and the driver app in people's hands cannot yet supply one; with it off,
the codes are still issued and still shown, but a step without one is allowed.

---

## Cash held (cash rides)

Riders pay the driver in cash, so the whole fare stays in the driver's pocket
until they settle. Two numbers track that on the driver's profile as `balance`:

```json
"balance": { "cashCollected": 96.5, "commissionDue": 14.475, "limit": 150, "blocked": false, "remaining": 53.5 }
```

`cashCollected` is the whole of every unsettled cash fare — the platform's money
in the driver's hands — and `commissionDue` is our share of it, which is what
they actually hand over.

**The limit is on `cashCollected`, not on `commissionDue`.** When the cash held
reaches the limit set on the backoffice pricing page, `blocked` turns true and
the account stops taking rides: going online and accepting both return
`403 commissionDue`, with `cash`, `due` and `limit` in `details`. The driver
settles at the office, an operator records the payment, and the account reopens
on the spot. Settling clears both numbers — a part payment lowers them by the
same fraction.

Show `remaining` while a driver is working — running into the limit mid-shift is
the thing to warn them about, not explain afterwards.

---

## Error codes

| Code | Status | Means |
| --- | --- | --- |
| `invalidRequest` | 400 | Body or query didn't validate; see `details` |
| `unauthorized` | 401 | No valid access token |
| `invalidCode` | 401 | Wrong verification code |
| `invalidRefreshToken` | 401 | Refresh token unknown, used or expired |
| `forbidden` | 403 | Token may not do that |
| `notRegistered` | 403 | No driver account for that number |
| `accountBlocked` | 403 | Rider blocked by the team |
| `driverNotActive` | 403 | Driver not approved for rides |
| `commissionDue` | 403 | Holding the maximum cash; settle first |
| `notFound` | 404 | No such resource, or not yours |
| `rideInProgress` | 409 | Already on a ride |
| `driverOffline` | 409 | Go online first |
| `offerExpired` | 409 | Another driver took it |
| `invalidTransition` | 409 | Not possible from the ride's current status |
| `alreadyRated` | 409 | This ride already has a rating |
| `codeExpired` | 410 | Verification code expired |
| `nameRequired` | 422 | New rider: send the code again with a name |
| `outsideServiceArea` | 422 | Pickup outside a city that is open |
| `rateLimited` | 429 | Slow down |
| `tooManyAttempts` | 429 | Too many tries on one code |
| `serverError` | 500 | Our fault; it's in the logs |
| `smsUnavailable` | 502 | The code could not be sent |

---

## Trying it out

```bash
npm run dev            # the API at http://localhost:3000/api/v1
npm run api:test       # signs a rider and a driver in, books a ride, finishes it
```

`npm run api:test` writes to whatever database `MONGO_URL` points at and removes
everything it created afterwards — point it at a development database, never at
production.
