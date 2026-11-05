import { connectDatabase } from "../../packages/auth/dist/index.js";
import type { BookDocument, BorrowDocument } from "./models.js";
export async function database() {
  const { client, db } = await connectDatabase();
  return {
    client,
    db,
    books: db.collection<BookDocument>("books"),
    borrows: db.collection<BorrowDocument>("borrows"),
  };
}
export async function initializeDatabase() {
  const result = await database();
  const hello = await result.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid")
    throw new Error(
      "BookNook requires a MongoDB replica set for atomic borrow/return transactions. Use npm run db:up or MongoDB Atlas.",
    );
  await Promise.all([
    result.books.createIndex({ createdAt: -1, _id: -1 }),
    result.books.createIndex({ ownerId: 1, createdAt: -1 }),
    result.borrows.createIndex(
      { userId: 1, bookId: 1 },
      { unique: true, name: "one_active_borrow_per_reader" },
    ),
    result.borrows.createIndex({ bookId: 1 }),
    result.borrows.createIndex({ userId: 1, borrowDate: -1 }),
  ]);
  return result;
}
