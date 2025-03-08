
import { pool } from './db';

async function migrate() {
  console.log("Starting database migration...");
  
  try {
    // Create sessions table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        data TEXT,
        expires TIMESTAMP NOT NULL
      )
    `);
    console.log("Sessions table created or already exists");

    // Create users table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        is_online BOOLEAN NOT NULL DEFAULT FALSE,
        profile_image TEXT
      )
    `);
    console.log("Users table created or already exists");

    // Create messages table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        sender_id INTEGER NOT NULL REFERENCES users(id),
        receiver_id INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        last_edited_at TIMESTAMP,
        attachment_url TEXT
      )
    `);
    console.log("Messages table created or already exists");

    // Create groups table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        profile_image TEXT
      )
    `);
    console.log("Groups table created or already exists");

    // Create group_members table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS group_members (
        group_id INTEGER NOT NULL REFERENCES groups(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        added_at TIMESTAMP NOT NULL DEFAULT NOW(),
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        PRIMARY KEY (group_id, user_id)
      )
    `);
    console.log("Group members table created or already exists");

    // Create group_messages table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS group_messages (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        sender_id INTEGER NOT NULL REFERENCES users(id),
        group_id INTEGER NOT NULL REFERENCES groups(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        last_edited_at TIMESTAMP,
        attachment_url TEXT
      )
    `);
    console.log("Group messages table created or already exists");

    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await pool.end();
  }
}

migrate();
