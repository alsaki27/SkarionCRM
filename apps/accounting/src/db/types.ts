import type { getDb } from "@skarion/db-kit";
import type * as schema from "./schema.js";

export type BooksDb = ReturnType<typeof getDb<typeof schema>>;
