import { v4 as uuid } from 'uuid';
import { getDb } from './database';
import type { FacebookAccount, FacebookGroup, GroupTag, AdTemplate, Publication, ScheduleRule, BehaviorSettings } from '../types';

// ─── Accounts ───

export const accountsRepo = {
  getAll(): FacebookAccount[] {
    const rows = getDb().prepare('SELECT * FROM accounts ORDER BY name').all() as any[];
    return rows.map(rowToAccount);
  },

  getActive(): FacebookAccount[] {
    const rows = getDb().prepare('SELECT * FROM accounts WHERE is_active = 1 ORDER BY name').all() as any[];
    return rows.map(rowToAccount);
  },

  getById(id: string): FacebookAccount | null {
    const row = getDb().prepare('SELECT * FROM accounts WHERE id = ?').get(id) as any;
    return row ? rowToAccount(row) : null;
  },

  create(data: Omit<FacebookAccount, 'id' | 'createdAt' | 'updatedAt'>): FacebookAccount {
    const id = uuid();
    const now = new Date().toISOString();
    getDb().prepare(`
      INSERT INTO accounts (id, name, proxy_server, proxy_username, proxy_password, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.name, data.proxy?.server ?? null, data.proxy?.username ?? null, data.proxy?.password ?? null, data.isActive ? 1 : 0);
    return { ...data, id, createdAt: now, updatedAt: now };
  },

  update(id: string, data: Partial<Omit<FacebookAccount, 'proxy'>> & { proxy?: FacebookAccount['proxy'] | null }): void {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.proxy !== undefined) {
      fields.push('proxy_server = ?'); values.push(data.proxy?.server ?? null);
      fields.push('proxy_username = ?'); values.push(data.proxy?.username ?? null);
      fields.push('proxy_password = ?'); values.push(data.proxy?.password ?? null);
    }
    if (data.isActive !== undefined) { fields.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }
    fields.push("updated_at = datetime('now')");
    getDb().prepare(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
  },

  delete(id: string): void {
    getDb().prepare('DELETE FROM accounts WHERE id = ?').run(id);
  },
};

// ─── Groups ───

export const groupsRepo = {
  getAll(accountId?: string): FacebookGroup[] {
    const rows = accountId
      ? getDb().prepare('SELECT * FROM groups WHERE account_id = ? ORDER BY name').all(accountId) as any[]
      : getDb().prepare('SELECT * FROM groups ORDER BY name').all() as any[];
    return attachTags(rows.map(rowToGroup));
  },

  getActive(accountId?: string): FacebookGroup[] {
    const rows = accountId
      ? getDb().prepare('SELECT * FROM groups WHERE is_active = 1 AND account_id = ? ORDER BY name').all(accountId) as any[]
      : getDb().prepare('SELECT * FROM groups WHERE is_active = 1 ORDER BY name').all() as any[];
    return attachTags(rows.map(rowToGroup));
  },

  /** Active groups carrying ANY of the given tags. Empty `tagIds` means all active groups. */
  getActiveByTags(tagIds: string[], accountId?: string): FacebookGroup[] {
    if (tagIds.length === 0) return this.getActive(accountId);
    const placeholders = tagIds.map(() => '?').join(', ');
    const sql = `
      SELECT DISTINCT g.* FROM groups g
      JOIN group_tags gt ON gt.group_id = g.id
      WHERE g.is_active = 1 AND gt.tag_id IN (${placeholders})
        ${accountId ? 'AND g.account_id = ?' : ''}
      ORDER BY g.name
    `;
    const args = accountId ? [...tagIds, accountId] : tagIds;
    const rows = getDb().prepare(sql).all(...args) as any[];
    return attachTags(rows.map(rowToGroup));
  },

  getById(id: string): FacebookGroup | null {
    const row = getDb().prepare('SELECT * FROM groups WHERE id = ?').get(id) as any;
    return row ? attachTags([rowToGroup(row)])[0] : null;
  },

  /** Adds a tag to many groups at once, ignoring pairs that already exist. */
  addTagToGroups(tagId: string, groupIds: string[]): void {
    const stmt = getDb().prepare('INSERT OR IGNORE INTO group_tags (group_id, tag_id) VALUES (?, ?)');
    getDb().transaction(() => {
      for (const gid of groupIds) stmt.run(gid, tagId);
    })();
  },

  removeTagFromGroups(tagId: string, groupIds: string[]): void {
    const stmt = getDb().prepare('DELETE FROM group_tags WHERE group_id = ? AND tag_id = ?');
    getDb().transaction(() => {
      for (const gid of groupIds) stmt.run(gid, tagId);
    })();
  },

  /** Replaces the full tag set of one group. */
  setTags(groupId: string, tagIds: string[]): void {
    const del = getDb().prepare('DELETE FROM group_tags WHERE group_id = ?');
    const ins = getDb().prepare('INSERT OR IGNORE INTO group_tags (group_id, tag_id) VALUES (?, ?)');
    getDb().transaction(() => {
      del.run(groupId);
      for (const tid of tagIds) ins.run(groupId, tid);
    })();
  },

  create(
    data: Omit<FacebookGroup, 'id' | 'createdAt' | 'updatedAt' | 'membershipStatus' | 'membershipCheckedAt' | 'tagIds'>
      & { tagIds?: string[] }
  ): FacebookGroup {
    const id = uuid();
    const now = new Date().toISOString();
    getDb().prepare(`
      INSERT INTO groups (id, account_id, name, fb_group_id, url, category, is_active, max_posts_per_day, cooldown_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.accountId, data.name, data.fbGroupId, data.url, data.category ?? null, data.isActive ? 1 : 0, data.maxPostsPerDay, data.cooldownMinutes);
    if (data.tagIds?.length) this.setTags(id, data.tagIds);
    return { ...data, tagIds: data.tagIds ?? [], id, createdAt: now, updatedAt: now, membershipStatus: 'unknown' };
  },

  /** Bulk-inserts groups in a single transaction. Callers own dedup/validation. */
  createMany(
    rows: Array<
      Omit<FacebookGroup, 'id' | 'createdAt' | 'updatedAt' | 'membershipStatus' | 'membershipCheckedAt' | 'tagIds'>
        & { tagIds?: string[] }
    >
  ): FacebookGroup[] {
    const db = getDb();
    const insert = db.prepare(`
      INSERT INTO groups (id, account_id, name, fb_group_id, url, category, is_active, max_posts_per_day, cooldown_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertTag = db.prepare('INSERT OR IGNORE INTO group_tags (group_id, tag_id) VALUES (?, ?)');
    const now = new Date().toISOString();
    const created: FacebookGroup[] = [];
    const insertAll = db.transaction((items: typeof rows) => {
      for (const data of items) {
        const id = uuid();
        insert.run(id, data.accountId, data.name, data.fbGroupId, data.url, data.category ?? null, data.isActive ? 1 : 0, data.maxPostsPerDay, data.cooldownMinutes);
        for (const tagId of data.tagIds ?? []) insertTag.run(id, tagId);
        created.push({ ...data, tagIds: data.tagIds ?? [], id, createdAt: now, updatedAt: now, membershipStatus: 'unknown' });
      }
    });
    insertAll(rows);
    return created;
  },

  update(id: string, data: Partial<FacebookGroup>): void {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.url !== undefined) { fields.push('url = ?'); values.push(data.url); }
    if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category); }
    if (data.isActive !== undefined) { fields.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }
    if (data.maxPostsPerDay !== undefined) { fields.push('max_posts_per_day = ?'); values.push(data.maxPostsPerDay); }
    if (data.cooldownMinutes !== undefined) { fields.push('cooldown_minutes = ?'); values.push(data.cooldownMinutes); }
    if (data.lastPublishedAt !== undefined) { fields.push('last_published_at = ?'); values.push(data.lastPublishedAt); }
    if (data.membershipStatus !== undefined) { fields.push('membership_status = ?'); values.push(data.membershipStatus); }
    if (data.membershipCheckedAt !== undefined) { fields.push('membership_checked_at = ?'); values.push(data.membershipCheckedAt); }
    fields.push("updated_at = datetime('now')");
    getDb().prepare(`UPDATE groups SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
  },

  delete(id: string): void {
    getDb().prepare('DELETE FROM groups WHERE id = ?').run(id);
  },
};

// ─── Tags ───

export const tagsRepo = {
  /** Tags with their group count resolved in a single query. */
  getAll(accountId?: string): GroupTag[] {
    const sql = `
      SELECT t.*, COUNT(gt.group_id) AS group_count
      FROM tags t
      LEFT JOIN group_tags gt ON gt.tag_id = t.id
      ${accountId ? 'WHERE t.account_id = ?' : ''}
      GROUP BY t.id
      ORDER BY t.name
    `;
    const rows = (accountId
      ? getDb().prepare(sql).all(accountId)
      : getDb().prepare(sql).all()) as any[];
    return rows.map(rowToTag);
  },

  getById(id: string): GroupTag | null {
    const row = getDb().prepare('SELECT * FROM tags WHERE id = ?').get(id) as any;
    return row ? rowToTag(row) : null;
  },

  create(data: { accountId: string; name: string; color?: string }): GroupTag {
    const id = uuid();
    const now = new Date().toISOString();
    const color = data.color || '#3b82f6';
    getDb().prepare(`
      INSERT INTO tags (id, account_id, name, color) VALUES (?, ?, ?, ?)
    `).run(id, data.accountId, data.name, color);
    return { id, accountId: data.accountId, name: data.name, color, groupCount: 0, createdAt: now, updatedAt: now };
  },

  /**
   * Returns the existing tag with this name for the account, or creates it.
   * Used by the importer so re-running it does not duplicate country tags.
   */
  findOrCreate(accountId: string, name: string, color?: string): GroupTag {
    const row = getDb().prepare('SELECT * FROM tags WHERE account_id = ? AND name = ?').get(accountId, name) as any;
    if (row) return rowToTag(row);
    return this.create({ accountId, name, color });
  },

  update(id: string, data: Partial<Pick<GroupTag, 'name' | 'color'>>): void {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.color !== undefined) { fields.push('color = ?'); values.push(data.color); }
    fields.push("updated_at = datetime('now')");
    getDb().prepare(`UPDATE tags SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
  },

  delete(id: string): void {
    // group_tags rows go with it via ON DELETE CASCADE
    getDb().prepare('DELETE FROM tags WHERE id = ?').run(id);
  },
};

// ─── Templates ───

export const templatesRepo = {
  getAll(accountId?: string): AdTemplate[] {
    const rows = accountId
      ? getDb().prepare('SELECT * FROM templates WHERE account_id = ? ORDER BY name').all(accountId) as any[]
      : getDb().prepare('SELECT * FROM templates ORDER BY name').all() as any[];
    return rows.map(rowToTemplate);
  },

  getActive(accountId?: string): AdTemplate[] {
    const rows = accountId
      ? getDb().prepare('SELECT * FROM templates WHERE is_active = 1 AND account_id = ? ORDER BY name').all(accountId) as any[]
      : getDb().prepare('SELECT * FROM templates WHERE is_active = 1 ORDER BY name').all() as any[];
    return rows.map(rowToTemplate);
  },

  getById(id: string): AdTemplate | null {
    const row = getDb().prepare('SELECT * FROM templates WHERE id = ?').get(id) as any;
    return row ? rowToTemplate(row) : null;
  },

  create(data: Omit<AdTemplate, 'id' | 'createdAt' | 'updatedAt'>): AdTemplate {
    const id = uuid();
    const now = new Date().toISOString();
    getDb().prepare(`
      INSERT INTO templates (id, account_id, name, body, variables, images, tags, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.accountId, data.name, data.body, JSON.stringify(data.variables), JSON.stringify(data.images ?? []), JSON.stringify(data.tags ?? []), data.isActive ? 1 : 0);
    return { ...data, id, createdAt: now, updatedAt: now };
  },

  update(id: string, data: Partial<AdTemplate>): void {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.body !== undefined) { fields.push('body = ?'); values.push(data.body); }
    if (data.variables !== undefined) { fields.push('variables = ?'); values.push(JSON.stringify(data.variables)); }
    if (data.images !== undefined) { fields.push('images = ?'); values.push(JSON.stringify(data.images)); }
    if (data.tags !== undefined) { fields.push('tags = ?'); values.push(JSON.stringify(data.tags)); }
    if (data.isActive !== undefined) { fields.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }
    fields.push("updated_at = datetime('now')");
    getDb().prepare(`UPDATE templates SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
  },

  delete(id: string): void {
    getDb().prepare('DELETE FROM templates WHERE id = ?').run(id);
  },
};

// ─── Publications ───

export const publicationsRepo = {
  getAll(limit = 50, accountId?: string): Publication[] {
    const rows = accountId
      ? getDb().prepare('SELECT * FROM publications WHERE account_id = ? ORDER BY created_at DESC LIMIT ?').all(accountId, limit) as any[]
      : getDb().prepare('SELECT * FROM publications ORDER BY created_at DESC LIMIT ?').all(limit) as any[];
    return rows.map(rowToPublication);
  },

  getByStatus(status: string, accountId?: string): Publication[] {
    const rows = accountId
      ? getDb().prepare('SELECT * FROM publications WHERE status = ? AND account_id = ? ORDER BY created_at DESC').all(status, accountId) as any[]
      : getDb().prepare('SELECT * FROM publications WHERE status = ? ORDER BY created_at DESC').all(status) as any[];
    return rows.map(rowToPublication);
  },

  getByGroup(groupId: string, limit = 20): Publication[] {
    const rows = getDb().prepare('SELECT * FROM publications WHERE group_id = ? ORDER BY created_at DESC LIMIT ?').all(groupId, limit) as any[];
    return rows.map(rowToPublication);
  },

  create(data: Omit<Publication, 'id' | 'createdAt'>): Publication {
    const id = uuid();
    const now = new Date().toISOString();
    getDb().prepare(`
      INSERT INTO publications (id, account_id, group_id, template_id, content, status, publish_method, scheduled_at, attempts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.accountId, data.groupId, data.templateId, data.content, data.status, data.publishMethod ?? null, data.scheduledAt ?? null, data.attempts);
    return { ...data, id, createdAt: now };
  },

  updateStatus(id: string, status: string, extra: Partial<Publication> = {}): void {
    const fields = ['status = ?'];
    const values: any[] = [status];
    if (extra.error !== undefined) { fields.push('error = ?'); values.push(extra.error); }
    if (extra.fbPostId !== undefined) { fields.push('fb_post_id = ?'); values.push(extra.fbPostId); }
    if (extra.publishedAt !== undefined) { fields.push('published_at = ?'); values.push(extra.publishedAt); }
    if (extra.publishMethod !== undefined) { fields.push('publish_method = ?'); values.push(extra.publishMethod); }
    if (extra.attempts !== undefined) { fields.push('attempts = ?'); values.push(extra.attempts); }
    getDb().prepare(`UPDATE publications SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
  },

  countTodayByGroup(groupId: string): number {
    const row = getDb().prepare(`
      SELECT COUNT(*) as count FROM publications
      WHERE group_id = ? AND status = 'success' AND date(published_at) = date('now')
    `).get(groupId) as any;
    return row?.count ?? 0;
  },

  countTodayTotal(accountId: string): number {
    const row = getDb().prepare(`
      SELECT COUNT(*) as count FROM publications
      WHERE account_id = ? AND status = 'success' AND date(published_at) = date('now')
    `).get(accountId) as any;
    return row?.count ?? 0;
  },

  getLastSuccessfulPublishedAt(accountId: string): string | null {
    const row = getDb().prepare(`
      SELECT published_at FROM publications
      WHERE account_id = ? AND status = 'success' AND published_at IS NOT NULL
      ORDER BY published_at DESC LIMIT 1
    `).get(accountId) as any;
    return row?.published_at ?? null;
  },

  /** Last successful publish across ALL accounts — used for the cross-account pacing gap. */
  getLastSuccessfulPublishedAtAny(): string | null {
    const row = getDb().prepare(`
      SELECT published_at FROM publications
      WHERE status = 'success' AND published_at IS NOT NULL
      ORDER BY published_at DESC LIMIT 1
    `).get() as any;
    return row?.published_at ?? null;
  },
};

// ─── Schedule Rules ───

export const scheduleRepo = {
  getAll(accountId?: string): ScheduleRule[] {
    const rows = accountId
      ? getDb().prepare('SELECT * FROM schedule_rules WHERE account_id = ? ORDER BY name').all(accountId) as any[]
      : getDb().prepare('SELECT * FROM schedule_rules ORDER BY name').all() as any[];
    return rows.map(rowToSchedule);
  },

  getActive(accountId?: string): ScheduleRule[] {
    const rows = accountId
      ? getDb().prepare('SELECT * FROM schedule_rules WHERE is_active = 1 AND account_id = ?').all(accountId) as any[]
      : getDb().prepare('SELECT * FROM schedule_rules WHERE is_active = 1').all() as any[];
    return rows.map(rowToSchedule);
  },

  getById(id: string): ScheduleRule | null {
    const row = getDb().prepare('SELECT * FROM schedule_rules WHERE id = ?').get(id) as any;
    return row ? rowToSchedule(row) : null;
  },

  create(data: Omit<ScheduleRule, 'id' | 'createdAt' | 'updatedAt' | 'tagIds'> & { tagIds?: string[] }): ScheduleRule {
    const id = uuid();
    const now = new Date().toISOString();
    getDb().prepare(`
      INSERT INTO schedule_rules (id, account_id, name, group_ids, tag_ids, template_ids, cron_expression, rotation_index, is_active, timezone, use_jitter)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.accountId, data.name, JSON.stringify(data.groupIds), JSON.stringify(data.tagIds ?? []), JSON.stringify(data.templateIds), data.cronExpression, data.rotationIndex, data.isActive ? 1 : 0, data.timezone, data.useJitter ? 1 : 0);
    return { ...data, tagIds: data.tagIds ?? [], id, createdAt: now, updatedAt: now };
  },

  updateRotationIndex(id: string, index: number): void {
    getDb().prepare("UPDATE schedule_rules SET rotation_index = ?, updated_at = datetime('now') WHERE id = ?").run(index, id);
  },

  update(id: string, data: Partial<ScheduleRule>): void {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.groupIds !== undefined) { fields.push('group_ids = ?'); values.push(JSON.stringify(data.groupIds)); }
    if (data.tagIds !== undefined) { fields.push('tag_ids = ?'); values.push(JSON.stringify(data.tagIds)); }
    if (data.templateIds !== undefined) { fields.push('template_ids = ?'); values.push(JSON.stringify(data.templateIds)); }
    if (data.cronExpression !== undefined) { fields.push('cron_expression = ?'); values.push(data.cronExpression); }
    if (data.isActive !== undefined) { fields.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }
    if (data.timezone !== undefined) { fields.push('timezone = ?'); values.push(data.timezone); }
    if (data.rotationIndex !== undefined) { fields.push('rotation_index = ?'); values.push(data.rotationIndex); }
    if (data.useJitter !== undefined) { fields.push('use_jitter = ?'); values.push(data.useJitter ? 1 : 0); }
    fields.push("updated_at = datetime('now')");
    getDb().prepare(`UPDATE schedule_rules SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
  },

  delete(id: string): void {
    getDb().prepare('DELETE FROM schedule_rules WHERE id = ?').run(id);
  },
};

// ─── Behavior settings (anti-detection knobs, dashboard-editable) ───

export const settingsRepo = {
  get(): BehaviorSettings {
    const row = getDb().prepare('SELECT * FROM app_settings WHERE id = ?').get('global') as any;
    return rowToBehaviorSettings(row);
  },

  update(data: Partial<BehaviorSettings>): BehaviorSettings {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.jitterMinMinutes !== undefined) { fields.push('jitter_min_minutes = ?'); values.push(data.jitterMinMinutes); }
    if (data.jitterMaxMinutes !== undefined) { fields.push('jitter_max_minutes = ?'); values.push(data.jitterMaxMinutes); }
    if (data.globalMinGapMinutes !== undefined) { fields.push('global_min_gap_minutes = ?'); values.push(data.globalMinGapMinutes); }
    if (data.maxPostsPerDayTotal !== undefined) { fields.push('max_posts_per_day_total = ?'); values.push(data.maxPostsPerDayTotal); }
    if (data.crossAccountMinGapMinutes !== undefined) { fields.push('cross_account_min_gap_minutes = ?'); values.push(data.crossAccountMinGapMinutes); }
    fields.push("updated_at = datetime('now')");
    getDb().prepare(`UPDATE app_settings SET ${fields.join(', ')} WHERE id = 'global'`).run(...values);
    return this.get();
  },
};

function rowToBehaviorSettings(row: any): BehaviorSettings {
  return {
    jitterMinMinutes: row.jitter_min_minutes,
    jitterMaxMinutes: row.jitter_max_minutes,
    globalMinGapMinutes: row.global_min_gap_minutes,
    maxPostsPerDayTotal: row.max_posts_per_day_total,
    crossAccountMinGapMinutes: row.cross_account_min_gap_minutes,
  };
}

// ─── Row mappers ───

function rowToAccount(row: any): FacebookAccount {
  return {
    id: row.id, name: row.name,
    proxy: row.proxy_server ? { server: row.proxy_server, username: row.proxy_username ?? undefined, password: row.proxy_password ?? undefined } : undefined,
    isActive: !!row.is_active,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function rowToGroup(row: any): FacebookGroup {
  return {
    id: row.id, accountId: row.account_id, name: row.name, fbGroupId: row.fb_group_id, url: row.url,
    category: row.category,
    isActive: !!row.is_active, maxPostsPerDay: row.max_posts_per_day,
    cooldownMinutes: row.cooldown_minutes, lastPublishedAt: row.last_published_at,
    membershipStatus: row.membership_status ?? 'unknown', membershipCheckedAt: row.membership_checked_at,
    tagIds: [],
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function rowToTag(row: any): GroupTag {
  return {
    id: row.id, accountId: row.account_id, name: row.name, color: row.color,
    groupCount: row.group_count ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

/**
 * Fills `tagIds` for a batch of groups with one query instead of one per group.
 * With ~400 groups in production the N+1 version would be 400 round trips on
 * every page load.
 */
function attachTags(groups: FacebookGroup[]): FacebookGroup[] {
  if (groups.length === 0) return groups;
  const placeholders = groups.map(() => '?').join(', ');
  const rows = getDb()
    .prepare(`SELECT group_id, tag_id FROM group_tags WHERE group_id IN (${placeholders})`)
    .all(...groups.map((g) => g.id)) as Array<{ group_id: string; tag_id: string }>;
  const byGroup = new Map<string, string[]>();
  for (const r of rows) {
    const list = byGroup.get(r.group_id);
    if (list) list.push(r.tag_id);
    else byGroup.set(r.group_id, [r.tag_id]);
  }
  for (const g of groups) g.tagIds = byGroup.get(g.id) ?? [];
  return groups;
}

function rowToTemplate(row: any): AdTemplate {
  return {
    id: row.id, accountId: row.account_id, name: row.name, body: row.body,
    variables: JSON.parse(row.variables), images: JSON.parse(row.images),
    tags: JSON.parse(row.tags), isActive: !!row.is_active,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function rowToPublication(row: any): Publication {
  return {
    id: row.id, accountId: row.account_id, groupId: row.group_id, templateId: row.template_id,
    content: row.content, status: row.status, publishMethod: row.publish_method,
    error: row.error, fbPostId: row.fb_post_id, scheduledAt: row.scheduled_at,
    publishedAt: row.published_at, attempts: row.attempts, createdAt: row.created_at,
  };
}

function rowToSchedule(row: any): ScheduleRule {
  return {
    id: row.id, accountId: row.account_id, name: row.name, groupIds: JSON.parse(row.group_ids),
    tagIds: JSON.parse(row.tag_ids ?? '[]'),
    templateIds: JSON.parse(row.template_ids), cronExpression: row.cron_expression,
    rotationIndex: row.rotation_index, isActive: !!row.is_active,
    timezone: row.timezone, useJitter: !!row.use_jitter,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
