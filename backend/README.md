# CampusLink backend

REST API of CampusLink (Express 5 + Mongoose 9, CommonJS). The web app (repository root) and a future mobile app
use the same API: tokens travel in JSON bodies and `Authorization: Bearer` headers, never in cookies.

## Run

```bash
cd backend
npm install
cp .env.example .env        # then set MONGO_URI and JWT_SECRET (see the comments in the file)
npm run generate-vapid      # optional: web push keys, paste the lines into .env
npm run seed:demo           # optional: demo accounts and forum posts
npm run dev                 # nodemon; `npm start` runs plain node (production)
```

| Script                   | What it does                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `npm run dev`            | Starts the API on `PORT` (default 4000) with nodemon (restarts on changes).                     |
| `npm start`              | Same with plain `node` (production).                                                            |
| `npm run create-admin -- <email> <password> [firstname] [lastname]` | Creates an ADMIN, or promotes an account and sets its password. |
| `npm run generate-vapid` | Prints a new VAPID key pair for `.env` (`-- --json` prints `{ publicKey, privateKey }`).       |
| `npm run seed:demo`      | Demo data (refuses `NODE_ENV=production`, idempotent). Every demo account uses `Campus123!`.  |

Environment variables are documented in [`.env.example`](.env.example). Values already set in the shell take
precedence over `.env` (tests rely on this).

Useful settings for automated tests: `RATE_LIMIT_ENABLED=false`, `MAIL_OUTBOX_FILE=<file>` (emails as JSON
lines), `PUSH_OUTBOX_FILE=<file>` (pushes as JSON lines instead of sending them), `SCHEDULER_INTERVAL_MS=<ms>`,
`STORAGE_DIR=<dir>`, `SEED_PLUGINS_DIR=<dir>` (other folder of seed plugins).

## Layout

```
app.js                 Express app; start() connects MongoDB, creates indexes, starts Socket.IO and the scheduler
routes/                one router per prefix (/api/auth, users, academic, notifications, push, audit; forum: /api/posts, /api/comments)
controllers/           request handlers
models/                Mongoose models (model names are part of the contract)
service/               services (mail, tokens, notifications, push, audit, storage, scheduler, realtime)
middleware/            requireAuth/requireRole, upload, rateLimit, logger, errorHandler
utils/                 HttpError, validation, env, time (campus timezone), serialize, pushEndpoint
scripts/               create-admin, generate-vapid, seed-demo (+ scripts/seed/*.js plugins)
logs/operations.log    request log of state-changing calls, secrets redacted (git-ignored)
```

## API

