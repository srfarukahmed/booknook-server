import type { ObjectId } from "mongodb";
export type BookDocument = {
  _id: ObjectId;
  title: string;
  author: string;
  category: "Fiction" | "Science" | "History" | "Kids" | "Others";
  image: string;
  description: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  createdAt: Date;
  updatedAt: Date;
  totalCopies: number;
  availableCopies: number;
};
export type BorrowDocument = {
  _id: ObjectId;
  bookId: string;
  bookTitle: string;
  bookImage: string;
  userId: string;
  userEmail: string;
  borrowDate: Date;
  returnDate: Date;
};
export type Reader = { id: string; name: string; email: string };
export function serialize<T extends { _id: ObjectId }>(doc: T) {
  const { _id, ...rest } = doc;
  return { id: _id.toHexString(), ...rest };
}
