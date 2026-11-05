# BookNook Server

BookNook’s backend manages an online library where users can add books, borrow available copies, and return them.

Built with **Express.js, TypeScript, MongoDB, BetterAuth’s MongoDB adapter, and JWT authorization**.

## Author

- **Name:** Md. Faruk Ahmed
- **GitHub:** [srfarukahmed](https://github.com/srfarukahmed)
- **Server Repository:** [booknook-server](https://github.com/srfarukahmed/booknook-server)

## Features

- Eight book and borrowing API endpoints.
- MongoDB persistence with validated request data.
- Owner-only book updates and deletion.
- JWT signature, issuer, audience, and expiration validation.
- Live session checks that revoke access after logout.
- Transactional borrowing and returns with atomic copy updates.
- Prevention of duplicate borrowing and unavailable-copy borrowing.
- Automatic borrow timestamps and fourteen-day return dates.
- Protection against deleting books with active loans.
- Consistent JSON errors, CORS configuration, and rate limiting.

## Technology Stack

| Technology | Purpose |
| --- | --- |
| Express.js | Library REST API |
| TypeScript | Typed backend implementation |
| MongoDB | Books, borrows, users, and sessions |
| BetterAuth | Authentication and session management |
| MongoDB Adapter | BetterAuth database integration |
| JWT / JOSE | Token generation and verification |
| Zod | Request and environment validation |

## Authentication Architecture

BetterAuth authentication endpoints run inside Next.js at `/api/auth/[...all]`.

The Express API validates JWTs using BetterAuth’s JWKS endpoint. It also checks the current database session and user before allowing protected operations.

JWTs expire after fifteen minutes. Sessions last seven days.

## Folder Structure

The supplied project uses this integrated structure:

```text
booknook-fullstack/

├── server/
│   ├── src/
│   │   ├── fixtures/
│   │   │   ├── data.ts
│   │   │   └── types.ts
│   │   ├── app.ts
│   │   ├── auth.ts
│   │   ├── database.ts
│   │   ├── errors.ts
│   │   ├── index.ts
│   │   ├── models.ts
│   │   ├── routes.ts
│   │   ├── seed.ts
│   │   └── validation.ts
│   ├── test/
│   │   └── integration.test.ts
│   ├── package.json
│   └── tsconfig.json
├── scripts/
│   └── setup.mjs
├── docs/
│   ├── API.md
│   ├── REQUIREMENTS.md
│   └── VERIFICATION.md
├── .env.example
├── .gitignore
├── compose.yaml
├── package.json
├── package-lock.json
└── README.md
```

## Requirements

- Node.js 22.12 or newer.
- MongoDB Atlas or a MongoDB replica set.
- Docker Desktop only when using the provided local database configuration.

A standalone MongoDB server is unsupported because borrowing and returns require transactions.

## Installation

Run these commands from the integrated project root:

```bash
npm ci
npm run setup
```

The setup command creates `.env` with a random authentication secret.

Configure your MongoDB Atlas connection and application origins before continuing.

## Environment Variables

```dotenv
MONGODB_URI=YOUR_MONGODB_ATLAS_CONNECTION_STRING
MONGODB_DB=booknook

BETTER_AUTH_URL=http://localhost:3005
BETTER_AUTH_SECRET=YOUR_GENERATED_SECRET
JWT_AUDIENCE=booknook-api

CLIENT_ORIGIN=http://localhost:3005
PORT=5000

NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_AUTH_URL=http://localhost:3005
NEXT_PUBLIC_API_URL=http://localhost:5000

NEXT_PUBLIC_IMGBB_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

Keep your generated authentication secret unchanged when connecting to an existing BookNook database.

The client port in `package.json` must match the configured frontend origin. Never commit `.env` or private credentials.

## Run with MongoDB Atlas

Add your current IP address to Atlas Network Access and configure your database connection.

Then run:

```bash
npm run seed
npm run dev
```

The integrated development command starts both the client and Express API.

- **Client:** http://localhost:3005
- **API:** http://localhost:5000
- **Health Check:** http://localhost:5000/health

The client URL above assumes its port has been configured as 3005.

## Local MongoDB Alternative

With Docker Desktop running:

```bash
npm run db:up
npm run seed
npm run dev
```

Stop the local database with:

```bash
npm run db:down
```

The Docker volume preserves database data.

## API Endpoints

Protected endpoints require:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

| Method | Endpoint | Access |
| --- | --- | --- |
| GET | `/books` | Public |
| GET | `/books/:id` | Authenticated |
| POST | `/books` | Authenticated |
| PATCH | `/books/:id` | Book owner |
| DELETE | `/books/:id` | Book owner |
| POST | `/borrows` | Authenticated |
| GET | `/borrows` | Current user's records |
| DELETE | `/borrows/:id` | Borrow owner |

Additional query options:

```text
/books?sort=newest&limit=6
/books?sort=title
/books?mine=true
```

The `mine=true` option requires authentication.

## Borrowing Rules

- A book must have an available copy.
- A user cannot hold two active loans for the same book.
- Borrowing decreases available copies by one.
- Returning increases available copies by one.
- Duplicate return requests cannot restore copies twice.
- Books with active loans cannot be deleted.
- Total copies cannot be reduced below the number currently borrowed.

Inventory changes and borrow records are committed together using MongoDB transactions.

## Seed Account

After successful seeding:

```text
Email: reader@booknook.demo
Password: Reader123
```

Seeding creates nine sample books and preserves existing records and passwords.

## Production Build

From the integrated project root:

```bash
npm run build
npm start
```

Configure deployment URLs before building. Use HTTPS and an authenticated database for production.

## Tests

```bash
npm test
```

The integration suite uses a disposable MongoDB replica set, actual BetterAuth sessions, and signed JWTs.

It checks authentication, ownership, CRUD, validation, borrowing, concurrent inventory changes, returns, logout revocation, and repeatable seeding.

The first test run downloads a MongoDB binary. Tests do not use your configured application database.

## Optional Services

- Google sign-in requires your own Google OAuth credentials.
- Book-image uploads require an imgbb key; image URLs can also be supplied.
- Email verification and password recovery are intentionally disabled for this assignment.