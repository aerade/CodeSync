import { pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";

export const yjsSnapshotsTable = pgTable("yjs_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id").notNull(),
  fileId: uuid("file_id").notNull(),
  data: text("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  roomFileUnique: unique("yjs_snapshots_room_file_unique").on(table.roomId, table.fileId),
}));

export type YjsSnapshot = typeof yjsSnapshotsTable.$inferSelect;