| Endpoint | Who | Answer |
| -------- | --- | ------ |
| `GET /api/health` | anyone | `{ status: "ok" }` |
| `POST /api/auth/signup`, `/login`, `/verify-otp`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password` | anyone | session (`{ user, accessToken, refreshToken }`) or OTP challenge, see `controllers/authController.js` |
| `POST /api/auth/change-password` | signed in | revokes every session |
| `GET /api/users/me`, `PATCH /api/users/me { firstname, lastname, twoFactorEnabled, locale }` | signed in | the user |
| `GET /api/users?q&role&page&limit`, `GET /stats`, `POST /`, `GET/PATCH/DELETE /:id` | ADMIN | user management |
| `GET /api/users/directory` | ADMIN | `{ items, total, truncated }`: every user (at most 5000), by last name: the web app's offline copy |
| `POST /api/users/import { importId, source?, dryRun?, users: [{ row, firstname, lastname, email, password, role?, group? }] }` | ADMIN | bulk creation, see "User model" |
| `GET /api/academic/groups` | ADMIN | groups with `studentCount` |
| `GET /api/notifications?page&limit&unread=true` | signed in | `{ items, total, page, limit, unreadCount }`, newest first |
| `GET /api/notifications/unread-count` | signed in | `{ count }` |
| `POST /api/notifications/:id/read`, `POST /api/notifications/read-all` | signed in | `204` (idempotent) |
| `GET /api/push/vapid-public-key` | anyone | `{ publicKey }`, `503 PUSH_DISABLED` without VAPID keys |
| `POST /api/push/subscriptions` | signed in | `{ type: "web", endpoint, keys: { p256dh, auth } }` or `{ type: "fcm", token }`: upsert, `201`/`200` |
| `DELETE /api/push/subscriptions { endpoint }` | signed in | `204`, only the user's own subscription |
| `GET /api/audit?action&actor&targetType&targetId&from&to&page&limit`, `GET /api/audit/actions` | ADMIN | audit log, newest first |
| `/api/posts`, `/api/comments/:id` | signed in | forum, see below |

## Conventions

- Errors: `throw new HttpError(status, CODE, 'English message', details?)` anywhere in a handler (Express 5
  forwards async errors). The error handler answers `{ error, code, details? }` and turns Mongoose errors into
  `400 VALIDATION_ERROR` (details per field), `400 INVALID_ID` (cast errors) and `409 ALREADY_EXISTS`
  (`details.field`, duplicate key). Unknown errors give `500 INTERNAL_ERROR` without the stack.
- Every model has a `toJSON` transform: string `id`, no `_id` / `__v` / secrets. Send documents with `res.json(doc)`.
  Exception: the forum sends `_id` (its web client reads `_id`), and never `likes` (who liked a post).
- Paginated lists: `{ items, total, page, limit }` (`parsePagination`, limit max 100).
- Dates are stored in UTC; anything "per day / per week" uses `APP_TIMEZONE` through `utils/time.js`.
- Look up an optional model with `mongoose.models.<Name>` and check that it is registered.

## Sessions and rate limiting — `/api/auth`

- **Sessions.** Login, signup and verify-otp open a session: one `RefreshToken` document (SHA-256 of the token)
  with a random `sessionId`. The access token carries it as the `sid` claim (`req.sessionId`). `POST /refresh`
  rewrites that document in place (new token hash and expiry, single-use as before), so the session keeps its
  `sessionId`; a session opened before session ids existed gets one on its next refresh. `POST /logout` deletes the
  session, its push subscriptions and closes its real-time (Socket.IO) connections. Password change/reset, admin
  password changes and account deletion revoke every session, push subscription and real-time connection of the
  user (`tokenService.revokeAllRefreshTokens`); a role change closes the user's real-time connections too
  (`realtime.disconnectUser`).
- **Rate limits** (`middleware/rateLimit.js`, in memory, per instance): every limiter answers
  `429 TOO_MANY_REQUESTS` with a `Retry-After` header and `details.retryAfter` (seconds), and is skipped with
  `RATE_LIMIT_ENABLED=false`. The client IP is `req.ip` (`TRUST_PROXY`).

| Routes | Key | Limit per `RATE_LIMIT_WINDOW_MS` (default 15 min) |
| ------ | --- | ------------------------------------------------- |
| `signup`, `login`, `verify-otp`, `forgot-password` (each) | route + IP + normalized email | `RATE_LIMIT_AUTH_MAX` (20) |
| the same four routes together | IP (not applied to loopback callers without `X-Forwarded-For`) | `RATE_LIMIT_IP_MAX` (100) |
| `change-password` | signed-in user | `RATE_LIMIT_PASSWORD_MAX` (10) |
| `reset-password` | IP (not applied to loopback callers without `X-Forwarded-For`) | `RATE_LIMIT_RESET_MAX` (20) |

Other per-user limits are built with `userRateLimit({ name, limitEnv, defaultLimit, windowEnv, defaultWindowMs, skip })`
from `middleware/rateLimit.js`, mounted after `requireAuth`.

The per-email limiter runs before the per-IP one, so requests it refuses do not use up the budget of everyone
behind the same address (campus NAT). `refresh` and `logout` are not limited.

The two IP-only limiters are not applied when `req.ip` is a loopback address (`127.0.0.0/8`, `::1`,
`::ffff:127.x.x.x`), i.e. a caller on this host that sent no `X-Forwarded-For`: the Next.js web app relays every
browser from loopback, and without a forwarded client address one counter would be shared by all web users (one
person sending bad logins would lock everyone out). Such requests keep the route + IP + email limit. Set
`TRUSTED_PROXY_HOPS` on the web app so it forwards the client IP (production: nginx in front of Next.js and
`TRUSTED_PROXY_HOPS=1`, see the root README); behind a proxy that writes `X-Forwarded-For`, `req.ip` is the real
client and the per-IP limits apply to web users and to direct API clients (mobile app) alike.

## Forum — `/api/posts`, `/api/comments`

Code: `models/Post.js`, `models/Comment.js`, `controllers/postController.js`, `controllers/commentController.js`,
`routes/forumRoutes.js` (mounted at `/api`). Every route needs a signed-in user.

| Endpoint | Who | Answer |
| -------- | --- | ------ |
| `GET /api/posts?type&status=active\|closed\|resolved\|all&q&tag&author&sort=recent\|popular&page&limit` | any | `{ posts, page, pages, total }` (status defaults to `active`, limit max 50) |
| `POST /api/posts` | any | `201` post |
| `GET /api/posts/me` | any | the user's own posts |
| `GET /api/posts/:id[?view=0]` | any | post; counts a view unless `view=0` |
| `PUT /api/posts/:id` | author, ADMIN | post (title, description, tags, images, location, covoiturage, objetPerdu, status) |
| `PATCH /api/posts/:id/status { status }` | author, ADMIN | post |
| `DELETE /api/posts/:id` | author, ADMIN | `204`, with its comments |
| `POST /api/posts/:id/like` | any | `{ liked, likesCount }` (atomic toggle) |
| `GET /api/posts/:id/comments?page&limit` | any | `{ comments, page, pages, total }`, oldest first |
| `POST /api/posts/:id/comments { content, parent? }` | any | `201` comment; `parent` must be a top-level comment of the post (one level of replies) |
| `DELETE /api/comments/:id` | author, ADMIN | `204`, with its replies (`commentsCount` follows) |

- Types: `covoiturage` (needs `covoiturage.departure`, `destination`, `departureDate`, `seats`), `objet_perdu`
  (needs `objetPerdu.kind`: `perdu` | `trouve`), `experience`, `idee`. Statuses: `active`, `closed`, `resolved`.
- Authors are populated as `{ _id, firstname, lastname }` (`null` once the account is deleted).
- Errors: `400 VALIDATION_ERROR` (`details` per field), `400 INVALID_ID`, `403 FORBIDDEN` (not the author nor an
  admin), `404 RESOURCE_NOT_FOUND`.

## Internal services

All paths are relative to `backend/`.

### Auth middleware — `middleware/requireAuth.js`

```js
const { requireAuth, requireRole } = require('../middleware/requireAuth');
router.get('/me', requireAuth, handler);                       // 401 AUTH_REQUIRED / TOKEN_EXPIRED / INVALID_TOKEN
router.post('/', requireAuth, requireRole('ADMIN', 'TEACHER'), handler);   // 403 FORBIDDEN
```

`req.user` is the full User document (role read from the database). Its `group` is **populated**:
`req.user.group = { _id, name, level, academicYear, program: { _id, name, code } } | null`.
`req.sessionId` is the login session of the access token (its `sid` claim), or `null` for a token issued before
sessions had ids (such tokens keep working until they expire).

### User model — `models/userModel.js`

- Roles: `STUDENT`, `TEACHER`, `ADMIN`, `ALUMNI` (`User.ROLES`). `locale` (`'fr' | 'en'`, default `'fr'`),
  `group` (ObjectId → Group, students only).
- Every `User.find*()` query populates `group` (+ its program) automatically, so serialized users have the
  public shape. It is skipped when the projection excludes `group` (`.select('firstname lastname')`,
  `Model.exists`) or with `.setOptions({ populateGroup: false })`.
- After `user.save()` with a changed group, call `await user.populateGroup()` before sending it.
- Exports: `User.ROLES`, `User.LOCALES`, `User.GROUP_POPULATE`; `User.hashPassword(password)` (bcrypt, what the save
  hook uses).
- `POST /api/users/import` (the web app reads the Excel/CSV file and sends its rows; `row` = line of the file): every
  row is checked against the model, then together (`DUPLICATE_EMAIL` in the import, `EMAIL_TAKEN`, `UNKNOWN_GROUP`,
  `GROUP_NOT_ALLOWED`), all before anything is created. Problems → `422 IMPORT_INVALID`, `details: { errors: [{ row,
  field, code, message }], total }` (codes: `REQUIRED`, `TOO_LONG`, `INVALID_EMAIL`, `PASSWORD_TOO_SHORT`,
  `INVALID_ROLE`, `INVALID_ROW` and the four above), nothing created. `dryRun: true` only checks (at most 1000 rows,
  `200 { dryRun, count }`). An import (at most 50 rows: each password is hashed, ~0.5 s on Render's free plan) is
  all or nothing: one `insertMany`, removed again if it fails half-way; `201 { importId, created, items }`, audit
  `user.import` (target `Import`/`importId`, metadata: count, source, roles, user ids and emails). Sent again with
  the same `importId` (a reply lost on a bad connection, replayed by the web app's outbox) → `200 { …, replayed:
  true }`, nothing created twice. More rows → `400 IMPORT_TOO_LARGE` (`details.max`).
- Public JSON: `{ id, firstname, lastname, email, role, twoFactorEnabled, locale, group, createdAt, updatedAt }`.
- `DELETE /api/users/:id`: the account loses its sessions, push subscriptions, real-time connections and in-app
  notifications; its forum posts and comments stay (author `null`, shown as "Unknown").
- Account notifications (`service/accountNotifications.js`, type `ACCOUNT`, in-app + push, French with "tu"):
  `PATCH /api/users/:id` tells the user what an admin changed (role, group, password; not their own edits). With a
  new password the notification is sent first, then the sessions and push subscriptions are revoked. A public
  sign-up (`POST /api/auth/signup`) notifies every admin (link `/dashboard/admin/users?q=<email>`).

### Academic models

`Program` (`summarizeProgram(p)` → `{ id, name, code }`) and `Group` (`summarizeGroup(g)` →
`{ id, name, level, academicYear, program }`; `MIN_LEVEL`, `MAX_LEVEL`, `isAcademicYear`, `NAME_COLLATION`).
Group names are unique per academic year, ignoring case: query them with `.collation(Group.NAME_COLLATION)`.
`GET /api/academic/groups` (ADMIN) lists them with `studentCount` for the users page, where admins put a student in
a group (`PATCH /api/users/:id { group }`). There is no API to create or edit programs and groups yet:
`npm run seed:demo` creates 3 programs and 4 groups.

### Audit — `service/auditService.js`

```js
const auditService = require('../service/auditService');
await auditService.record(req, {
  action: 'user.update',                 // "<area>.<verb>"
  targetType: 'User',                    // model name
  targetId: user._id,
  summary: 'Updated amira.bensalah@campuslink.local (role)',  // short English sentence
  metadata: { changed: ['role'] },                            // secrets are redacted automatically
  // actor: user,                         // optional: overrides req.user (e.g. unauthenticated flows)
});
```

Actor = `req.user` (snapshotted), IP = `req.ip` (honours `TRUST_PROXY`), User-Agent from the request.
Never throws (failures are logged); resolves to the entry or `null`. Recorded today: `user.create`, `user.update`,
`user.delete`, `auth.password_reset`, `auth.password_change`.

### Notifications — `service/notificationService.js` + `models/notificationModel.js`

```js
const { notifyUsers, notifyUsersInBackground } = require('../service/notificationService');

