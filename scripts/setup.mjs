import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env")) {
  console.log(".env already exists; it was not changed.");
} else {
  const template = readFileSync(".env.example", "utf8").replace(
    "REPLACE_WITH_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS",
    randomBytes(48).toString("base64url"),
  );
  writeFileSync(".env", template, { mode: 0o600 });
  console.log(
    "Created .env with a random BetterAuth secret. Set MongoDB / Google / imgbb values as needed.",
  );
}
