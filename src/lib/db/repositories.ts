import { v4 as uuid } from 'uuid';
import { getDb } from './database';
import type { FacebookGroup, AdTemplate, Publication, ScheduleRule } from '../types';

// ─── Groups ───

export const groupsRepo = {
  getAll(): FacebookGroup[] {
    const rows = getDb().prepare('SELECT * FROM groups ORDER BY name').all() as any[];
    return rows.map(rowToGroup);
  },

  getActive(): FacebookGroup[] {
    const rows = getDb().prepare('SELECT * FROM groups WHERE is_active = 1 ORDER BY name').all() as any[];
    return rows.map(rowToGroup);
  },

  getById(id: string): FacebookGroup | null {
    const row = getDb().prepare('SELECT * FROM groups WHERE id = ?').get(id) as any;
    return row ? rowToGroup(row) : null;
  },

  create(data: Omit<FacebookGroup, 'id' | 'createdAt' | 'updatedAt'>): FacebookGroup {
    const id = uuid();
    const now = new Date().toISOString();
    getDb().prepare(`
      INSERT INTO groups (id, name, fb_group_id, url, category, is_active, max_posts_per_day, cooldown_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.name, data.fbGroupId, data.url, data.category ?? null, data.isActive ? 1 : 0, data.maxPostsPerDay, data.cooldownMinutes);
    return { ...data, id, createdAt: now, updatedAt: now };
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
    fields.push("updated_at = datetime('now')");
    getDb().prepare(`UPDATE groups SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
  },

  delete(id: string): void {
    getDb().prepare('DELETE FROM groups WHERE id = ?').run(id);
  },
};

// ─── Templates ───

export const templatesRepo = {
  getAll(): AdTemplate[] {
    const rows = getDb().prepare('SELECT * FROM templates ORDER BY name').all() as any[];
    return rows.map(rowToTemplate);
  },

  getActive(): AdTemplate[] {
    const rows = getDb().prepare('SELECT * FROM templates WHERE is_active = 1 ORDER BY name').all() as any[];
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
      INSERT INTO templates (id, name, body, variables, images, tags, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.name, data.body, JSON.stringify(data.variables), JSON.stringify(data.images ?? []), JSON.stringify(data.tags ?? []), data.isActive ? 1 : 0);
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
  getAll(limit = 50): Publication[] {
    const rows = getDb().prepare('SELECT * FROM publications ORDER BY created_at DESC LIMIT ?').all(limit) as any[];
    return rows.map(rowToPublication);
  },

  getByStatus(status: string): Publication[] {
    const rows = getDb().prepare('SELECT * FROM publications WHERE status = ? ORDER BY created_at DESC').all(status) as any[];
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
      INSERT INTO publications (id, group_id, template_id, content, status, publish_method, scheduled_at, attempts)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.groupId, data.templateId, data.content, data.status, data.publishMethod ?? null, data.scheduledAt ?? null, data.attempts);
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
};

// ─── Schedule Rules ───

export const scheduleRepo = {
  getAll(): ScheduleRule[] {
    const rows = getDb().prepare('SELECT * FROM schedule_rules ORDER BY name').all() as any[];
    return rows.map(rowToSchedule);
  },

  getActive(): ScheduleRule[] {
    const rows = getDb().prepare('SELECT * FROM schedule_rules WHERE is_active = 1').all() as any[];
    return rows.map(rowToSchedule);
  },

  getById(id: string): ScheduleRule | null {
    const row = getDb().prepare('SELECT * FROM schedule_rules WHERE id = ?').get(id) as any;
    return row ? rowToSchedule(row) : null;
  },

  create(data: Omit<ScheduleRule, 'id' | 'createdAt' | 'updatedAt'>): ScheduleRule {
    const id = uuid();
    const now = new Date().toISOString();
    getDb().prepare(`
      INSERT INTO schedule_rules (id, name, group_ids, template_ids, cron_expression, rotation_index, is_active, timezone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.name, JSON.stringify(data.groupIds), JSON.stringify(data.templateIds), data.cronExpression, data.rotationIndex, data.isActive ? 1 : 0, data.timezone);
    return { ...data, id, createdAt: now, updatedAt: now };
  },

  updateRotationIndex(id: string, index: number): void {
    getDb().prepare("UPDATE schedule_rules SET rotation_index = ?, updated_at = datetime('now') WHERE id = ?").run(index, id);
  },

  update(id: string, data: Partial<ScheduleRule>): void {
    const fields: string[] = [];
    const values: any[] = [];
    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.groupIds !== undefined) { fields.push('group_ids = ?'); values.push(JSON.stringify(data.groupIds)); }
    if (data.templateIds !== undefined) { fields.push('template_ids = ?'); values.push(JSON.stringify(data.templateIds)); }
    if (data.cronExpression !== undefined) { fields.push('cron_expression = ?'); values.push(data.cronExpression); }
    if (data.isActive !== undefined) { fields.push('is_active = ?'); values.push(data.isActive ? 1 : 0); }
    if (data.timezone !== undefined) { fields.push('timezone = ?'); values.push(data.timezone); }
    if (data.rotationIndex !== undefined) { fields.push('rotation_index = ?'); values.push(data.rotationIndex); }
    fields.push("updated_at = datetime('now')");
    getDb().prepare(`UPDATE schedule_rules SET ${fields.join(', ')} WHERE id = ?`).run(...values, id);
  },

  delete(id: string): void {
    getDb().prepare('DELETE FROM schedule_rules WHERE id = ?').run(id);
  },
};

// ─── Row mappers ───

function rowToGroup(row: any): FacebookGroup {
  return {
    id: row.id, name: row.name, fbGroupId: row.fb_group_id, url: row.url,
    category: row.category,
    isActive: !!row.is_active, maxPostsPerDay: row.max_posts_per_day,
    cooldownMinutes: row.cooldown_minutes, lastPublishedAt: row.last_published_at,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function rowToTemplate(row: any): AdTemplate {
  return {
    id: row.id, name: row.name, body: row.body,
    variables: JSON.parse(row.variables), images: JSON.parse(row.images),
    tags: JSON.parse(row.tags), isActive: !!row.is_active,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function rowToPublication(row: any): Publication {
  return {
    id: row.id, groupId: row.group_id, templateId: row.template_id,
    content: row.content, status: row.status, publishMethod: row.publish_method,
    error: row.error, fbPostId: row.fb_post_id, scheduledAt: row.scheduled_at,
    publishedAt: row.published_at, attempts: row.attempts, createdAt: row.created_at,
  };
}

function rowToSchedule(row: any): ScheduleRule {
  return {
    id: row.id, name: row.name, groupIds: JSON.parse(row.group_ids),
    templateIds: JSON.parse(row.template_ids), cronExpression: row.cron_expression,
    rotationIndex: row.rotation_index, isActive: !!row.is_active,
    timezone: row.timezone, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
