# BookNook — runnable full-stack project

Next.js App Router / TypeScript / DaisyUI client, Express / TypeScript / MongoDB API, and BetterAuth with the MongoDB adapter and signed JWTs. This archive includes the updated client so both sides run together.

## Quick start

Install **Node.js 22.12+** and **Docker Desktop**. Extract this archive and run these commands from the `booknook-fullstack` root folder:

```sh
npm ci
npm run setup
npm run db:up
npm run seed
npm run dev
```

Open **http://localhost:3000**. API: **http://localhost:5000**. Readiness: http://localhost:5000/health.

`setup` creates `.env` with a random secret and preserves existing configuration. `db:up` starts MongoDB 8 as a single-node replica set and waits until healthy. The database uses a persistent Docker volume. Application processes run on your host.

**Atlas alternative:** skip `db:up`; set `MONGODB_URI` and `MONGODB_DB` in `.env`, allow your IP in Atlas, then seed/start. A replica set or Atlas cluster is required for transactions. Standalone MongoDB is rejected at startup.

After seeding, log in using **reader@booknook.demo / Reader123**, or register an account. This is a real MongoDB-backed BetterAuth account. Seed adds nine fictional books and never resets existing passwords, book edits, or borrows. Optional `SEED_EMAIL` and `SEED_PASSWORD` customize the initial account. Production seeding is blocked unless `ALLOW_PRODUCTION_SEED=true` is explicitly set.

## Build and start

```sh
npm run build
npm start
```

Build compiles shared auth, the Express TypeScript server, and Next.js. Start launches both production processes. Set public URLs before building. A running MongoDB replica set is required for API startup. Run all npm commands from this root; one installation/lockfile manages dependencies without symlinks or workspace tooling.

## Features

- Eight required book/borrow endpoints with validation and JSON errors.
- Owner-only CRUD; server-derived identities, timestamps and borrow metadata.
- Transactional `$inc` copy accounting, unique active-loan constraint, duplicate/last-copy protection.
- Returns restore one copy; copy edits preserve active loans; active loans block deletion.
- BetterAuth hosted in Next.js with MongoDB persistence and optional Google OAuth.
- Express checks EdDSA JWT signatures, issuer, audience, expiry and current database sessions.
- Signing out revokes access for previously issued tokens immediately.
- Existing responsive client, private pages, toasts, themes, Swiper and image uploads.
- Six newest arrivals fetched using MongoDB sort and limit.

## Environment and services

Root scripts load root `.env` into both processes. See `.env.example`; never commit `.env`.

| Variable                                   | Purpose                                           |
| ------------------------------------------ | ------------------------------------------------- |
| `MONGODB_URI`, `MONGODB_DB`                | Replica-set connection and database               |
| `BETTER_AUTH_URL`                          | Next.js origin, normally http://localhost:3000    |
| `BETTER_AUTH_SECRET`                       | Random server-only secret, at least 32 characters |
| `JWT_AUDIENCE`                             | Matching auth/API audience, default booknook-api  |
| `CLIENT_ORIGIN`                            | Exact frontend CORS/trusted origin                |
| `PORT`                                     | Express port, default 5000                        |
| `NEXT_PUBLIC_DEMO_MODE`                    | false for real auth/database mode                 |
| `NEXT_PUBLIC_AUTH_URL`                     | Same Next.js origin as BETTER_AUTH_URL            |
| `NEXT_PUBLIC_API_URL`                      | Browser-accessible Express origin                 |
| `NEXT_PUBLIC_IMGBB_KEY`                    | Optional public imgbb upload key                  |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional Google credentials, both or neither      |

Google OAuth Web client: authorized origin `http://localhost:3000`, redirect URI **http://localhost:3000/api/auth/callback/google**. Set both credentials and restart. Configure equivalent HTTPS URLs in production. Email/password auth works without Google.

Set the imgbb key before starting/building to upload covers, or enter an HTTP(S) image URL without a key. Real API records store URLs and reject base64 blobs. Never place private database/auth/Google secrets in public environment variables.

Password rules are enforced in the client and server: minimum six characters, uppercase and lowercase. Registration returns to Login. Email verification and password recovery stay disabled as requested.

## Tests

```sh
npm test
```

Tests use a real disposable MongoDB replica set, real BetterAuth sessions, and signed JWTs; they never use your configured database. First run downloads a MongoDB test binary to `.cache/mongodb` and requires Internet access/disk space. Later runs use the cache. The temporary replica set and HTTP servers stop at completion. See `docs/VERIFICATION.md` for performed checks.

## Structure

`client/` contains Next.js and its `/api/auth/[...all]` Node route. `packages/auth/src/` contains shared server-only auth/MongoDB configuration. `server/src/` contains Express routes, JWT guard, validation and seed. `server/test/` contains database integration/concurrency tests. `compose.yaml` starts local MongoDB.

Authentication endpoints run inside Next.js as required by the PDF; Express owns the library API. JWTs carry user/session IDs. Express reads current identity from MongoDB. Sessions last seven days; JWTs last fifteen minutes. The client obtains tokens per protected API request and does not persist them in localStorage.

`npm run db:down` stops MongoDB while preserving its named volume. The local database binds only to loopback and has no authentication; use an authenticated database, HTTPS and real origins for deployment. This archive excludes secrets, dependencies, build output and test binaries.

**Publishing:** no deployment, live URL, repository or Git history is claimed. Supply real URLs and meaningful commits after publishing, and replace illustrative footer contacts/social links.
