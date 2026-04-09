import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const fileSnapshotsTable = pgTable("file_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id").notNull(),
  roomId: uuid("room_id").notNull(),
  content: text("content").notNull().default(""),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FileSnapshot = typeof fileSnapshotsTable.$inferSelect;
