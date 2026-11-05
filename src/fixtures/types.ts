export const categories = [
  "Fiction",
  "Science",
  "History",
  "Kids",
  "Others",
] as const;
export type Category = (typeof categories)[number];
export type User = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};
export type Book = {
  id: string;
  title: string;
  author: string;
  category: Category;
  image: string;
  description: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  createdAt: string;
  totalCopies: number;
  availableCopies: number;
};
export type Borrow = {
  id: string;
  bookId: string;
  bookTitle: string;
  bookImage: string;
  userId: string;
  userEmail: string;
  borrowDate: string;
  returnDate: string;
};
export type BookInput = Pick<
  Book,
  "title" | "author" | "category" | "image" | "description" | "totalCopies"
>;
