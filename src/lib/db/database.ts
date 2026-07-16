import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'fb-publisher.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      fb_group_id TEXT NOT NULL,
      url TEXT NOT NULL,
      category TEXT,
      publish_method TEXT NOT NULL DEFAULT 'auto',
      is_active INTEGER NOT NULL DEFAULT 1,
      max_posts_per_day INTEGER NOT NULL DEFAULT 3,
      cooldown_minutes INTEGER NOT NULL DEFAULT 60,
      last_published_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      body TEXT NOT NULL,
      variables TEXT NOT NULL DEFAULT '[]',
      images TEXT DEFAULT '[]',
      tags TEXT DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS publications (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      publish_method TEXT,
      error TEXT,
      fb_post_id TEXT,
      scheduled_at TEXT,
      published_at TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES groups(id),
      FOREIGN KEY (template_id) REFERENCES templates(id)
    );

    CREATE TABLE IF NOT EXISTS schedule_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      group_ids TEXT NOT NULL DEFAULT '[]',
      template_ids TEXT NOT NULL DEFAULT '[]',
      cron_expression TEXT NOT NULL,
      rotation_index INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      timezone TEXT NOT NULL DEFAULT 'America/Bogota',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_publications_status ON publications(status);
    CREATE INDEX IF NOT EXISTS idx_publications_group ON publications(group_id);
    CREATE INDEX IF NOT EXISTS idx_publications_scheduled ON publications(scheduled_at);
  `);

  migrateGroupsMembershipColumns(db);
}

/**
 * Adds membership tracking columns to a `groups` table created before they
 * existed. SQLite has no "ADD COLUMN IF NOT EXISTS", so check first.
 */
function migrateGroupsMembershipColumns(db: Database.Database) {
  const columns = db.prepare(`PRAGMA table_info(groups)`).all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((c) => c.name));

  if (!columnNames.has('membership_status')) {
    db.exec(`ALTER TABLE groups ADD COLUMN membership_status TEXT NOT NULL DEFAULT 'unknown'`);
  }
  if (!columnNames.has('membership_checked_at')) {
    db.exec(`ALTER TABLE groups ADD COLUMN membership_checked_at TEXT`);
  }
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
