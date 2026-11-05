# Verification performed

## Automated backend tests

`npm test` passed: **15 tests, 0 failures** (one parent integration scenario and fourteen subtests), using MongoDB 8.0.14 as a real ephemeral replica set, actual BetterAuth password sessions, and signed JWTs.

Checked:

- MongoDB auth persistence, password rules, wrong-password rejection and token claims.
- Missing, malformed and tampered tokens rejected.
- Correctly signed tokens with wrong issuer, wrong audience or expired claims rejected.
- Server-derived contributor identity, field/ID validation, serialization and protected details.
- MongoDB newest-first sorting, query limits and ownership filtering.
- Owner-only edits/deletes and partial updates.
- Borrow metadata, due dates, decrement, duplicate prevention and borrower isolation.
- Copy edits preserve active loans and reject totals below loans.
- Concurrent duplicate returns increment copies once.
- Five competing duplicate borrow requests create one loan.
- Two readers competing for one available copy cannot both borrow it.
- Delete restrictions, missing resources, JSON errors, malformed JSON and CORS rejection.
- Sign-out revokes access for an already-issued JWT.
- Seed runs twice without duplicates and initializes consistent available-copy counts.

## Browser integration

Verified the actual Next.js route handler and Express API against another real temporary MongoDB replica set:

- Home fetched six real database arrivals, with demo mode disabled.
- Private route redirected to login and resumed after real BetterAuth authentication.
- Logged-in session survived a full page reload.
- Client obtained a JWT and completed borrow/return through Express.
- Book creation persisted across reload; edit and confirmed delete completed.
- Sign-out removed private-page access.
- UI registration and login created/used a real database account.
- Mobile connected-mode empty state fit a 375px viewport.
- No uncaught JavaScript errors during the completed browser flow.

## Build and external services

Shared auth and Express TypeScript compilation passed. Next.js production compilation and route generation passed using Webpack. Dependency installation audit reported zero vulnerabilities.

The environment used for validation did not have Docker, so the Compose startup path was reviewed rather than executed; the database logic was exercised on an actual MongoDB replica set using the included test runner. Google OAuth and remote imgbb uploads require user-owned credentials and were not exercised. Email/password, cover URL input, all domain API operations and MongoDB persistence were exercised.
