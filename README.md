# CampusLink

Campus web app: Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + next-intl, with its REST API in `backend/`
(Express 5 + MongoDB, see [backend/README.md](backend/README.md)). Installable PWA with an offline mode (service
worker + IndexedDB).

Features: sign-up and login (two-step verification by email, password reset), dashboard, account (profile,
language, password, push notifications, install), in-app and push notifications, the forum (carpools, lost and
found items, experiences, ideas) and, for admins, offline-first user management and the audit log.

## Getting started

Requirements: Node.js 20+ and MongoDB (local server or Atlas). npm is the package manager (`package-lock.json`,
Vercel runs `npm ci`).

```bash
# 1. API on http://localhost:4000
cd backend
npm install
cp .env.example .env         # set MONGO_URI and JWT_SECRET
npm run generate-vapid       # optional, for push notifications: paste the two lines into .env
npm run seed:demo            # optional: demo accounts and forum posts
npm run dev                  # nodemon (npm start: plain node)

# 2. Web app on http://localhost:3000 (another terminal, repository root)
cp .env.example .env.local   # API_URL=http://localhost:4000
npm install
npm run dev                  # or: npm run build && npm start
```

Demo accounts (`npm run seed:demo`): `admin@campuslink.local`, students such as `yasmine.haddad@campuslink.local`
(4TWIN1) or `skander.mejri@campuslink.local` (no group), teachers such as `amira.bensalah@campuslink.local`; every
demo account uses the password `Campus123!`.

Checks: `npx tsc --noEmit`, `npm run lint`, `npm run build`.
Parallel builds: `NEXT_DIST_DIR=.next-<name> npm run build` (folders `.next-*` are git-ignored; Next adds
`.next-<name>/types/**` to `tsconfig.json` during such a build, do not commit that change).

## Environment

| Variable                   | Default                 | Purpose                                                                              |
| -------------------------- | ----------------------- | ------------------------------------------------------------------------------------ |
| `API_URL`                  | `http://localhost:4000` | Backend base URL (server-only).                                                      |
| `APP_ORIGIN`               | unset                   | Public origin(s) of the web app, comma-separated (`https://campuslink.example`): the BFF's same-origin check compares `Origin` with it instead of the `Host` header. |
| `COOKIE_SECURE`            | production only         | `true`/`false` overrides the `Secure` flag of the cookies (server-only).             |
| `MAX_UPLOAD_MB`            | `10`                    | Same value as the backend: request bodies of the BFF and of Server Actions are capped at 5 × it + 1 MB (read when the server starts). |
| `NEXT_DIST_DIR`            | `.next`                 | Build/output folder, for side-by-side builds (tests, parallel work).                 |
| `NEXT_PUBLIC_APP_TIMEZONE` | `Africa/Tunis`          | Campus timezone of every displayed date/time (inlined at build time).               |
| `NEXT_PUBLIC_ENABLE_SW`    | unset                   | `true` registers the service worker with `next dev` too (production always does).    |
| `NEXT_PUBLIC_REALTIME_URL` | `http://localhost:4000` | Socket.IO server of `lib/realtime` (allowed by the page CSP).                         |
| `TRUSTED_PROXY_HOPS`       | `0`                     | Reverse proxies in front of Next.js that write the client address (server-only).     |

**Client IP.** Next.js keeps an `X-Forwarded-For` sent by the browser, and the backend trusts Next.js
(`TRUST_PROXY=loopback`) for the audit-log IP and the rate limits. So the web app never forwards the browser's
header: with `TRUSTED_PROXY_HOPS=0` (Next.js reached directly) it sends none: the backend sees the Next.js host
(loopback), so only the per route + email limits apply to web users (the backend does not apply its per-IP limits
to loopback callers without `X-Forwarded-For`, which would otherwise be shared by every web user). With `N > 0` it
forwards only the address written by the outermost of our N proxies (the N-th entry from the end), and the per-IP
limits apply too. Production should run behind a reverse proxy that **overwrites** the header, e.g. nginx
`proxy_set_header X-Forwarded-For $remote_addr;` with `TRUSTED_PROXY_HOPS=1`.

## How authentication works

The browser never calls the backend directly: Server Actions (`app/actions/auth.ts`), the proxy (`proxy.ts`),
Server Components and the `/bff` relay call it through `lib/api.ts`, and the tokens live in httpOnly cookies
(`lib/session.ts`):

