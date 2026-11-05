# API contract

Base URL: http://localhost:5000. Auth: http://localhost:3000/api/auth.

Sign in through BetterAuth in Next.js, request `/api/auth/token` with the session cookie, and send `Authorization: Bearer <JWT>` to protected Express endpoints. The client already does this. Session cookies alone do not authorize Express.

| Method | Endpoint     | Access         | Input                                    |
| ------ | ------------ | -------------- | ---------------------------------------- |
| GET    | /books       | Public         | Optional sort=newest/title, limit=1..100 |
| GET    | /books/:id   | JWT            | Resource ID                              |
| POST   | /books       | JWT            | Book input                               |
| PATCH  | /books/:id   | JWT + owner    | One or more book input fields            |
| DELETE | /books/:id   | JWT + owner    | No active loans                          |
| POST   | /borrows     | JWT            | {bookId}                                 |
| GET    | /borrows     | JWT            | Current reader only                      |
| DELETE | /borrows/:id | JWT + borrower | Return borrow                            |

`/books?mine=true` is an owner-filtered option on the same endpoint and requires JWT. `/health` is operational readiness.

Book input: `{title, author, category, image, description, totalCopies}`. Title 1–160 characters, author 1–100, description 15–2000, copies integer 1–10000. Categories: Fiction, Science, History, Kids, Others. Image: HTTP(S) URL or bundled /covers/book-1.svg through book-9.svg. Unknown fields, including forged identities, are rejected.

Book output adds string `id`, `ownerId`, `ownerName`, `ownerEmail`, ISO `createdAt`/`updatedAt`, and `availableCopies`. Borrow output: `{id, bookId, bookTitle, bookImage, userId, userEmail, borrowDate, returnDate}`. Metadata and fourteen-day due dates are server-derived. Responses are direct objects/arrays matching the client.

Codes: 200 read/update, 201 create/borrow, 204 delete/return; 400 validation, 401 auth, 403 ownership/origin, 404 missing, 409 inventory/duplicate conflict, 413 oversized body, 429 limit, 503 unavailable. Errors: `{ "message": "Readable explanation" }`.

Transactions cover borrowing, returning, copy edits and deletion. Shared book-document writes trigger conflict detection/retries. A unique `(userId, bookId)` index adds duplicate protection. Returns remove the loan and increment inventory in one commit; duplicate returns cannot increment twice. Active loans block deletion.

JWT verification pins algorithm, issuer, audience, expiry, subject and session claims. Live session/account checks prevent a signed-out token from retaining access. No identity is trusted from request bodies.
