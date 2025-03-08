import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { messages, users, groups, groupMembers, groupMessages } from "@shared/schema";
import { eq, and, or, desc, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";

const client = postgres(process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/postgres");
const db = drizzle(client);

export const storage = {
  async getAllUsers() {
    return await db.select().from(users).orderBy(users.username);
  },

  async createUser(username: string, password: string) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db
      .insert(users)
      .values({ username, password: hashedPassword })
      .returning();
    return result[0];
  },

  async getUserByUsername(username: string) {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return result[0];
  },

  async getUserById(id: number) {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  },

  async setUserOnlineStatus(userId: number, isOnline: boolean) {
    await db
      .update(users)
      .set({ isOnline })
      .where(eq(users.id, userId));
  },

  async updateProfileImage(userId: number, profileImage: string) {
    await db
      .update(users)
      .set({ profileImage })
      .where(eq(users.id, userId));
  },

  async createMessage(senderId: number, message: { content: string, receiverId: number, attachmentUrl?: string }) {
    const result = await db
      .insert(messages)
      .values({
        senderId,
        receiverId: message.receiverId,
        content: message.content,
        attachmentUrl: message.attachmentUrl
      })
      .returning();
    return result[0];
  },

  async getMessage(messageId: number) {
    const result = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId));
    return result[0];
  },

  async getMessages(userId1: number, userId2: number) {
    return await db
      .select()
      .from(messages)
      .where(
        or(
          and(
            eq(messages.senderId, userId1),
            eq(messages.receiverId, userId2)
          ),
          and(
            eq(messages.senderId, userId2),
            eq(messages.receiverId, userId1)
          )
        )
      )
      .orderBy(messages.createdAt);
  },

  async markMessageAsRead(messageId: number) {
    await db
      .update(messages)
      .set({ isRead: true })
      .where(eq(messages.id, messageId));
  },

  async editMessage(messageId: number, content: string) {
    const result = await db
      .update(messages)
      .set({ 
        content,
        lastEditedAt: new Date()
      })
      .where(eq(messages.id, messageId))
      .returning();
    return result[0];
  },

  async deleteMessage(messageId: number) {
    await db
      .update(messages)
      .set({ isDeleted: true })
      .where(eq(messages.id, messageId));
  },

  async deleteChatHistory(userId1: number, userId2: number) {
    await db
      .update(messages)
      .set({ isDeleted: true })
      .where(
        or(
          and(
            eq(messages.senderId, userId1),
            eq(messages.receiverId, userId2)
          ),
          and(
            eq(messages.senderId, userId2),
            eq(messages.receiverId, userId1)
          )
        )
      );
  },

  async getUnreadMessageCount(userId: number) {
    const result = await db
      .select({
        senderId: messages.senderId,
        count: sql<number>`count(*)`,
      })
      .from(messages)
      .where(
        and(
          eq(messages.receiverId, userId),
          eq(messages.isRead, false),
          eq(messages.isDeleted, false)
        )
      )
      .groupBy(messages.senderId);

    const counts: Record<number, number> = {};
    result.forEach((row) => {
      counts[row.senderId] = Number(row.count);
    });
    return counts;
  },

  // Group chat functions
  async createGroup(userId: number, group: { name: string, members: number[], profileImage?: string }) {
    const result = await db.transaction(async (tx) => {
      // Create the group
      const newGroup = await tx
        .insert(groups)
        .values({
          name: group.name,
          createdBy: userId,
          profileImage: group.profileImage
        })
        .returning();

      // Add the creator as admin
      await tx
        .insert(groupMembers)
        .values({
          groupId: newGroup[0].id,
          userId: userId,
          isAdmin: true
        });

      // Add other members
      if (group.members.length > 0) {
        const memberValues = group.members.map(memberId => ({
          groupId: newGroup[0].id,
          userId: memberId,
          isAdmin: false
        }));

        await tx
          .insert(groupMembers)
          .values(memberValues);
      }

      return newGroup[0];
    });

    return result;
  },

  async getGroupById(groupId: number) {
    const result = await db
      .select()
      .from(groups)
      .where(eq(groups.id, groupId));
    return result[0];
  },

  async getUserGroups(userId: number) {
    const result = await db
      .select({
        group: groups
      })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(eq(groupMembers.userId, userId));

    return result.map(row => row.group);
  },

  async getGroupMembers(groupId: number) {
    const result = await db
      .select({
        user: users,
        isAdmin: groupMembers.isAdmin
      })
      .from(groupMembers)
      .innerJoin(users, eq(groupMembers.userId, users.id))
      .where(eq(groupMembers.groupId, groupId));

    return result.map(row => ({
      ...row.user,
      isAdmin: row.isAdmin
    }));
  },

  async addMemberToGroup(groupId: number, userId: number, isAdmin: boolean = false) {
    await db
      .insert(groupMembers)
      .values({
        groupId,
        userId,
        isAdmin
      })
      .onConflictDoNothing();
  },

  async removeMemberFromGroup(groupId: number, userId: number) {
    await db
      .delete(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, userId)
        )
      );
  },

  async createGroupMessage(senderId: number, message: { content: string, groupId: number, attachmentUrl?: string }) {
    const result = await db
      .insert(groupMessages)
      .values({
        senderId,
        groupId: message.groupId,
        content: message.content,
        attachmentUrl: message.attachmentUrl
      })
      .returning();
    return result[0];
  },

  async getGroupMessages(groupId: number) {
    return await db
      .select({
        message: groupMessages,
        sender: users
      })
      .from(groupMessages)
      .innerJoin(users, eq(groupMessages.senderId, users.id))
      .where(eq(groupMessages.groupId, groupId))
      .orderBy(groupMessages.createdAt);
  },

  async editGroupMessage(messageId: number, content: string) {
    const result = await db
      .update(groupMessages)
      .set({ 
        content,
        lastEditedAt: new Date()
      })
      .where(eq(groupMessages.id, messageId))
      .returning();
    return result[0];
  },

  async deleteGroupMessage(messageId: number) {
    await db
      .update(groupMessages)
      .set({ isDeleted: true })
      .where(eq(groupMessages.id, messageId));
  },

  async isUserInGroup(userId: number, groupId: number) {
    const result = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.userId, userId),
          eq(groupMembers.groupId, groupId)
        )
      );
    return result.length > 0;
  },

  async isUserGroupAdmin(userId: number, groupId: number) {
    const result = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.userId, userId),
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.isAdmin, true)
        )
      );
    return result.length > 0;
  }
};

// Import for SQL aggregate function
import { sql } from "drizzle-orm";

export const sessionStore = {
  async createSession(sessionId: string, data: any, expiresAt: Date) {
    // We'd use a dedicated sessions table in a real app
    await client.query(
      "INSERT INTO sessions (id, data, expires) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET data = $2, expires = $3",
      [sessionId, JSON.stringify(data), expiresAt]
    );
  },

  async getSession(sessionId: string) {
    const result = await client.query(
      "SELECT data FROM sessions WHERE id = $1 AND expires > NOW()",
      [sessionId]
    );
    if (result.count === 0) return null;
    try {
      return JSON.parse(result[0].data);
    } catch (err) {
      return null;
    }
  },

  async destroySession(sessionId: string) {
    await client.query("DELETE FROM sessions WHERE id = $1", [sessionId]);
  },
};