- `cl_access`: access token (JWT). Kept for the token's lifetime with "Keep me signed in", otherwise a session cookie.
- `cl_refresh`: refresh token, 30 days with "Keep me signed in", otherwise a browser-session cookie.
- `cl_remember`: remembers that choice for later refreshes.
- `cl_owner`: the user id, readable by JavaScript (no secret), same lifetime as `cl_refresh`. The service worker
  only serves an offline copy of a page to that account, so copies die with the session cookies.
- `cl_ended`: set for 2 minutes whenever the session cookies are cleared (logout, revoked/expired session, password
  changed or reset): the next `/login` or `/signup` answer carries `Clear-Site-Data: "cache", "storage"`.

`proxy.ts` (Next 16's renamed middleware) protects `/dashboard`, sends signed-in users away from `/login` and
`/signup`, refreshes an expired access token before the page renders, and passes the current path to Server
Components (`x-cl-path`). The browser's `User-Agent` is forwarded to the backend (client IP: see above).
`/auth/expired` clears the cookies (only for same-origin navigations) when the backend rejects a token.

Nothing personal outlives a session on a shared computer:

- Logout (`components/shell/logout-button.tsx`) first clears IndexedDB, Cache Storage and this device's push
  subscription, then ends the session.
- A session that ends any other way: `/auth/expired` answers with `Clear-Site-Data: "cache", "storage"` (Cache
  Storage, IndexedDB, service worker and its push subscription, HTTP cache; cookies stay), and so does the next
  login/signup page after the cookies were cleared (`cl_ended`, see `proxy.ts`; when a Server Action redirects
  there, Next.js copies the header onto the action's answer). Browsers ignore it outside secure contexts, so the
  auth pages also clean up from JavaScript when the request had no session cookie
  (`components/offline/stale-session-cleanup.tsx`).
- When another account opens the dashboard, `adoptOwner()` drops the previous account's data, saved pages and
  push subscription.

The backend ties each push subscription to the login session that registered it and drops all of a user's
subscriptions when every session is revoked (change password). `resyncPushSubscription()` (`lib/offline/push.ts`)
registers the browser's existing subscription again for the current session (`POST /bff/push/subscriptions`,
idempotent upsert; never asks for permission, never throws): after "Change password" succeeds without two-step
verification, and once per tab session per user when the dashboard mounts online (after `adoptOwner()`,
`sessionStorage` key `cl-push-resync:<userId>`). `enablePush()` / `disablePush()` in the same file subscribe and
unsubscribe this browser (the "Notifications" switch of the account page, "This device").

## Languages (next-intl, no locale routing)

- Locale = cookie `NEXT_LOCALE` → `Accept-Language` (first of fr/en) → `fr` (`i18n/request.ts`). URLs never change.
- Messages: `messages/<locale>/<namespace>.json`, namespaces `common, landing, auth, dashboard, account, admin,
  notifications, offline` (`NAMESPACES` in `i18n/config.ts`). Keys are type-checked against the English files
  (`global.d.ts`): every key must exist in **both** `en` and `fr`. French uses "tu", warm and simple.
- Switcher: `<LanguageSwitcher />` (select labelled "Language"/"Langue"); it sets the cookie and, when signed in,
  `PATCH /api/users/me { locale }`. Signup sends the current locale; login keeps the language the user is looking
  at (cookie, else browser language, else the account's) and saves it to `user.locale` when it differs.
- Server: `const t = await getTranslations("admin.users")`; Client: `const t = useTranslations("notifications")`.
- Client Components only receive the namespaces of their route group (`components/i18n/client-messages.tsx`):
  root layout `common` + `offline`; `(front)` + `landing`; `(auth)` + `auth`; `/dashboard` + `dashboard, account,
  notifications` (`DASHBOARD_NAMESPACES`); `/dashboard/account` + `auth` (password field); `/dashboard/admin/*` +
  `admin`. A nested provider replaces the messages of its parent: when a Client Component starts using another
  namespace on a page, add it to that group's `<ClientMessages namespaces>` or the browser logs `MISSING_MESSAGE`.
  Server Components are not concerned (they read every namespace).
- The forum's texts are not in next-intl yet: they are English constants in `lib/forum/strings.ts`.
- Dates: `format.dateTime(date, "time" | "date" | "dayMonth" | "weekdayDayMonth" | "weekdayLong" | "dateTime" |
  "dayMonthTime")` (presets in `i18n/config.ts`); the formatter already uses the campus timezone (24h times).
- Backend error codes: `useErrorFormatter()` (`lib/i18n/client.ts`) / `getErrorFormatter()` (`lib/i18n/server.ts`)
  → `.message(error)`, `.fieldErrors(error)`, `.forCode(code)`; texts in `common.errors.<CODE>`.

## BFF: `/bff/[...path]`

`app/bff/[...path]/route.ts` + `lib/bff.ts` relay `/bff/<path>?<query>` to `API_URL/api/<path>?<query>`:

- adds `Authorization: Bearer <cl_access>`; refreshes the pair when the token is missing/expiring and once more on
  `401 TOKEN_EXPIRED` (new cookies set on the response). An unrecoverable 401 is returned as-is.
- `/bff/auth/*` → 404. Non-GET requests are checked in this order, before any byte of the body is read:
  1. same-origin `Origin` header, else 403 `FORBIDDEN`. The origin is compared with `APP_ORIGIN` when set,
     otherwise its host with the `Host` header; `X-Forwarded-Host` is only used behind trusted proxies
     (`TRUSTED_PROXY_HOPS > 0`, the entry written by the outermost one), since anyone can send it;
  2. a session cookie (`cl_access` or `cl_refresh`), else 401 `AUTH_REQUIRED`;
  3. a body of at most 5 × `MAX_UPLOAD_MB` + 1 MB (51 MB by default), else 413 `PAYLOAD_TOO_LARGE`:
     `Content-Length` is checked first, and the limit is enforced while the body is read (chunked uploads).
- JSON, multipart uploads and binary downloads pass through (`Content-Type`, `Content-Disposition`); responses are
  `Cache-Control: private, no-store`. Backend unreachable → 502 `NETWORK_ERROR`.

## Data layer (offline-first, Client Components)

Import from `@/lib/offline` (IndexedDB database `campuslink`: stores `cache`, `outbox`, `meta`; records are
scoped to the signed-in user by `<DataLayerProvider>` in the dashboard layout).

```tsx
"use client";
import { queueMutation, useOfflineQuery, useQueryClient, useOnlineStatus } from "@/lib/offline";

// Reads: stale-while-revalidate. Saved data first (with savedAt), then /bff/<path> when online,
// again on reconnect, on tab focus and every `refreshInterval` ms. Path relative to /api.
const { data, savedAt, isLoading, error, refresh, mutate } = useOfflineQuery<NotificationList>(
  ["notifications", "list", page],          // key: string or array ("notifications:list:1")
  `/notifications?page=${page}&limit=20`,   // null disables the query
  { refreshInterval: 0, fallbackData: undefined }
);

// Writes: sent now when online; queued in IndexedDB when offline or when the server can't be reached, then
// replayed on reconnection and by Background Sync. Last write wins per key ("<METHOD> <path>" by default).
const result = await queueMutation({ method: "POST", path: `/notifications/${id}/read` });
// result.status: "sent" (result.data) | "queued" (result.id) | "failed" (result.error: BffError, a real API error)

// Non-idempotent writes and module-owned changes (see the user management module):
await queueMutation({
  method: "POST", path: "/users", body,
  key: `POST /users#${localId}`,       // several creations can wait side by side
  scope: "users", info: { kind: "create", userId: localId, name }, // listed by useOutbox("users")
  keepRejected: true,                  // a 4xx on replay keeps the record with `rejected` instead of dropping it
});
const records = useOutbox("users");    // waiting + refused changes of the scope, kept up to date
await removeOutboxRecord(id);          // "Undo" / "Discard"
await retryOutboxRecord(id);           // send a refused change again

