import {
  getAuth,
  getConfig,
  closeDatabase,
} from "../../packages/auth/dist/index.js";
import { ObjectId } from "mongodb";
import { initializeDatabase } from "./database.js";
import { seedBooks } from "./fixtures/data.js";
try {
  const config = getConfig();
  if (
    config.NODE_ENV === "production" &&
    process.env.ALLOW_PRODUCTION_SEED !== "true"
  )
    throw new Error(
      "Seeding production is disabled. Set ALLOW_PRODUCTION_SEED=true explicitly if intended.",
    );
  const { db, books } = await initializeDatabase();
  const email = (process.env.SEED_EMAIL || "reader@booknook.demo")
    .trim()
    .toLowerCase();
  const password = process.env.SEED_PASSWORD || "Reader123";
  let user = await db.collection("user").findOne({ email });
  if (!user) {
    const auth = await getAuth();
    await auth.api.signUpEmail({
      body: { name: "Alex Morgan", email, password },
    });
    user = await db.collection("user").findOne({ email });
  }
  if (!user) throw new Error("Seed account could not be created.");
  for (let i = 0; i < seedBooks.length; i++) {
    const seed = seedBooks[i]!;
    const { id: sourceId, ...fields } = seed;
    void sourceId;
    const _id = new ObjectId(`aabbccdd000000000000000${i + 1}`);
    await books.updateOne(
      { _id },
      {
        $setOnInsert: {
          ...fields,
          availableCopies: seed.totalCopies,
          _id,
          ownerId: String(user._id),
          ownerName: String(user.name),
          ownerEmail: String(user.email),
          createdAt: new Date(seed.createdAt),
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );
  }
  console.log(
    `Seed complete: nine sample books; reader email ${email}. Existing data was preserved.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
