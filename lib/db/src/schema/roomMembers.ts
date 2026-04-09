import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roomMembersTable = pgTable("room_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  roomId: uuid("room_id").notNull(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  avatarUrl: text("avatar_url"),
  isGuest: boolean("is_guest").notNull().default(false),
  color: text("color").notNull().default("#58A6FF"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRoomMemberSchema = createInsertSchema(roomMembersTable).omit({ id: true, joinedAt: true });
export type InsertRoomMember = z.infer<typeof insertRoomMemberSchema>;
export type RoomMember = typeof roomMembersTable.$inferSelect;