// Optimistic updates of other queries: useQueryClient().setQueryData(key, updater); .invalidate("notifications")
```

- **Render the first data on the server** and hand it to the hook, so a page makes no API request from the browser
  when it loads:

  ```tsx
  // page.tsx (Server Component)
  const initial = await serverSnapshot<NotificationList | null>("/notifications?page=1&limit=20", null); // lib/server-api.ts
  return <MyView initial={initial} />;
  // my-view.tsx ("use client")
  useOfflineQuery<NotificationList>(key, path, {
    fallbackData: initial.data ?? undefined,
    fallbackSavedAt: initial.savedAt, // an offline copy of an old page never overwrites newer saved data
    revalidateOnMount: !initial.data,
  });
  ```

- The fallback options belong to the key they were first passed with. When the key changes (filters, paging)
  while the same `fallbackData` object is still passed, the new key gets no fallback (it shows its own saved
  data or a skeleton, never the previous key's data) and revalidates on mount. A new `fallbackData` object passed
  together with the new key seeds that key instead.
- `bffFetch(path, { method, body })` (`@/lib/offline`) for one-off online calls (throws `BffError` with `status`,
  `code`, `details`; on 401 it sends the user to `/auth/expired`).
- Token refresh is single-flight (`lib/refresh.ts`): concurrent requests that find the access token expired share
  one `/api/auth/refresh` call (the backend rotates refresh tokens), and the new pair is reused for 30 s.
- `useOnlineStatus()`, `usePendingCount()`: connectivity and outbox size (the banner already shows both).
- Pages using `useOfflineQuery` automatically feed the banner's "Last updated <time>".
- **Mutations that can fail with an expected 4xx** (forms, conflicts, validation) and don't need to work offline
  should use **Server Actions** with `serverApi()` (`lib/server-api.ts`), not the BFF: Chromium logs every non-2xx
  `fetch` as a console error. See `app/(back)/dashboard/account/actions.ts` (two-step verification, password):
  `serverApi(path, { method, body })` (FormData = multipart), `actionSuccess(message)`, `actionFailure(error)`
  (localised; 401 → `/auth/expired`), then `refresh()` from `next/cache` to re-render the page. Offline-capable
  forms (users, profile) use `queueMutation` and validate in the browser first, so a 4xx stays rare.

Real time: `lib/realtime` (`useRealtimeEvent`, `useRealtimeRoom`, `useRealtimeStatus`) is a Socket.IO client for
the backend's real-time layer (`NEXT_PUBLIC_REALTIME_URL`; the backend emits `notification:new` to the user's open
clients). No page uses it yet, and its ticket route (`/bff/realtime/ticket` → `GET /api/realtime/ticket`) is not
mounted in the backend yet.

## Offline mode / PWA

- `app/manifest.ts` (`/manifest.webmanifest`): name "CampusLink", start_url `/dashboard`, standalone,
  theme `#253C6D`, icons 192/512 + maskable in `public/icons/`, shortcuts to the forum, the notifications, the
  account and (admins) the users page.
