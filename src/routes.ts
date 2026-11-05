import { Router } from "express";
import { ObjectId, ClientSession } from "mongodb";
import { database } from "./database.js";
import { jwtGuard } from "./auth.js";
import { HttpError } from "./errors.js";
import {
  bookSchema,
  patchSchema,
  borrowSchema,
  idSchema,
  querySchema,
} from "./validation.js";
import { serialize, BookDocument, BorrowDocument } from "./models.js";

async function transaction<T>(
  operation: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const { client } = await database();
  const session = client.startSession();
  try {
    return (await session.withTransaction(() => operation(session), {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      maxCommitTimeMS: 10000,
    })) as T;
  } finally {
    await session.endSession();
  }
}
export function libraryRoutes() {
  const router = Router();
  const protect = jwtGuard();
  router.get("/books", async (req, res, next) => {
    const query = querySchema.parse(req.query);
    if (query.mine === "true")
      return protect(req, res, async (error?: unknown) => {
        if (error) return next(error);
        try {
          const { books } = await database();
          let cursor = books
            .find({ ownerId: res.locals.reader.id })
            .sort(
              query.sort === "title"
                ? { title: 1, _id: 1 }
                : { createdAt: -1, _id: -1 },
            );
          if (query.limit) cursor = cursor.limit(query.limit);
          res.json((await cursor.toArray()).map(serialize));
        } catch (e) {
          next(e);
        }
      });
    const { books } = await database();
    let cursor = books
      .find({})
      .sort(
        query.sort === "title"
          ? { title: 1, _id: 1 }
          : { createdAt: -1, _id: -1 },
      );
    if (query.limit) cursor = cursor.limit(query.limit);
    res.json((await cursor.toArray()).map(serialize));
  });
  router.get("/books/:id", protect, async (req, res) => {
    const id = new ObjectId(idSchema.parse(req.params.id));
    const { books } = await database();
    const book = await books.findOne({ _id: id });
    if (!book) throw new HttpError(404, "Book not found.");
    res.json(serialize(book));
  });
  router.post("/books", protect, async (req, res) => {
    const input = bookSchema.parse(req.body);
    const reader = res.locals.reader;
    const now = new Date();
    const doc: BookDocument = {
      _id: new ObjectId(),
      ...input,
      ownerId: reader.id,
      ownerName: reader.name,
      ownerEmail: reader.email,
      createdAt: now,
      updatedAt: now,
      availableCopies: input.totalCopies,
    };
    const { books } = await database();
    await books.insertOne(doc);
    res.status(201).json(serialize(doc));
  });
  router.patch("/books/:id", protect, async (req, res) => {
    const id = new ObjectId(idSchema.parse(req.params.id));
    const input = patchSchema.parse(req.body);
    const { books } = await database();
    const updated = await transaction(async (session) => {
      const old = await books.findOne({ _id: id }, { session });
      if (!old) throw new HttpError(404, "Book not found.");
      if (old.ownerId !== res.locals.reader.id)
        throw new HttpError(403, "You can only edit your own books.");
      const borrowed = old.totalCopies - old.availableCopies;
      const total = input.totalCopies ?? old.totalCopies;
      if (total < borrowed)
        throw new HttpError(
          409,
          `At least ${borrowed} copies are currently borrowed.`,
        );
      const result = await books.findOneAndUpdate(
        { _id: id },
        {
          $set: {
            ...input,
            totalCopies: total,
            availableCopies: total - borrowed,
            updatedAt: new Date(),
          },
        },
        { session, returnDocument: "after" },
      );
      if (!result) throw new HttpError(404, "Book not found.");
      return result;
    });
    res.json(serialize(updated));
  });
  router.delete("/books/:id", protect, async (req, res) => {
    const id = new ObjectId(idSchema.parse(req.params.id));
    const { books, borrows } = await database();
    await transaction(async (session) => {
      const book = await books.findOne({ _id: id }, { session });
      if (!book) throw new HttpError(404, "Book not found.");
      if (book.ownerId !== res.locals.reader.id)
        throw new HttpError(403, "You can only delete your own books.");
      if (
        book.availableCopies !== book.totalCopies ||
        (await borrows.findOne({ bookId: id.toHexString() }, { session }))
      )
        throw new HttpError(
          409,
          "Return all borrowed copies before deleting this book.",
        );
      await books.deleteOne({ _id: id }, { session });
    });
    res.status(204).end();
  });
  router.post("/borrows", protect, async (req, res) => {
    const { bookId } = borrowSchema.parse(req.body);
    const id = new ObjectId(bookId);
    const normalized = id.toHexString();
    const reader = res.locals.reader;
    const { books, borrows } = await database();
    const record = await transaction(async (session) => {
      if (
        await borrows.findOne(
          { bookId: normalized, userId: reader.id },
          { session },
        )
      )
        throw new HttpError(409, "You already have a copy of this book.");
      // This write conflicts with concurrent borrow, return, edit, or delete operations on this book.
      const book = await books.findOneAndUpdate(
        { _id: id, availableCopies: { $gt: 0 } },
        { $inc: { availableCopies: -1 }, $set: { updatedAt: new Date() } },
        { session, returnDocument: "after" },
      );
      if (!book) {
        if (!(await books.findOne({ _id: id }, { session })))
          throw new HttpError(404, "Book not found.");
        throw new HttpError(409, "This book is not available.");
      }
      const now = new Date();
      const borrow: BorrowDocument = {
        _id: new ObjectId(),
        bookId: normalized,
        bookTitle: book.title,
        bookImage: book.image,
        userId: reader.id,
        userEmail: reader.email,
        borrowDate: now,
        returnDate: new Date(now.getTime() + 14 * 86400000),
      };
      await borrows.insertOne(borrow, { session });
      return borrow;
    });
    res.status(201).json(serialize(record));
  });
  router.get("/borrows", protect, async (_req, res) => {
    const { borrows } = await database();
    res.json(
      (
        await borrows
          .find({ userId: res.locals.reader.id })
          .sort({ borrowDate: -1, _id: -1 })
          .toArray()
      ).map(serialize),
    );
  });
  router.delete("/borrows/:id", protect, async (req, res) => {
    const id = new ObjectId(idSchema.parse(req.params.id));
    const { books, borrows } = await database();
    await transaction(async (session) => {
      const borrow = await borrows.findOne({ _id: id }, { session });
      if (!borrow) throw new HttpError(404, "Borrow record not found.");
      if (borrow.userId !== res.locals.reader.id)
        throw new HttpError(
          403,
          "You can only return your own borrowed books.",
        );
      const update = await books.updateOne(
        {
          _id: new ObjectId(borrow.bookId),
          $expr: { $lt: ["$availableCopies", "$totalCopies"] },
        },
        { $inc: { availableCopies: 1 }, $set: { updatedAt: new Date() } },
        { session },
      );
      if (update.modifiedCount !== 1)
        throw new HttpError(
          409,
          "Book inventory is inconsistent. Contact the library administrator.",
        );
      await borrows.deleteOne(
        { _id: id, userId: res.locals.reader.id },
        { session },
      );
    });
    res.status(204).end();
  });
  return router;
}
