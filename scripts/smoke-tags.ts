/**
 * Smoke test for the tag feature.
 *
 * Reads the database at `<cwd>/data/fb-publisher.db`, so run it from a copy:
 *
 *   cd /tmp/dbtest && npx tsx <repo>/scripts/smoke-tags.ts
 *
 * It writes (creates and deletes a tag), which is why it should never point at
 * the real database.
 */
import { getDb } from '../src/lib/db/database';
import { groupsRepo, tagsRepo, scheduleRepo } from '../src/lib/db/repositories';
import { resolveRuleTargets } from '../src/lib/scheduler/scheduler';

let failures = 0;

function check(label: string, cond: boolean, detail = '') {
  if (!cond) failures++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
}

const db = getDb();

// ─── Migration is additive ───
const names = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>)
  .map((t) => t.name);
check('tabla tags creada', names.includes('tags'));
check('tabla group_tags creada', names.includes('group_tags'));

const groups = groupsRepo.getAll('default');
check('grupos preservados tras migrar', groups.length > 0, `${groups.length} grupos`);
check('los grupos llegan con tagIds', groups.every((g) => Array.isArray(g.tagIds)));

// ─── Legacy rules keep their frozen target ───
const rules = scheduleRepo.getAll('default');
if (rules.length > 0) {
  const legacy = rules[0];
  check('regla previa conserva groupIds', legacy.groupIds.length > 0, `${legacy.groupIds.length} grupos`);
  check('regla previa tiene tagIds vacio', legacy.tagIds.length === 0);

  const targets = resolveRuleTargets(legacy);
  check(
    'regla previa NO se amplia a todos los grupos',
    targets.length <= legacy.groupIds.length && targets.length < groups.length,
    `resuelve a ${targets.length} de ${groups.length} totales`,
  );

  const asAll = { ...legacy, groupIds: [], tagIds: [] };
  check(
    'sin tags y sin groupIds = todos los activos',
    resolveRuleTargets(asAll).length === groupsRepo.getActive('default').length,
  );
}

// ─── Tag lifecycle ───
const tag = tagsRepo.findOrCreate('default', 'SMOKE-TEST-TAG', '#22c55e');
const sample = groups.slice(0, 3).map((g) => g.id);
groupsRepo.addTagToGroups(tag.id, sample);
groupsRepo.addTagToGroups(tag.id, sample); // repeated on purpose

const links = db.prepare('SELECT COUNT(*) c FROM group_tags WHERE tag_id = ?').get(tag.id) as { c: number };
check('asignacion masiva es idempotente', links.c === sample.length, `${links.c} enlaces para ${sample.length} grupos`);

check('findOrCreate no duplica', tagsRepo.findOrCreate('default', 'SMOKE-TEST-TAG').id === tag.id);

const counted = tagsRepo.getAll('default').find((t) => t.id === tag.id);
check('groupCount se resuelve en la lectura', counted?.groupCount === sample.length, `count=${counted?.groupCount}`);

const tagged = groupsRepo.getActiveByTags([tag.id], 'default');
check('getActiveByTags filtra por tag', tagged.every((g) => g.tagIds.includes(tag.id)), `${tagged.length} grupos`);

// ─── Delete cascades links only ───
tagsRepo.delete(tag.id);
const orphans = db.prepare('SELECT COUNT(*) c FROM group_tags WHERE tag_id = ?').get(tag.id) as { c: number };
check('borrar el tag limpia group_tags', orphans.c === 0);
check('borrar el tag no borra grupos', groupsRepo.getAll('default').length === groups.length);

console.log(failures === 0 ? '\nTodo OK' : `\n${failures} fallos`);
process.exit(failures === 0 ? 0 : 1);