const report = await notifyUsers(userIds, (locale) => ({
  type: 'SYSTEM',                         // 'TIMETABLE_CHANGE' | 'ANNOUNCEMENT' | 'SYSTEM' | 'ACCOUNT'
  title: locale === 'fr' ? 'Ton post a un nouveau commentaire' : 'Your post has a new comment',
  body: '',
  link: `/dashboard/forum/${post._id}`,   // relative web path
  data: { postId: String(post._id) },     // small JSON object
  tag: `post-${post._id}`,                // optional: push tag (same tag replaces the OS notification)
  urgency: 'normal',                      // optional: web push urgency
}));
// report = { notified, push: { sent, outbox, removed, skipped, failed }, error? }
```

- `userIds`: ids, id strings or documents; duplicates, invalid and unknown ids are ignored.
- `buildMessage(locale)` is called once per locale (French uses "tu"); declare a second parameter
  `(locale, user)` to be called once per user (`user = { _id, locale }`). It may be async.
- Creates the in-app notifications in batches of 500, emits `notification:new` to the user's open Socket.IO
  clients, then pushes to every subscription of each user. The push `data` carries `notificationId`, `type` and
  `unreadCount` (the installed app's icon badge). Options: `notifyUsers(ids, build, { push: false })`.
- **Never throws and never rejects**: `notifyUsersInBackground(ids, build)` starts it on the next tick so the
  HTTP response is not delayed.
- Notification JSON: `{ id, type, title, body, link, data, readAt, createdAt }` (title ≤ 200, body ≤ 1000 characters).

### Push — `service/pushService.js`

`isConfigured()`, `getPublicKey()`, `sendToUser(userId, payload)`, `sendToUsers([{ userId, payload }])`,
`sendToSubscription(subscriptionDoc, payload)`. Payload `{ title, body, link, tag, data }` (+ optional `urgency`).
All of them never throw and resolve to `{ sent, outbox, removed, skipped, failed }`. Subscriptions answering
404/410 are deleted; FCM subscriptions are stored and skipped. With `PUSH_OUTBOX_FILE`, each push is appended as
`{ userId, subscriptionId, type, endpoint, payload, sentAt }` instead of being sent. Normally you only call
`notificationService.notifyUsers`, which pushes for you.

Each subscription belongs to the login session that registered it (`sessionId` = the access token's `sid`, `null`
for an old token without one). Logout deletes the session's subscriptions, `tokenService.revokeAllRefreshTokens(userId)`
(password change or reset, admin password change, account deletion) deletes all of the user's, and the hourly job
`push.prune-ended-sessions` deletes those whose session expired. A user keeps at most 10 subscriptions: registering
an 11th drops the least recently updated one.

Web push endpoints are restricted to the browser push services (`utils/pushEndpoint.js`): `https://` with no
port and no credentials, host `fcm.googleapis.com` or a subdomain of `push.services.mozilla.com`,
`notify.windows.com` or `push.apple.com`. `POST /api/push/subscriptions` refuses anything else with
400 `VALIDATION_ERROR` (`details.endpoint`), so a user cannot make the server POST to internal hosts or third
parties (SSRF). `sendToSubscription` checks again before sending (and before the outbox): a stored subscription
that fails the check is never contacted, it is deleted and counted as `removed`.