- Install: `lib/pwa/install.ts` keeps the browser's `beforeinstallprompt` (imported by the root layout's service
  worker registrar, so it is caught early); the account page offers "Install CampusLink" (iOS: "Add to Home Screen" hint).
- App icon badge (`lib/pwa/badge.ts`, `components/pwa/app-badge.tsx` in the shell): the unread notifications count,
  or a dot when only changes wait to sync; the service worker also sets it from a push's `data.unreadCount`.
- `public/sw.js`, scope `/`, registered in production builds (or `NEXT_PUBLIC_ENABLE_SW=true`) by
  `components/pwa/service-worker-registrar.tsx`; in dev without the flag any old worker is unregistered.
  - precache `/offline` (+ its static files) and the icons; cache-first for `/_next/static/*`, fonts, icons;
  - network-first for navigations (6 s timeout when a copy exists) → cached page → `/offline`; pages reached by
    client-side navigation are saved in the background (`CACHE_PAGE` message, at most every 10 min per URL; these
    requests carry `x-cl-background: 1` and the proxy never refreshes tokens for them);
  - saved pages (Cache Storage `campuslink-pages-v2`): only `/` (public) and `/dashboard`,
    `/dashboard/notifications`, `/dashboard/forum(/<id>)`, `/dashboard/account` and `/dashboard/admin/users` (the
    user management module), never the other admin pages. A private page saved in the background also gets its
    route's static files cached, so a full offline reload starts. Each copy carries its owner (`x-cl-owner`, set by
    `proxy.ts` from the token) and is served only to that account: the `cl_owner` cookie (Cookie Store API), or the
    IndexedDB owner where that API is missing. Copies older than 24 h or belonging to another account are deleted;
  - never caches `/bff/*`, `/api/*`, `/auth/*`, the auth pages, Server Actions or non-GET requests;
  - `push` → notification (`title, body, icon, badge, tag, data.link`) + app badge (`data.unreadCount`),
    `notificationclick` → focus/open the link, `sync` (`campuslink-outbox`) → replays the outbox (same rules as the
    page: refused `keepRejected` records are kept with `rejected`), `periodicsync` (`campuslink-users-directory`) →
    saves a fresh copy of the admin's user directory in IndexedDB (403 → copy deleted, sync unregistered).
