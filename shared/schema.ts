import { pgTable, text, serial, integer, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isOnline: boolean("is_online").notNull().default(false),
  profileImage: text("profile_image"),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  senderId: integer("sender_id").notNull().references(() => users.id),
  receiverId: integer("receiver_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  isRead: boolean("is_read").notNull().default(false),
  isDeleted: boolean("is_deleted").notNull().default(false),
  lastEditedAt: timestamp("last_edited_at"),
  attachmentUrl: text("attachment_url"),
});

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  profileImage: text("profile_image"),
});

export const groupMembers = pgTable("group_members", {
  groupId: integer("group_id").notNull().references(() => groups.id),
  userId: integer("user_id").notNull().references(() => users.id),
  addedAt: timestamp("added_at").notNull().defaultNow(),
  isAdmin: boolean("is_admin").notNull().default(false),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.groupId, table.userId] }),
  };
});

export const groupMessages = pgTable("group_messages", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  senderId: integer("sender_id").notNull().references(() => users.id),
  groupId: integer("group_id").notNull().references(() => groups.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  isDeleted: boolean("is_deleted").notNull().default(false),
  lastEditedAt: timestamp("last_edited_at"),
  attachmentUrl: text("attachment_url"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  content: true,
  receiverId: true,
}).extend({
  attachmentUrl: z.string().optional(),
});

export const insertGroupSchema = createInsertSchema(groups).pick({
  name: true,
}).extend({
  members: z.array(z.number()),
  profileImage: z.string().optional(),
});

export const insertGroupMessageSchema = createInsertSchema(groupMessages).pick({
  content: true,
  groupId: true,
}).extend({
  attachmentUrl: z.string().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Group = typeof groups.$inferSelect;
export type GroupMember = typeof groupMembers.$inferSelect;
export type GroupMessage = typeof groupMessages.$inferSelect;
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type InsertGroupMessage = z.infer<typeof insertGroupMessageSchema>;