### Real time — `service/realtime.js`

Socket.IO on the same HTTP server (`realtime.init(server)` in `app.js`), origins from `CORS_ORIGINS`.
`realtime.emitToUser(userId, event, payload)` (never throws) and `realtime.disconnectUser(userId)`. A client
authenticates with an access token (mobile) or a single-use ticket (web, see the comment at the top of
`service/realtime.js`); the ticket route `GET /api/realtime/ticket` that `lib/realtime` calls is not mounted yet.

### Files — `service/storageService.js` + `middleware/upload.js`

Not used by a route yet; ready for uploads (e.g. forum images).

```js
const { createUpload, FILE_TYPES } = require('../middleware/upload');
const storageService = require('../service/storageService');

// Multipart (JSON requests pass through untouched, req.files = []):
router.post('/', requireAuth, createUpload({ field: 'attachments', maxCount: 5 }), async (req, res) => {
  const data = JSON.parse(req.body.data ?? '{}');           // text fields are strings
  for (const file of req.files) {                           // { originalname, mimetype, size, buffer }
    const saved = await storageService.save({
      buffer: file.buffer, originalName: file.originalname, mimeType: file.mimetype, folder: 'forum',
    });                                                      // → { key, filename, size, mimeType }
  }
});

await storageService.sendFile(res, key, { filename, mimeType });   // download (Content-Disposition: attachment)
const stream = await storageService.stream(key);                  // 404 RESOURCE_NOT_FOUND when missing
await storageService.remove(key);                                  // idempotent
```