- Logout also unregisters the periodic syncs and clears the app badge (`lib/offline/cleanup.ts`).
- `/offline`: public fallback page with links to the saved home, forum and notifications pages.
- Connectivity banner (`role="status"`, outside `<main>`): "You're offline. Showing saved data." + "Last updated
  <time>" + "<n> changes waiting to sync".
- We do not enable `experimental.useOffline`: it would keep failed navigations pending, whereas the service
  worker answers them with the saved page (full offline reloads need the worker anyway).
- Links: import `Link` from `@/components/ui/app-link` (same props as `next/link`), not from `next/link`. It turns
  prefetching off while offline (`prefetch={false}`), so the shell and the lists do not flood the console with
  `net::ERR_INTERNET_DISCONNECTED`; prefetching resumes when the connection is back.
- Try it: `npm run build && npm start`, open the app once, then DevTools > Network > Offline and reload.

## App shell and pages

`app/(back)/dashboard/layout.tsx` → `components/shell/app-shell.tsx`: sidebar (≥ lg) / top bar + bottom
navigation (phones), `nav` "Main navigation" (Home, Notifications + unread badge, Forum, Account) and an
"Administration" group for ADMIN (Users, Audit log), see `components/shell/nav-items.ts`.

| Page | Who | What |
| ---- | --- | ---- |
| `/` | anyone | landing page |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | guests | authentication (Server Actions in `app/actions/auth.ts`) |
| `/dashboard` | signed in | welcome, unread notifications widget, "Your account" |
| `/dashboard/notifications` | signed in | notifications, "Mark all as read" (offline-capable) |
| `/dashboard/forum`, `/new`, `/<id>` | signed in | the forum, see below |
| `/dashboard/account` | signed in | profile (offline-capable), language, two-step verification, password, this device (push, install) |
| `/dashboard/admin/users` | ADMIN | offline-first user management, see below |
| `/dashboard/admin/audit` | ADMIN | audit log with an "Action" filter |
| `/offline` | anyone | offline fallback |

Role guard: `const { user, error } = await requireRole(["ADMIN"])` (`lib/dal.ts`) redirects other roles to
`/dashboard`. `getCurrentUser()` loads the user once per request (shared by the layout and the page).

- `/dashboard`: "Your account" is a `<dl>` of `<div><dt/><dd/></div>` groups (the icon sits inside the `<dt>`);
  the role's raw value is on its `<dd data-role>`.
- `/dashboard/admin/audit`: the "Action" column shows a readable label (`admin.audit.actionLabels.<code>`, FR/EN,
  e.g. "User created" / "Utilisateur créé") with the raw code under it; unknown codes are shown as they are. The
  "Action" filter offers the actions the backend records (option values stay the codes, `?action=user.create`).

## Forum

Files: `app/(back)/dashboard/forum/`, `components/forum/`, `lib/forum/`; API: `backend/routes/forumRoutes.js`
(see the backend README).

- `/dashboard/forum` (`feed.tsx`): search, filters by type (Carpool, Lost & found, Experience, Idea) and status
  (Active, Closed, Resolved), pages of 8 with "Load more". Each post is a `PostCard` (`post-card.tsx`): author,
  type and status badges, trip or item details (`post-media.tsx`), tags, likes, views and the comments thread
  (`comments-thread.tsx`).
- `/dashboard/forum/new` (`post-form.tsx`): type, then its details (trip: from, to, date, seats, price or free;
  item: lost or found, what, where, when), title, description, location and up to 5 tags, checked in the browser
  before `POST /bff/posts`.
