import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, Server } from "node:http";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { decodeJwt } from "jose";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { getAuth, closeDatabase } from "../../packages/auth/dist/index.js";
import { createApp } from "../src/app.js";
import { initializeDatabase, database } from "../src/database.js";

async function listen(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}
async function close(server?: Server) {
  if (server)
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
    });
}
test(
  "BookNook: MongoDB, BetterAuth, signed JWTs, ownership and concurrent inventory",
  { timeout: 240000 },
  async (t) => {
    let mongo: MongoMemoryReplSet | undefined;
    let authServer: Server | undefined;
    let apiServer: Server | undefined;
    try {
      // An actual ephemeral replica set, not mocked collections. Auth is mounted in a test HTTP
      // harness only; the shipped application mounts this same configuration in Next.js.
      mongo = await MongoMemoryReplSet.create({
        binary: { version: "8.0.14", downloadDir: resolve(".cache/mongodb") },
        replSet: { count: 1, storageEngine: "wiredTiger" },
      });
      const authApp = express();
      authApp.all("/api/auth/*path", async (req, res) =>
        toNodeHandler(await getAuth())(req, res),
      );
      authServer = createServer(authApp);
      const authURL = await listen(authServer);
      Object.assign(process.env, {
        MONGODB_URI: mongo.getUri(),
        MONGODB_DB: "booknook_integration",
        BETTER_AUTH_URL: authURL,
        BETTER_AUTH_SECRET: "integration-test-secret-which-is-long-enough-2026",
        JWT_AUDIENCE: "booknook-api",
        CLIENT_ORIGIN: authURL,
        NODE_ENV: "test",
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
      });
      await initializeDatabase();
      apiServer = createServer(createApp());
      const base = await listen(apiServer);
      const authRequest = async (path: string, body?: unknown, cookie = "") =>
        fetch(authURL + "/api/auth" + path, {
          method: body ? "POST" : "GET",
          headers: {
            "Content-Type": "application/json",
            Origin: authURL,
            ...(cookie ? { Cookie: cookie } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
      const request = async (
        path: string,
        method = "GET",
        token = "",
        body?: unknown,
      ) => {
        const response = await fetch(base + path, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = await response.json().catch(() => null);
        return { status: response.status, data, headers: response.headers };
      };
      async function account(name: string, email: string) {
        let response = await authRequest("/sign-up/email", {
          name,
          email,
          password: "Reader123",
        });
        assert.equal(response.status, 200, await response.text());
        response = await authRequest("/sign-in/email", {
          email,
          password: "Reader123",
        });
        const login = await response.json();
        assert.equal(response.status, 200, JSON.stringify(login));
        const cookie = response.headers
          .getSetCookie()
          .map((c) => c.split(";")[0])
          .join("; ");
        const result = await authRequest("/token", undefined, cookie);
        const jwt = await result.json();
        assert.equal(result.status, 200, JSON.stringify(jwt));
        return { token: jwt.token as string, cookie, user: login.user };
      }
      const alice = await account("Alice Reader", "alice@example.com");
      const bob = await account("Bob Reader", "bob@example.com");
      const charlie = await account("Charlie Reader", "charlie@example.com");
      await t.test(
        "BetterAuth persists users, enforces password rules and issues JWTs",
        async () => {
          const invalid = await authRequest("/sign-up/email", {
            name: "Weak Reader",
            email: "weak@example.com",
            password: "weakpassword",
          });
          assert.equal(invalid.status, 400);
          const wrong = await authRequest("/sign-in/email", {
            email: "alice@example.com",
            password: "WrongPass1",
          });
          assert.equal(wrong.status, 401);
          const session = await authRequest(
            "/get-session",
            undefined,
            alice.cookie,
          );
          const sessionData = await session.json();
          assert.equal(sessionData.user.email, "alice@example.com");
          const claims = decodeJwt(alice.token);
          assert.equal(claims.sub, alice.user.id);
          assert.equal(claims.iss, authURL);
          assert.equal(claims.aud, "booknook-api");
          assert.equal((claims.exp as number) - (claims.iat as number), 900);
          assert.ok(claims.sid);
          const { db } = await database();
          assert.equal(
            await db
              .collection("user")
              .countDocuments({ email: "alice@example.com" }),
            1,
          );
          assert.ok((await db.collection("jwks").countDocuments()) > 0);
        },
      );
      const input = {
        title: "A Real Database Adventure",
        author: "A. Reader",
        category: "Fiction",
        image: "https://example.com/cover.jpg",
        description:
          "A complete journey through a library backed by real MongoDB transactions.",
        totalCopies: 3,
      };
      let bookId = "";
      await t.test(
        "Public listing; missing, forged and malformed JWTs rejected",
        async () => {
          assert.equal((await request("/books")).status, 200);
          assert.equal(
            (await request("/books", "POST", "", input)).status,
            401,
          );
          const pieces = alice.token.split(".");
          pieces[2] = (pieces[2]![0] === "a" ? "b" : "a") + pieces[2]!.slice(1);
          assert.equal(
            (await request("/books", "POST", pieces.join("."), input)).status,
            401,
          );
          assert.equal(
            (await request("/books", "POST", "not-a-jwt", input)).status,
            401,
          );
        },
      );
      await t.test(
        "Correctly signed tokens with wrong issuer/audience or expired claims are rejected",
        async () => {
          const auth = await getAuth();
          const signingApi = auth.api as typeof auth.api & {
            signJWT: (args: {
              body: { payload: Record<string, unknown> };
            }) => Promise<{ token: string }>;
          };
          const payload = decodeJwt(alice.token);
          for (const override of [
            { iss: "https://wrong-issuer.example" },
            { aud: "another-api" },
            { exp: Math.floor(Date.now() / 1000) - 60 },
          ]) {
            const signed = await signingApi.signJWT({
              body: { payload: { ...payload, ...override } },
            });
            assert.equal(
              (await request("/borrows", "GET", signed.token)).status,
              401,
            );
          }
        },
      );
      await t.test(
        "Create uses authenticated identity, validates fields, serializes IDs",
        async () => {
          const forged = await request("/books", "POST", alice.token, {
            ...input,
            ownerId: bob.user.id,
          });
          assert.equal(forged.status, 400);
          assert.equal(
            (
              await request("/books", "POST", alice.token, {
                ...input,
                totalCopies: -1,
              })
            ).status,
            400,
          );
          const created = await request("/books", "POST", alice.token, input);
          assert.equal(created.status, 201, JSON.stringify(created.data));
          bookId = created.data.id;
          assert.match(bookId, /^[a-f0-9]{24}$/);
          assert.equal(created.data.ownerId, alice.user.id);
          assert.equal(created.data.ownerEmail, "alice@example.com");
          assert.equal(created.data.availableCopies, 3);
          assert.ok(!created.data._id);
          assert.ok(!Number.isNaN(Date.parse(created.data.createdAt)));
          assert.equal((await request("/books/" + bookId)).status, 401);
          assert.equal(
            (await request("/books/" + bookId, "GET", bob.token)).status,
            200,
          );
          assert.equal(
            (await request("/books/not-an-id", "GET", bob.token)).status,
            400,
          );
        },
      );
      await t.test(
        "Newest sorting, database limit and ownership-filtered listing",
        async () => {
          const created = await request("/books", "POST", bob.token, {
            ...input,
            title: "Newest book",
            totalCopies: 1,
          });
          assert.equal(created.status, 201);
          const latest = await request("/books?sort=newest&limit=1");
          assert.equal(latest.data.length, 1);
          assert.equal(latest.data[0].id, created.data.id);
          assert.equal((await request("/books?limit=0")).status, 400);
          assert.equal((await request("/books?mine=true")).status, 401);
          const mine = await request("/books?mine=true", "GET", alice.token);
          assert.equal(mine.data.length, 1);
          assert.equal(mine.data[0].id, bookId);
        },
      );
      await t.test("Owner-only edits/deletes and partial updates", async () => {
        assert.equal(
          (
            await request("/books/" + bookId, "PATCH", bob.token, {
              title: "Stolen",
            })
          ).status,
          403,
        );
        assert.equal(
          (await request("/books/" + bookId, "DELETE", bob.token)).status,
          403,
        );
        const edit = await request("/books/" + bookId, "PATCH", alice.token, {
          title: "An Updated Adventure",
        });
        assert.equal(edit.status, 200);
        assert.equal(edit.data.title, "An Updated Adventure");
        assert.equal(edit.data.availableCopies, 3);
      });
      let borrowId = "";
      await t.test(
        "Borrow derives metadata/dates, decrements copies, blocks duplicates",
        async () => {
          assert.equal(
            (
              await request("/borrows", "POST", bob.token, {
                bookId,
                userEmail: "alice@example.com",
              })
            ).status,
            400,
          );
          const borrowed = await request("/borrows", "POST", bob.token, {
            bookId,
          });
          assert.equal(borrowed.status, 201, JSON.stringify(borrowed.data));
          borrowId = borrowed.data.id;
          assert.equal(borrowed.data.userId, bob.user.id);
          assert.equal(borrowed.data.bookTitle, "An Updated Adventure");
          assert.equal(
            Date.parse(borrowed.data.returnDate) -
              Date.parse(borrowed.data.borrowDate),
            14 * 86400000,
          );
          assert.equal(
            (await request("/books/" + bookId, "GET", alice.token)).data
              .availableCopies,
            2,
          );
          assert.equal(
            (await request("/borrows", "POST", bob.token, { bookId })).status,
            409,
          );
          assert.equal(
            (await request("/borrows", "GET", alice.token)).data.length,
            0,
          );
          assert.equal(
            (await request("/borrows", "GET", bob.token)).data.length,
            1,
          );
          assert.equal(
            (await request("/books/" + bookId, "DELETE", alice.token)).status,
            409,
          );
          assert.equal(
            (await request("/borrows/" + borrowId, "DELETE", alice.token))
              .status,
            403,
          );
        },
      );
      await t.test(
        "Changing copies preserves active loans and rejects too-small totals",
        async () => {
          const second = await request("/borrows", "POST", charlie.token, {
            bookId,
          });
          assert.equal(second.status, 201);
          assert.equal(
            (
              await request("/books/" + bookId, "PATCH", alice.token, {
                totalCopies: 1,
              })
            ).status,
            409,
          );
          const updated = await request(
            "/books/" + bookId,
            "PATCH",
            alice.token,
            { totalCopies: 5 },
          );
          assert.equal(updated.data.availableCopies, 3);
          assert.equal(updated.data.totalCopies, 5);
          await request("/borrows/" + second.data.id, "DELETE", charlie.token);
        },
      );
      await t.test(
        "Concurrent duplicate returns restore exactly one copy",
        async () => {
          const results = await Promise.all([
            request("/borrows/" + borrowId, "DELETE", bob.token),
            request("/borrows/" + borrowId, "DELETE", bob.token),
          ]);
          assert.deepEqual(results.map((r) => r.status).sort(), [204, 404]);
          assert.equal(
            (await request("/books/" + bookId, "GET", alice.token)).data
              .availableCopies,
            5,
          );
        },
      );
      await t.test(
        "Concurrent duplicate borrows create one loan only",
        async () => {
          const results = await Promise.all(
            Array.from({ length: 5 }, () =>
              request("/borrows", "POST", bob.token, { bookId }),
            ),
          );
          assert.equal(
            results.filter((r) => r.status === 201).length,
            1,
            JSON.stringify(results),
          );
          assert.equal(results.filter((r) => r.status === 409).length, 4);
          assert.equal(
            (await request("/books/" + bookId, "GET", alice.token)).data
              .availableCopies,
            4,
          );
          const mine = await request("/borrows", "GET", bob.token);
          await request("/borrows/" + mine.data[0].id, "DELETE", bob.token);
        },
      );
      await t.test(
        "Competing readers cannot borrow the last copy twice",
        async () => {
          const one = await request("/books", "POST", alice.token, {
            ...input,
            totalCopies: 1,
          });
          const results = await Promise.all([
            request("/borrows", "POST", bob.token, { bookId: one.data.id }),
            request("/borrows", "POST", charlie.token, { bookId: one.data.id }),
          ]);
          assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
          assert.equal(
            (await request("/books/" + one.data.id, "GET", alice.token)).data
              .availableCopies,
            0,
          );
        },
      );
      await t.test(
        "Delete removes unborrowed book; API error/CORS responses are JSON",
        async () => {
          assert.equal(
            (await request("/books/" + bookId, "DELETE", alice.token)).status,
            204,
          );
          assert.equal(
            (await request("/books/" + bookId, "GET", alice.token)).status,
            404,
          );
          assert.equal((await request("/unknown")).status, 404);
          const disallowed = await fetch(base + "/books", {
            headers: { Origin: "https://untrusted.example" },
          });
          assert.equal(disallowed.status, 403);
          const malformed = await fetch(base + "/books", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{invalid",
          });
          assert.equal(malformed.status, 400);
        },
      );
      await t.test(
        "Sign-out immediately revokes API access for already-issued JWT",
        async () => {
          const logout = await authRequest("/sign-out", {}, bob.cookie);
          assert.equal(logout.status, 200);
          assert.equal(
            (await request("/borrows", "GET", bob.token)).status,
            401,
          );
        },
      );
      await t.test(
        "Seed is idempotent and starts with consistent inventory",
        async () => {
          const seed = () =>
            new Promise<void>((resolve, reject) => {
              const child = spawn(
                process.execPath,
                ["node_modules/tsx/dist/cli.mjs", "server/src/seed.ts"],
                {
                  env: {
                    ...process.env,
                    SEED_EMAIL: "seed-reader@example.com",
                    SEED_PASSWORD: "Reader123",
                  },
                  stdio: "pipe",
                },
              );
              let output = "";
              child.stderr.on("data", (chunk) => (output += chunk));
              child.once("error", reject);
              child.once("exit", (code) =>
                code === 0
                  ? resolve()
                  : reject(new Error(output || "Seed failed")),
              );
            });
          const { books } = await database();
          const before = await books.countDocuments();
          await seed();
          await seed();
          assert.equal(await books.countDocuments(), before + 9);
          const fixture = await books.findOne({
            title: "Stories of the Silk Road",
          });
          assert.ok(fixture);
          assert.equal(fixture.availableCopies, fixture.totalCopies);
          assert.ok(!("id" in fixture));
        },
      );
    } finally {
      await close(apiServer);
      await close(authServer);
      await closeDatabase();
      await mongo?.stop();
    }
  },
);