- `createUpload({ field = 'file', maxCount = 1, types = FILE_TYPES.ATTACHMENTS, maxFileSizeMb = MAX_UPLOAD_MB, checkContent = true })`.
  `FILE_TYPES.ATTACHMENTS` = pdf, png, jpg/jpeg, webp, docx, xlsx, pptx, txt; `FILE_TYPES.CSV` = .csv. MIME type
  **and** extension must match, and the content is checked (magic bytes; no NUL bytes in text files).
- Errors: `413 FILE_TOO_LARGE`, `415 UNSUPPORTED_FILE_TYPE`, `400 TOO_MANY_FILES`, `400 VALIDATION_ERROR`
  (unexpected file field, malformed multipart).
- Files are stored under generated keys (`<folder>/YYYY/MM/<32 hex>.<ext>`); store the `key` and the original
  `filename` in your model. Keys are validated (`400 VALIDATION_ERROR`, no path traversal) and written once.
- **Storage driver** (`STORAGE_DRIVER`, read at call time; same API, errors and keys for both):
  - `disk` (default): files under `STORAGE_DIR` (default `backend/uploads`, git-ignored). For local development, a
    VPS or any host with a persistent disk.
  - `gridfs`: files in MongoDB, GridFS bucket `uploads` of the mongoose connection. For hosts without a persistent
    disk (e.g. the Render free tier). Files count towards the database size (MongoDB Atlas M0: 512 MB in all).
  - Switching drivers does not move files: keys saved with one driver answer 404 with the other.