- `/dashboard/forum/<id>` (`post-detail.tsx`): the post, its comments and their replies, likes/comments/views.
- Permissions: every signed-in user reads and posts. Closing, reopening, resolving and deleting a post, and deleting
  a comment, belong to its author and to ADMINs: the pages get the signed-in user from the server (`viewer`,
  `canManage()` in `lib/forum/format.ts`) and only show those actions to them; the API checks again (403
  `FORBIDDEN`).
- Calls go from the browser through the BFF (`lib/forum/bff.ts`, errors read from the API's `{ error, code }`);
  the forum does not use the offline data layer, but the service worker saves its pages.

## User management (offline-first)

Files: `app/(back)/dashboard/admin/users/` (`page.tsx`, `users-manager.tsx`, `user-dialog.tsx`),
`app/(back)/dashboard/account/` (`account-view.tsx`, `device-settings.tsx`, `actions.ts`), `lib/users/`
(`directory.ts`: pure functions, `mutations.ts`), `lib/pwa/`; API: `/api/users`, `/api/users/directory`,
`/api/push`, `/api/notifications` (backend README).

**Users page (ADMIN).** The whole directory (`GET /bff/users/directory`, every account, at most 5000) is rendered
on the server for the first paint, then kept on the device by `useOfflineQuery(["users", "directory"])` with the
groups (`["academic", "groups"]`). Search (accent-insensitive), role filter, role counts, paging (20) and the CSV
export all run on that copy, so they work the same online and offline; the filters live in the URL
(`?q=&role=&page=`, `history.replaceState`, no server round trip).

- Changes go through the outbox (`lib/users/mutations.ts`), sent at once when online, kept on the device when
  offline: create (`POST /users`, key `POST /users#local-<uuid>`: several can wait), edit (`PATCH /users/:id` with
  the whole form, so a later edit replaces a waiting one), delete (`DELETE /users/:id`; it also drops a waiting
  edit of that user). Editing an account created offline rewrites its waiting creation (keeping its password);
  deleting one just drops it.
- Layout (`user-list.tsx`): cards below 1280 px (one column on phones, two from 768 px; on phones the role chips,
  with "All roles", replace the role select), a table above. Both carry the same `data-*` attributes.
- What the admin sees is the saved directory with the waiting changes applied on top (`applyChanges()`): rows
  `tr[data-user-id][data-state="synced|pending|rejected"][data-change="create|update|delete"]` (cards:
  `li[data-user-id]…`) with "Waiting to
  sync" / "Change waiting to sync" / "Will be deleted" (struck through) and "Undo". The cached directory itself is
  never modified, so a refetch can't hide a waiting change.
- Refused on replay (4xx, e.g. `EMAIL_TAKEN`): the change stays (`keepRejected`) and shows in "<n> changes couldn't
  be applied" with the reason and Edit (form pre-filled with the refused values) / Retry / Discard; the row gets
  "Not applied".
- Status line `[data-testid="users-offline-status"]`: "<n> accounts saved on this device · updated <time>" (+ the
  offline explanation) and the Periodic Background Sync state ("Refreshed in the background" when the installed app
  got the permission, refreshed every 12 h by the service worker).
- "Export CSV" (UTF-8 with BOM, formula-safe cells) of the filtered rows, built on the device; "Share" (Web Share
  API with files) where supported.
- Privacy: an admin's device keeps the directory (names, emails, roles, groups) and, until it syncs, the initial
  password of an account created offline. Everything is scoped to the account and wiped at logout or when the
  session ends (see "How authentication works").

**Account page.** Profile changes go through the outbox (`PATCH /users/me`, key `PATCH /users/me#profile`, scope
`account`): offline they wait on the device, the form shows them with "Change waiting to sync", and the page is
rendered again once they are sent (by the page or by Background Sync). Two-step verification, password and
language need the server: disabled offline with "Needs a connection." "This device": push notifications switch,
"Install CampusLink", what stays available offline.

**Notifications** (backend, type `ACCOUNT`, in-app + push): the user when an admin changes their role, group or
password (sent before the sessions and push subscriptions are revoked); every admin on a public sign-up (link
`/dashboard/admin/users?q=<email>`).

## Security

- Headers (`next.config.ts`): `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `X-Content-Type-Options: nosniff`, `Permissions-Policy` (camera and microphone off, geolocation for this origin
  only) on every answer; in production builds also `Strict-Transport-Security: max-age=63072000; includeSubDomains`
  (browsers ignore it on plain-http answers such as local test runs). `/sw.js` has its own policy
  (`default-src 'self'; script-src 'self'`).
- Content-Security-Policy of the pages (`lib/csp.ts`), set by `proxy.ts` with a new nonce for every request. The
  policy is also put on the forwarded request: Next.js reads the nonce there and adds it to its scripts, its
  stylesheet links and its inline styles. Production policy:

  ```
  default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'; style-src 'self' 'unsafe-inline';
  style-src-elem 'self' 'nonce-…'; style-src-attr 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self';
  connect-src 'self' <realtime origin> <its ws(s) origin>; worker-src 'self'; manifest-src 'self'; object-src 'none';
  base-uri 'self'; form-action 'self'; frame-ancestors 'none'
  ```

  - Scripts: only those carrying the nonce, and what they load (`'strict-dynamic'`). No inline `<script>` or
    `eval` anywhere; if one is ever needed, forward the nonce from `proxy.ts` (e.g. an `x-nonce` request header)
    and put it on the tag.
  - Styles: `<style>`/`<link>` elements need the nonce or this origin. Radix dialogs, sheets and menus add a
    `<style>` element while open (react-remove-scroll): `components/security/style-nonce.tsx` (root layout) hands
    the page nonce to `get-nonce`. `style="…"` attributes stay allowed. `style-src` is the fallback of browsers
    without `style-src-elem/-attr`.
  - `next dev` adds `'unsafe-eval'` (React debugging), allows inline styles (Turbopack injects `<style>` tags) and
    local WebSockets (`ws://localhost:*`, `ws://127.0.0.1:*`).
  - Nonces need dynamic rendering: every page is (the root layout reads the locale cookie). A statically
    prerendered page (`○` in the build output) would have no nonce and its scripts would be blocked.
  - The matcher of `proxy.ts` covers every page (all paths except `/_next/static`, `/_next/image`, `/bff/`,
    `/api/`, `/icons/`, `/sw.js`, `/manifest.webmanifest`, `/favicon.ico`, `/logo.png` and link prefetches); only
    `/dashboard/*`, `/login` and `/signup` run the session logic.
  - Pages saved by the service worker keep the policy and the nonce they were rendered with (both are stored), so
    they still start offline.
- Request bodies: the BFF refuses non-GET requests without a session cookie (401) and bodies over 5 ×
  `MAX_UPLOAD_MB` + 1 MB (413) before reading them (see "BFF"). Server Actions: `serverActions.bodySizeLimit` and
  `proxyClientMaxBodySize` use the same limit (`"51mb"` by default). Server Action POSTs of `/dashboard` pages go
  through `proxy.ts` (token refresh), which only buffers `proxyClientMaxBodySize` bytes (10 MB by default: larger
  uploads would reach the action truncated, "Unexpected end of form").

## Conventions

- UI primitives (`components/ui/`, token-based, dark-mode ready, accessible):
  `Button` (`asChild`), `Badge` (pill: default/secondary/neutral/highlight/success/warning/danger/outline),
  `Card*`, `Dialog*`, `ConfirmDialog` (alert-dialog.tsx), `DropdownMenu*`, `Popover*`, `Tooltip`, `Tabs*`,
  `Table*`, `Select` (native `<select>`, also `multiple`), `Checkbox`/`CheckboxField` (native), `RadioGroup`
  (native radios in a fieldset), `Switch`, `Input`, `Textarea`, `Label`, `Field` (label + hint + error wiring, render
  prop: `{(props) => <Input {...props} />}`), `InlineFeedback` + `useFeedback()` + `fromActionState()`,
  `EmptyState`, `Skeleton`/`SkeletonList`, `PageHeader` (the page's h1), `Pagination` (server), `Sheet`. Icons:
  `lucide-react` (line icons). File names are lower case (`field.tsx`, `button.tsx`): imports are case-sensitive on
  Linux (Vercel) and in Turbopack, even on Windows.
- Messages: same keys in `messages/en/*.json` and `messages/fr/*.json`.
- Time: `lib/datetime.ts` (`dateKey`, `timeKey`, `todayKey`, `zonedTimeToUtc("2026-10-08", "08:30")`,
  `addDays`, `startOfWeek` (Monday), `startOfMonth`, `formatTimeRange` → "08:30–10:00"), all in the campus timezone.
- Feedback: at most one `role="status"` and one `role="alert"` inside `<main>` at a time (tests look them up there).
  Dialogs are portals (outside `<main>`): report the outcome of a dialog action in the page.

## Deployment

Web app on **Vercel** (`vercel.json`, `.vercelignore` leaves `backend/` out), API on **Render** (`render.yaml`, root
directory `backend`), database on **MongoDB Atlas** (free M0).

- Render's free plan sleeps after 15 minutes without traffic (the next request waits ~1 minute) and blocks SMTP
  ports: emails go through Brevo's HTTPS API (`BREVO_API_KEY`, `MAIL_FROM_EMAIL` = a sender verified in Brevo).
- Atlas: a database user, Network Access `0.0.0.0/0` (Render's free plan has no fixed outgoing IP), and the
  connection string `mongodb+srv://<user>:<password>@<cluster>/campuslink?retryWrites=true&w=majority` as `MONGO_URI`.
- Order: Atlas, then Render (API URL `https://<service>.onrender.com`), then Vercel (web URL), then put each URL in
  the other's settings and redeploy the web app (`NEXT_PUBLIC_*` values are inlined at build time).

| Render (API) | Value |
| ------------ | ----- |
| `NODE_ENV` | `production` |
| `MONGO_URI` | Atlas connection string |
| `JWT_SECRET` | long random string (`render.yaml` generates one) |
| `CORS_ORIGINS`, `APP_URL` | the web app's URL |
| `PUBLIC_API_URL` | the API's URL |
| `TRUST_PROXY` | `4`: Render's load balancer, Cloudflare (Render's edge), the Vercel function and the address it forwards; check below |
| `STORAGE_DRIVER` | `gridfs` (no persistent disk) |
| `BREVO_API_KEY`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME` | Brevo key and verified sender |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `npm run generate-vapid`, `mailto:<your email>` |

| Vercel (web app) | Value |
| ---------------- | ----- |
| `API_URL`, `NEXT_PUBLIC_REALTIME_URL` | the API's URL |
| `NEXT_PUBLIC_APP_TIMEZONE` | `Africa/Tunis` |
| `TRUSTED_PROXY_HOPS` | `1` (Vercel writes the client address in `X-Forwarded-For`) |

- Demo data: `npm run seed:demo` from `backend/` with `MONGO_URI` set to the Atlas string (it refuses
  `NODE_ENV=production`, so run it from your machine).
- Client IP: as an admin, open `/bff/audit/request-info` on the web app: `ip` must be your own address (it is the
  address recorded in the audit log and used by the per-IP rate limits). If it shows another address, adjust
  `TRUST_PROXY` on Render using `forwardedFor`: through the web app it reads `<you>, <Vercel>, <Cloudflare>,
  <Render load balancer>`, hence 4. Callers of the API itself (not through the web app) have one entry less, so
  they can put any address in `X-Forwarded-For`: only the per-IP limits are affected, the per-email limits still apply.

## Notes for end-to-end tests

- Next.js adds a hidden route announcer with `role="alert"`; scope alert lookups to the page,
  e.g. `page.getByRole('main').getByRole('alert')`. The connectivity banner (`role="status"`) is outside `<main>`.
- On pages with several password fields use `getByLabel('Password', { exact: true })`
  (account page: `getByLabel('New password', { exact: true })`).
- The dashboard shows the role as a label ("Student"); the raw value is in `[data-role]`.
- Selects are native: `getByLabel('Language').selectOption('fr')`. The shell hides its own language select on
  `/dashboard/account`, so the page's "Language" select is the only one there.
- French UI in a test: set the `NEXT_LOCALE=fr` cookie or use a `fr-FR` browser locale (login keeps the browser's
  language, so accounts created by the API with the default `locale: "fr"` still see English in Chromium en-US).
- Offline tests (`next start`): a saved page is only served while the `cl_owner` cookie exists, so a test that
  injects `cl_access`/`cl_refresh` itself must open a dashboard page online first (the proxy then sets
  `cl_owner`). After a session ends, `Clear-Site-Data` also unregisters the service worker; the next route change
  registers it again.
- A CSP violation is logged as a console error ("Refused to …" / "violates the following Content Security Policy
  directive").
