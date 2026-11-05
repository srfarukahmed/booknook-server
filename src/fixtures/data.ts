import { Book, User } from "./types.js";
export const demoUser: User = {
  id: "reader-demo",
  name: "Alex Morgan",
  email: "reader@booknook.demo",
};
const titles: [string, string, Book["category"], string][] = [
  [
    "The Quiet Forest",
    "Elena Woods",
    "Fiction",
    "A botanist returns to her childhood village and discovers the stories held by its ancient woodland. A gentle novel about belonging, memory, and starting again.",
  ],
  [
    "A Universe of Questions",
    "Daniel Reed",
    "Science",
    "From the smallest particles to distant galaxies, explore the questions that keep scientists curious. Clear explanations and thoughtful experiments invite every reader to look a little closer.",
  ],
  [
    "Letters from Yesterday",
    "Amelia Hart",
    "History",
    "Follow a collection of letters across three generations and discover how ordinary people lived through extraordinary change. A thoughtful journey through everyday history.",
  ],
  [
    "The Little Moon Explorer",
    "Maya Chen",
    "Kids",
    "Luna builds a cardboard rocket and sets off on an imaginative adventure. A warm story about curiosity, friendship, and the wonders waiting just outside your window.",
  ],
  [
    "The Art of Slowing Down",
    "Oliver James",
    "Others",
    "Small, practical rituals for making space in a busy life. Discover the pleasure of focused attention, unhurried walks, and a chapter read just for yourself.",
  ],
  [
    "Beyond the Blue Horizon",
    "Sofia Bennett",
    "Fiction",
    "Two strangers meet on the last ferry of the season. As a storm changes their plans, they find courage to rewrite the futures they thought were already decided.",
  ],
  [
    "The Hidden Garden",
    "Isabel Green",
    "Fiction",
    "An unexpected inheritance leads a young gardener to a locked courtyard, an unfinished journal, and a friendship that will change the shape of her life.",
  ],
  [
    "Wonders of the Natural World",
    "Noah Brooks",
    "Science",
    "Travel through coral reefs, mountain forests, and desert skies to understand the remarkable systems that connect all living things.",
  ],
  [
    "Stories of the Silk Road",
    "Leila Ahmed",
    "History",
    "An accessible introduction to the merchants, travelers, and ideas that shaped the routes connecting continents.",
  ],
];
export const seedBooks: Book[] = titles.map((t, i) => ({
  id: `book-${i + 1}`,
  title: t[0],
  author: t[1],
  category: t[2] as Book["category"],
  description: t[3],
  image: `/covers/book-${i + 1}.svg`,
  ownerId: i < 2 ? demoUser.id : "community-curator",
  ownerName: i < 2 ? demoUser.name : "BookNook Community",
  ownerEmail: i < 2 ? demoUser.email : "hello@booknook.example",
  createdAt: new Date(Date.UTC(2026, 9, 25 - i)).toISOString(),
  totalCopies: 3,
  availableCopies: i === 8 ? 0 : 3,
}));
