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
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      proxy_server TEXT,
      proxy_username TEXT,
      proxy_password TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

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

    CREATE TABLE IF NOT EXISTS app_settings (
      id TEXT PRIMARY KEY,
      jitter_min_minutes INTEGER NOT NULL,
      jitter_max_minutes INTEGER NOT NULL,
      global_min_gap_minutes INTEGER NOT NULL,
      max_posts_per_day_total INTEGER NOT NULL,
      cross_account_min_gap_minutes INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  migrateGroupsMembershipColumns(db);
  migrateScheduleRulesJitterColumn(db);
  migrateAccountScoping(db);
  migrateBehaviorSettings(db);
}

/**
 * Seeds the single app_settings row on first run, so the anti-detection
 * knobs (jitter, gaps, daily cap) become dashboard-editable instead of
 * .env-only. Seeds from whatever was in .env.local at the time of this
 * upgrade, so installs that already tuned these values via the old env
 * vars don't silently reset to the hardcoded defaults.
 */
function migrateBehaviorSettings(db: Database.Database) {
  const existing = db.prepare(`SELECT id FROM app_settings WHERE id = 'global'`).get();
  if (existing) return;

  db.prepare(`
    INSERT INTO app_settings (
      id, jitter_min_minutes, jitter_max_minutes, global_min_gap_minutes,
      max_posts_per_day_total, cross_account_min_gap_minutes
    ) VALUES ('global', ?, ?, ?, ?, ?)
  `).run(
    parseInt(process.env.SCHEDULER_JITTER_MIN_MINUTES || '0', 10),
    parseInt(process.env.SCHEDULER_JITTER_MAX_MINUTES || '20', 10),
    parseInt(process.env.SCHEDULER_GLOBAL_MIN_GAP_MINUTES || '8', 10),
    parseInt(process.env.SCHEDULER_MAX_POSTS_PER_DAY_TOTAL || '12', 10),
    parseInt(process.env.SCHEDULER_CROSS_ACCOUNT_MIN_GAP_MINUTES || '3', 10),
  );
}

/**
 * Introduces multi-account support on a database created before it existed.
 * Backfills every existing row onto a synthetic `default` account so
 * installs upgrading in place don't lose data or need manual migration.
 */
function migrateAccountScoping(db: Database.Database) {
  const existing = db.prepare(`SELECT id FROM accounts WHERE id = 'default'`).get();
  if (!existing) {
    db.prepare(`
      INSERT INTO accounts (id, name) VALUES ('default', 'Cuenta principal')
    `).run();
  }

  addAccountIdColumn(db, 'groups');
  addAccountIdColumn(db, 'templates');
  addAccountIdColumn(db, 'schedule_rules');
  addAccountIdColumn(db, 'publications');

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_groups_account ON groups(account_id);
    CREATE INDEX IF NOT EXISTS idx_templates_account ON templates(account_id);
    CREATE INDEX IF NOT EXISTS idx_schedule_rules_account ON schedule_rules(account_id);
    CREATE INDEX IF NOT EXISTS idx_publications_account ON publications(account_id);
  `);
}

function addAccountIdColumn(db: Database.Database, table: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((c) => c.name === 'account_id')) {
    // SQLite disallows a REFERENCES clause on ADD COLUMN when paired with a
    // non-NULL default, so this stays an app-level reference (same as the
    // existing group_id/template_id columns added via ALTER elsewhere).
    db.exec(`ALTER TABLE ${table} ADD COLUMN account_id TEXT NOT NULL DEFAULT 'default'`);
  }
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

/**
 * Adds the jitter opt-out column to `schedule_rules` created before it existed.
 */
function migrateScheduleRulesJitterColumn(db: Database.Database) {
  const columns = db.prepare(`PRAGMA table_info(schedule_rules)`).all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((c) => c.name));

  if (!columnNames.has('use_jitter')) {
    db.exec(`ALTER TABLE schedule_rules ADD COLUMN use_jitter INTEGER NOT NULL DEFAULT 1`);
  }
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