- `file.originalname` is UTF-8 (`defParamCharset: 'utf8'`).

### Scheduler — `service/scheduler.js`

```js
const scheduler = require('../service/scheduler');
scheduler.registerJob('posts.close-past-trips', scheduler.defaultIntervalMs(), async () => {
  // claim work atomically (findOneAndUpdate): several backend instances may run the same job
});
```

`registerJob(name, intervalMs, fn, { runOnStart = true })` → `{ stop, runNow }`. Register at module load time:
`app.js` starts the jobs after the MongoDB connection (first run ~1 s later) and stops them on shutdown. A job
never overlaps itself (next run = end of the previous one + interval), errors are logged, timers are unref'd.
Jobs never run when `app.js` is only imported (`require('./app')`), e.g. by scripts. Registered today:
`push.prune-ended-sessions` (hourly).

### Validation helpers — `utils/validation.js`

- Throwing: `requireFields(body, fields)` (400 `MISSING_FIELDS` then `VALIDATION_ERROR` for non-strings),
  `throwIfInvalid(details)`, `assertObjectId(id)` (400 `INVALID_ID`), `notFound('Post')`
  (→ `HttpError` 404 `RESOURCE_NOT_FOUND`, to throw), `validationError(details)`.
- Collecting (`details` is a `{ field: message }` object, call `throwIfInvalid(details)` afterwards):
  `readString(v, field, details, { min, max })`, `readInteger(v, field, details, { min, max })`,
  `readEnum(v, allowed, field, details)`, `readDate(v, field, details)`, `readBoolean(v, field, details)`,
  `readObjectId(v, field, details)`, `readObjectIdList(v, field, details, { max })`.
- Other: `parsePagination(req.query)` → `{ page, limit, skip }`, `parseBooleanQuery(v)`, `escapeRegex(s)`,
  `normalizeEmail(s)`, `normalizeLocale(s)`, `checkPassword(pw)`, `isBlank(v)`, `LOCALES`.

### Time helpers — `utils/time.js` (campus timezone, weeks start on Monday)

`getAppTimezone()`, `parseLocalDateTime('2026-10-08', '10:30')` → Date (UTC) or null,
`formatLocalDate(date)` → `'YYYY-MM-DD'`, `formatLocalTime(date)` → `'HH:mm'`, `startOfLocalDay(date)`,
`startOfLocalWeek(date)` (Monday 00:00), `addLocalDays(date, n)`, `addDaysToDateString('2026-10-08', 7)`,
`isSameLocalDay(a, b)`, `getZonedParts(date)` (`weekday` 1 = Monday), `parseDateOnly`, `parseTimeOnly`,
`currentAcademicYear()` (`'2026-2027'`, starts in September), `academicYearBounds(date)` → `{ start, end }`
(1 September 00:00 of that academic year and of the next one, end exclusive). All take an optional timezone last.

