# Hello Doctor

Home visits and video consultations with GPs and physiotherapists anywhere in Malta and Gozo.
CIS3186 Mobile Device Programming project (Digital Health + M-Commerce).

> Medicine delivery is **not** part of this module: the doctor issues a digital prescription that the patient takes to any pharmacy.

## Try it

Online version: GitHub Pages (link in the repository's About section).

All demo accounts use the password `hellodoctor`. The login page has buttons that fill them in.

| Role | Email | What to try |
| --- | --- | --- |
| Patient | patient@hellodoctor.test | Book the nearest doctor, choose a doctor, subscribe to a plan |
| Doctor | doctor@hellodoctor.test | Go online, accept requests, travel, write a report |
| Admin | admin@hellodoctor.test | Approve IDs, handle reports, block accounts |
| Elderly patient | carmen.pace@hellodoctor.test | 81, reduced mobility: shown first to doctors |
| Tourist | liam.oconnor@hellodoctor.test | Signed up with a passport |

Test payments (no real money): card `4242 4242 4242 4242`, any future expiry, any CVC.
Card `4000 0000 0000 0002` simulates a declined payment.

## Run it locally

Requires Node.js 20 or later.

```bash
npm install
npm run dev
```

Open http://localhost:5173. The site uses the Firebase project configured in [.env](.env).

| Command | What it does |
| --- | --- |
| `npm run dev` | Local development server |
| `npm run deploy` | Builds the site and publishes it to GitHub Pages (`gh-pages` branch) |
| `npm run deploy-rules` | Publishes [firestore.rules](firestore.rules) to Firebase * |
| `npm run seed` | Creates the demo accounts and data if they are missing * |
| `npm run reset-db -- --yes` | Deletes all data and demo accounts, then recreates the demo data * |

\* Admin scripts: they need the Firebase service account key saved as `serviceAccount.json` at the project root
(Firebase console > Project settings > Service accounts > Generate new private key). **Never commit this file**; it is in `.gitignore`.

## Features

**Patients**
- Two booking modes: *nearest available doctor* (automatic match by distance, ideal for tourists) or *choose a specific doctor* (rating, years of experience, number of consultations, arrival time, reviews).
- GP or physiotherapist, home visit or video consultation (video room via Jitsi).
- As soon as possible, or a time slot from the doctor's calendar.
- In-app payment with price breakdown, refund if the doctor declines or the visit is cancelled.
- Live tracking of the doctor on a map of Malta with countdown.
- Digital medical report and prescription after each visit (printable).
- Ratings, "book the same doctor again", reporting a problem.
- Subscription plans (Pay as you go / Care Monthly / Care Annual) that remove booking fees and give discounts.
- ID check at sign-up: Maltese ID card format checked instantly, passports reviewed by an admin.

**Doctors**
- Online/offline switch, bookable time slots, fees and services.
- Request queue sorted by priority (age 65+/75+, reduced mobility, urgency).
- Accept / decline, "on my way", "arrived", consultation report with prescription.
- Report abusive patients.

**Administrators**
- Dashboard (users, doctors online, visits in progress, payments, subscribers).
- Approve or reject identity documents and doctor registrations.
- Handle reports, block and unblock accounts.

**Accessibility (W3C mobile guidelines)**
- Atkinson Hyperlegible typeface (designed for low vision), 18px base size, larger-text switch.
- Touch targets of at least 44px, visible keyboard focus, labelled form fields, ARIA roles for tabs, switches and radios.
- Respects "reduce motion", mobile bottom navigation, permanent emergency banner (112).

## Architecture

```
client/               React 18 + React Router (Vite), hosted on GitHub Pages
  src/firebase.js     Firebase Auth + Firestore setup
  src/backend.js      Business logic: booking, matching, payments, status changes, admin
  src/api.js          api('/route') entry point used by the pages
  src/pages/          Public, Patient, Doctor, Admin, Account screens
  src/components.jsx  Map of Malta, payment form, real-time hook, shared UI
shared/               Pricing, matching/ETA, priority, payment checks, localities
firestore.rules       Security rules (the "server-side" protection)
server/               Admin scripts only (demo data, publish rules), using the Firebase Admin SDK
```

The website talks to **Firebase** directly: **Firebase Authentication** for accounts and **Cloud Firestore** for data.
There is no server of our own, so it can be hosted for free on GitHub Pages.

**Security** is enforced by the Firestore rules, checked by Google on every read and write:
- you can only read your own visits, payments and subscription; doctor profiles and reviews are public;
- you cannot change your role, approve your own ID or unblock yourself;
- a booking must start as "pending" and its price must match the doctor's fee (+10% fee, or a plan discount of at most 15%);
- only the doctor of a visit can move it forward (pending → accepted → on the way → with the patient → completed with a report), and only the patient can cancel or rate it, once;
- ID document numbers are stored in a private sub-document that only the owner and administrators can read.

**Real time**: pages subscribe to Firestore with `onSnapshot`, so a doctor sees new requests instantly and the patient sees "doctor on the way" without refreshing.

**Firestore collections** (as in our pitch, plus the m-commerce ones):

| Collection | Content |
| --- | --- |
| `users` | Patients (age, mobility, locality), doctors (`doctor` field: specialty, fees, online, rating totals), admins. Document id = Firebase Auth uid. Sub-document `private/identity` holds the ID number |
| `appointments` | Bookings: status, home/video, nearest/chosen, price, ETA, snapshot of patient and doctor, `report`, `review` |
| `reviews` | Public ratings (one per completed visit) |
| `slots` | Doctors' bookable times |
| `payments` | Consultation and subscription payments (only card brand + last 4 digits) |
| `subscriptions` | Care Monthly / Care Annual plans |
| `flags` | Reports sent to administrators |

The Firebase web configuration in `.env` is public by design (it only identifies the project); the rules protect the data.
