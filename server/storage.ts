import { User, Message, InsertUser, InsertMessage } from "@shared/schema";
import session from "express-session";
import { db } from "./db";
import { users, messages } from "@shared/schema";
import { eq, or, and } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  setUserOnlineStatus(userId: number, isOnline: boolean): Promise<void>;
  createMessage(senderId: number, message: InsertMessage): Promise<Message>;
  getMessages(userId1: number, userId2: number): Promise<Message[]>;
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error('Error getting user:', error);
      throw new Error('Failed to get user');
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      return user;
    } catch (error) {
      console.error('Error getting user by username:', error);
      throw new Error('Failed to get user by username');
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const [user] = await db.insert(users).values({
        ...insertUser,
        isOnline: false
      }).returning();
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Failed to create user');
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      return await db.select().from(users);
    } catch (error) {
      console.error('Error getting all users:', error);
      throw new Error('Failed to get all users');
    }
  }

  async setUserOnlineStatus(userId: number, isOnline: boolean): Promise<void> {
    try {
      await db
        .update(users)
        .set({ isOnline })
        .where(eq(users.id, userId));
    } catch (error) {
      console.error('Error setting user online status:', error);
      throw new Error('Failed to set user online status');
    }
  }

  async createMessage(senderId: number, message: InsertMessage): Promise<Message> {
    try {
      const [newMessage] = await db
        .insert(messages)
        .values({
          senderId,
          content: message.content,
          receiverId: message.receiverId,
        })
        .returning();
      return newMessage;
    } catch (error) {
      console.error('Error creating message:', error);
      throw new Error('Failed to create message');
    }
  }

  async getMessages(userId1: number, userId2: number): Promise<Message[]> {
    try {
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
    } catch (error) {
      console.error('Error getting messages:', error);
      throw new Error('Failed to get messages');
    }
  }
}

export const storage = new DatabaseStorage();