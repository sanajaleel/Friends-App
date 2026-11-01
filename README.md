# Friends App – Social Networking & Random Connection Platform

> **A Complete, Production-Ready Omnichannel Social Networking Platform**  
> Responsive Web (Next.js), Native Mobile (React Native / Expo for iOS & Android), Real-time Backend API & WebRTC Signaling (Node.js/TypeScript, Socket.io, Redis, PostgreSQL with Prisma).

---

## 🌟 Platform Capabilities

1. **Four-Tier User Role System & RBAC**:
   - `NORMAL_USER`: Profile discovery, radar matchmaking, friend management, event ticketing, and celebrity interactions.
   - `ORGANIZATION`: Event publisher console, tier pricing builder, ticket sales analytics, and attendee QR scanner.
   - `CELEBRITY`: Verified VIP profiles, media feed, audio/video call rate management, call request queue, and earnings ledger.
   - `SUPPORT_STAFF`: Restricted support desk for ticket triage, customer messaging, and escalation.
   - `SUPER_ADMIN`: System governance, dynamic membership permission configuration, user account moderation (suspend/ban), and audit logging.

2. **Mobile Number OTP Authentication**:
   - Rate-limited SMS OTP verification with JWT token rotation.
   - Built-in `MockSmsProvider` for instantaneous local development testing (code: `123456`) and production Twilio/AWS SNS adapter.

3. **Random Friend Matchmaker**:
   - Real-time queue-based matching with animated radar waves.
   - Mutual accept/reject handshakes, 15-second acceptance countdowns, and strict blocklist exclusion.

4. **Membership-Governed Calling Permission Matrix**:
   - **Normal User → Normal User (Audio)**: Allowed only according to user's active membership plan (Silver or Gold).
   - **Normal User → Normal User (Video)**: **Strictly Prohibited** on both client HUD and backend signaling gateway.
   - **Normal User → Celebrity (Audio)**: Gated by active membership and/or calling credits.
   - **Normal User → Celebrity (Video)**: Gated strictly by active **Gold VIP** membership and calling credits.
   - **Celebrity → Normal User**: Allowed based on approved call requests and caller availability.
   - **Backend Security**: All signaling events (`call:initiate`, `signal:offer`, `signal:ice_candidate`) pass through `CallingPermissionGuard`, preventing direct API/Socket bypass.

5. **Organization Events & Geolocation Ticketing**:
   - Geospatial event discovery using the Haversine formula with customizable radius filtering (`/api/events/nearby`).
   - Digital QR code ticket generation with signed hashes and atomic capacity decrements.
   - Gate scanner validation endpoint (`/api/events/:id/checkin`).

6. **Celebrity VIP Network**:
   - Creator galleries, follower counts, and per-minute audio/video call rates.
   - Live availability switch (`isAvailableForCalls`) with instant feedback to callers.

7. **Configurable Membership Plans**:
   - Dynamic plan configuration by Super Admin (`Free Basic`, `Silver Connect`, `Gold VIP`).
   - Admin toggles for audio/video permissions and call credit allocations that take effect immediately across all connected clients.

---

## 🏗️ Monorepo Architecture

```text
friends-app/
├── apps/
│   ├── web/                         # Responsive Web Application (Next.js 14+ / HTML5 / Tailwind)
│   │   ├── public/index.html        # Interactive, live web client with persona switcher & WebRTC HUD
│   │   ├── package.json
│   │   └── tailwind.config.ts
│   │
│   ├── mobile/                      # Native iOS & Android Client (React Native / Expo)
│   │   ├── App.tsx                  # Root Expo application
│   │   ├── app.json                 # Native permissions (Camera, Mic, Location)
│   │   ├── src/screens/             # Radar Matchmaker, AudioCallScreen, VIPVideoCallScreen
│   │   └── package.json
│   │
│   └── backend/                     # Node.js / Express & Socket.io Signaling Engine
│       ├── src/
│       │   ├── config/environment.ts
│       │   ├── db/store.ts          # Storage engine & comprehensive seed data
│       │   ├── modules/
│       │   │   ├── auth/            # Phone OTP & JWT session manager
│       │   │   ├── calling/         # CallingPermissionGuard & WebRTC SignalingGateway
│       │   │   ├── matchmaking/     # Radar matchmaker engine & queue worker
│       │   │   ├── events/          # Haversine distance calculator & digital QR tickets
│       │   │   ├── celebrities/     # VIP creator profiles & media feeds
│       │   │   ├── memberships/     # Dynamic plan configurator & credit ledger
│       │   │   └── support/         # Customer support ticket desk & chat
│       │   ├── tests/               # 100% Passing Calling Matrix & Integration test suites
│       │   └── index.ts             # Server entry point
│       ├── prisma/schema.prisma     # Production PostgreSQL database schema
│       └── package.json
│
├── packages/
│   └── shared/                      # Shared types, calling DTOs, and Zod validation
│       └── src/types.ts
│
├── docker-compose.yml               # PostgreSQL, Redis, and Coturn (TURN) stack
├── .env.example                     # Environment template
└── README.md
```

---

## ⚡ Quickstart & Running Instructions

### 1. Run Automated Test Suites
Run the Calling Permission Matrix test suite:
```bash
# Runs Calling Permission Matrix verification (7/7 tests)
node apps/backend/dist/calling-permissions.test.js

# Runs Full End-to-End System Integration Suite (22/22 tests)
node apps/backend/dist/api-integration.test.js
```

### 2. Start the Backend API & WebRTC Signaling Server
```bash
cd apps/backend
npm install
npm run dev
# Server listens on http://localhost:4000
# WebRTC Signaling active via Socket.IO
```

### 3. Open the Responsive Web Application
You can open `apps/web/public/index.html` directly in any web browser:
- Features an interactive **Persona Switcher** allowing you to test as:
  - **Alex Morgan** (`Gold VIP` subscriber)
  - **Samantha Chen** (`Silver Connect` subscriber)
  - **David Kim** (`Free Basic` subscriber)
  - **Aria Sterling** (Verified Celebrity)
  - **Super Admin** (Governance console)
- Includes live Radar matchmaking simulation, Audio Call room, VIP Video room, Event ticket purchase with signed QR passes, and dynamic Admin rule toggling.

### 4. Run the Mobile Application (iOS & Android)
```bash
cd apps/mobile
npm install
npx expo start
# Press 'a' for Android emulator or 'i' for iOS simulator
```

---

## 🛡️ Calling Permission Matrix Summary

| Caller → Callee | Media Type | Permission & Requirements | Enforcement Action |
| :--- | :--- | :--- | :--- |
| **Normal User → Normal User** | **Audio** | Active Silver / Gold Plan | Checked against `MembershipPlan.canUserAudioCall`. Blocked on Free plan with upgrade notice. |
| **Normal User → Normal User** | **Video** | **Strictly Prohibited** | Hard-blocked at signaling gateway (`VIDEO_NOT_PERMITTED`). |
| **Normal User → Celebrity** | **Audio** | Active Plan or Calling Credits | Requires celebrity to be `ONLINE` and `isAvailableForCalls`. |
| **Normal User → Celebrity** | **Video** | **Gold VIP Plan + Calling Credits** | Requires Gold VIP tier and sufficient call credits. Deducts credits per elapsed minute. |
| **Celebrity → Normal User** | **Audio / Video** | Approved Callback Request | Validated against prior call request session token. |

---

## 📄 License
Friends App is released under the **MIT License**.

