import cron from 'node-cron';
import { scheduleRepo, templatesRepo, groupsRepo, publicationsRepo } from '../db/repositories';
import { renderTemplate, selectTemplateAndGroup } from '../templates/engine';
import { PublisherManager } from '../publishers';
import type { ScheduleRule } from '../types';

type CronTask = ReturnType<typeof cron.schedule>;

const activeTasks = new Map<string, CronTask>();

/**
 * Starts all active schedule rules as cron jobs.
 */
export function startScheduler(publisher: PublisherManager) {
  const rules = scheduleRepo.getActive();

  for (const rule of rules) {
    startRule(rule, publisher);
  }

  console.log(`[Scheduler] Started ${rules.length} schedule rules`);
}

/**
 * Starts a single schedule rule.
 */
export function startRule(rule: ScheduleRule, publisher: PublisherManager) {
  if (activeTasks.has(rule.id)) {
    activeTasks.get(rule.id)!.stop();
  }

  const task = cron.schedule(
    rule.cronExpression,
    () => executeRule(rule.id, publisher),
    { timezone: rule.timezone }
  );

  activeTasks.set(rule.id, task);
  console.log(`[Scheduler] Rule "${rule.name}" scheduled: ${rule.cronExpression} (${rule.timezone})`);
}

/**
 * Stops a schedule rule.
 */
export function stopRule(ruleId: string) {
  const task = activeTasks.get(ruleId);
  if (task) {
    task.stop();
    activeTasks.delete(ruleId);
  }
}

/**
 * Stops all schedule rules.
 */
export function stopAll() {
  for (const [id, task] of activeTasks) {
    task.stop();
  }
  activeTasks.clear();
}

/**
 * Executes a schedule rule: selects template + group, renders content, publishes.
 */
async function executeRule(ruleId: string, publisher: PublisherManager) {
  // Re-fetch the rule to get current rotation index
  const rule = scheduleRepo.getById(ruleId);
  if (!rule || !rule.isActive) return;

  if (rule.templateIds.length === 0 || rule.groupIds.length === 0) {
    console.log(`[Scheduler] Rule "${rule.name}" skipped: no templates or groups configured`);
    return;
  }

  // Deterministic selection of template and group
  const { templateIndex, groupIndex } = selectTemplateAndGroup(
    rule.templateIds,
    rule.groupIds,
    rule.rotationIndex
  );

  const templateId = rule.templateIds[templateIndex];
  const groupId = rule.groupIds[groupIndex];

  const template = templatesRepo.getById(templateId);
  const group = groupsRepo.getById(groupId);

  if (!template || !group) {
    console.log(`[Scheduler] Rule "${rule.name}": template or group not found`);
    return;
  }

  // Check cooldown
  if (group.lastPublishedAt) {
    const lastPublished = new Date(group.lastPublishedAt).getTime();
    const cooldownMs = group.cooldownMinutes * 60 * 1000;
    if (Date.now() - lastPublished < cooldownMs) {
      console.log(`[Scheduler] Group "${group.name}" in cooldown, skipping`);
      return;
    }
  }

  // Check daily limit
  const todayCount = publicationsRepo.countTodayByGroup(group.id);
  if (todayCount >= group.maxPostsPerDay) {
    console.log(`[Scheduler] Group "${group.name}" reached daily limit (${todayCount}/${group.maxPostsPerDay})`);
    return;
  }

  // Render the template with deterministic rotation
  const rendered = renderTemplate(template, rule.rotationIndex);

  // Create publication record
  const publication = publicationsRepo.create({
    groupId: group.id,
    templateId: template.id,
    content: rendered.text,
    status: 'publishing',
    publishMethod: 'playwright',
    attempts: 1,
    scheduledAt: new Date().toISOString(),
  });

  console.log(`[Scheduler] Publishing to "${group.name}" using template "${template.name}" (rotation #${rule.rotationIndex})`);

  // Publish
  const result = await publisher.publish(
    group.fbGroupId,
    rendered.text,
    template.images,
  );

  // Update publication status
  publicationsRepo.updateStatus(publication.id, result.success ? 'success' : 'failed', {
    publishMethod: result.method,
    fbPostId: result.postId,
    publishedAt: result.timestamp,
    error: result.error,
  });

  // Update group's last published time
  if (result.success) {
    groupsRepo.update(group.id, { lastPublishedAt: result.timestamp });
  }

  // Advance rotation index (always advance, even on failure, to avoid retrying same content)
  scheduleRepo.updateRotationIndex(ruleId, rule.rotationIndex + 1);

  console.log(
    `[Scheduler] ${result.success ? '✓' : '✗'} ${group.name}: ${result.success ? result.postId : result.error}`
  );
}

/**
 * Manually trigger a rule execution (for testing / CLI).
 */
export async function triggerRule(ruleId: string, publisher: PublisherManager) {
  await executeRule(ruleId, publisher);
}