### Other helpers

- `utils/env.js`: `envString`, `envBool`, `envNumber(name, fallback)`, `isProduction()`, `trustProxySetting()`,
  `publicApiUrl()` (`PUBLIC_API_URL` without trailing slash).
- `utils/serialize.js`: `idOf(value)`, `isPopulated(value)`, `refSummary(value, ['name', 'code'])`, `cleanTransform(hidden)`.
- `service/mailService.js`: `sendEmail({ to, subject, text, html })` through Brevo's HTTPS API when
  `BREVO_API_KEY` + `MAIL_FROM_EMAIL` are set (hosts that block SMTP, e.g. Render's free plan), else SMTP (throws on
  failure; fails in production without either), `isEmailConfigured()`, `isSmtpConfigured()`, `escapeHtml`, `BRAND_COLOR`.
- `GET /api/audit/request-info` (ADMIN): `{ ip, ips, forwardedFor, trustProxy }`, how the API sees the caller's
  address, to set `TRUST_PROXY` behind a hosting proxy.

### Error codes

`AUTH_REQUIRED`, `TOKEN_EXPIRED`, `INVALID_TOKEN`, `FORBIDDEN`, `MISSING_FIELDS`, `VALIDATION_ERROR`,
`INVALID_ID`, `INVALID_JSON`, `PAYLOAD_TOO_LARGE`, `NOT_FOUND` (unknown route), `NO_CHANGES`, `USER_NOT_FOUND`,
`EMAIL_TAKEN`, `IMPORT_INVALID` (422, `details.errors`), `IMPORT_TOO_LARGE` (400, `details.max`), `INVALID_ROLE`, `INVALID_CREDENTIALS`, `OTP_INVALID`, `OTP_TOO_MANY_ATTEMPTS`,
`INVALID_REFRESH_TOKEN`, `RESET_TOKEN_INVALID`, `INVALID_PASSWORD`, `CANNOT_DELETE_SELF`, `EMAIL_FAILED`,
`RESOURCE_NOT_FOUND` (404), `ALREADY_EXISTS` (409, `details.field`), `IN_USE` (409, `details.references`),
`CONFLICT` (409), `TOO_MANY_REQUESTS` (429, `details.retryAfter`), `PUSH_DISABLED` (503), `FILE_TOO_LARGE` (413),
`UNSUPPORTED_FILE_TYPE` (415), `TOO_MANY_FILES` (400).

### Seed plugins — `scripts/seed/*.js`

`npm run seed:demo` creates the core data (programs, groups, accounts), then runs every `scripts/seed/*.js` in
name order (`10-forum.js`: posts of every type with comments and replies). A plugin exports `async (ctx) => {}`
(or `{ name, run }`) and must be idempotent (delete what it created before, or upsert). It must not send
notifications.

```js
ctx = {
  academicYear,                        // '2026-2027'
  programs: { TWIN, DS, SAE },         // documents by code
  groups: { '4TWIN1', '4TWIN2', '4DS1', '4SAE1' },   // documents by name (level 4)
  users: { admin, teachers: [4], students: [15], alumni: [1], studentsByGroup: { '4TWIN1': [5], ... }, byEmail },
  mongoose, models,                    // mongoose.models
  time,                                // utils/time.js
  timezone, now, password,             // 'Africa/Tunis', Date, 'Campus123!'
  log(message),                        // indented console output
}
```

Demo accounts: `admin@campuslink.local`, teachers `amira.bensalah@`, `karim.trabelsi@`, `leila.gharbi@` (en),
`mehdi.jaziri@`, students such as `yasmine.haddad@campuslink.local` (4TWIN1) and `skander.mejri@` (no group),
alumni `selim.rekik@`; all with the password `Campus123!`.
