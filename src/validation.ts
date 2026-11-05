import { z } from "zod";
export const idSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid resource ID.");
const image = z
  .string()
  .max(2048)
  .refine((value) => {
    if (/^\/covers\/book-[1-9]\.svg$/.test(value)) return true;
    try {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Provide an HTTP(S) image URL.");
export const bookSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    author: z.string().trim().min(1).max(100),
    category: z.enum(["Fiction", "Science", "History", "Kids", "Others"]),
    image,
    description: z.string().trim().min(15).max(2000),
    totalCopies: z.number().int().min(1).max(10000),
  })
  .strict();
export const patchSchema = bookSchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    "Provide at least one field.",
  );
export const borrowSchema = z.object({ bookId: idSchema }).strict();
export const querySchema = z
  .object({
    sort: z.enum(["newest", "title"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    mine: z.enum(["true", "false"]).optional(),
  })
  .strict();
