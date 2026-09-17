import cron from 'node-cron';
import { scheduleRepo, templatesRepo, groupsRepo, publicationsRepo, accountsRepo } from '../db/repositories';
import { renderTemplate, selectTemplateAndGroup } from '../templates/engine';
import { PublisherManager } from '../publishers';
import { getConfig, getAccountUserDataDir } from '../config';
import type { ScheduleRule } from '../types';

type CronTask = ReturnType<typeof cron.schedule>;

export type SchedulerEventLevel = 'info' | 'warn' | 'error' | 'success';

export type SchedulerEvent = {
  id: number;
  at: string;
  level: SchedulerEventLevel;
  message: string;
  ruleId?: string;
  ruleName?: string;
};

/** What a rule is doing right now, so the UI can show more than "running". */
export type RulePhase = 'idle' | 'waiting-jitter' | 'publishing';

type RuleState = {
  name: string;
  accountId: string;
  phase: RulePhase;
  /** For `waiting-jitter`: ISO time at which the jitter sleep ends. */
  waitingUntil?: string;
  detail?: string;
};

export type RuleStatus = {
  id: string;
  name: string;
  accountId: string;
  cronExpression: string;
  timezone: string;
  nextRun: string | null;
  phase: RulePhase;
  waitingUntil?: string;
  detail?: string;
};

export type SchedulerStatus = {
  running: boolean;
  startedAt: string | null;
  /** Whether publishing browsers launch hidden. `false` = you can watch them. */
  headless: boolean;
  scheduledRules: number;
  rules: RuleStatus[];
};

/**
 * Outcome of one rule execution. Returned (instead of logged and dropped)
 * so a manual "run now" from the dashboard can tell the user exactly why
 * nothing was published.
 */
export type ExecutionOutcome =
  | { outcome: 'published'; publicationId: string; groupName: string; postId?: string }
  | { outcome: 'failed'; publicationId?: string; groupName?: string; reason: string }
  | { outcome: 'skipped'; reason: string };

const activeTasks = new Map<string, CronTask>();
const ruleStates = new Map<string, RuleState>();

let running = false;
let startedAt: string | null = null;
let currentHeadless = true;

// ─── Event log ───────────────────────────────────────────────────────────
// The scheduler runs inside the Next server process with no UI channel of
// its own. Without this buffer every signal it produces (why a tick was
// skipped, how long a jitter sleep lasts, what a publish returned) is
// console-only and invisible from the dashboard.

const EVENT_LIMIT = 300;
const events: SchedulerEvent[] = [];
let eventSeq = 0;

function emit(
  level: SchedulerEventLevel,
  message: string,
  rule?: { id: string; name: string }
): SchedulerEvent {
  const event: SchedulerEvent = {
    id: ++eventSeq,
    at: new Date().toISOString(),
    level,
    message,
    ruleId: rule?.id,
    ruleName: rule?.name,
  };
  events.push(event);
  if (events.length > EVENT_LIMIT) events.splice(0, events.length - EVENT_LIMIT);
  const prefix = rule ? `[Scheduler] "${rule.name}": ` : '[Scheduler] ';
  console.log(prefix + message);
  return event;
}

/** Events newer than `sinceId`. The UI polls with the last id it has seen. */
export function getEvents(sinceId = 0): SchedulerEvent[] {
  return events.filter((e) => e.id > sinceId);
}

export function clearEvents() {
  events.length = 0;
}

export function isSchedulerRunning(): boolean {
  return running;
}

function nextRunOf(task: CronTask): string | null {
  try {
    return task.getNextRun()?.toISOString() ?? null;
  } catch {
    return null;
  }
}

export function getSchedulerStatus(): SchedulerStatus {
  const rules: RuleStatus[] = [];
  for (const [id, task] of activeTasks) {
    const state = ruleStates.get(id);
    const rule = scheduleRepo.getById(id);
    rules.push({
      id,
      name: state?.name ?? rule?.name ?? id,
      accountId: state?.accountId ?? rule?.accountId ?? '',
      cronExpression: rule?.cronExpression ?? '',
      timezone: rule?.timezone ?? '',
      nextRun: nextRunOf(task),
      phase: state?.phase ?? 'idle',
      waitingUntil: state?.waitingUntil,
      detail: state?.detail,
    });
  }
  rules.sort((a, b) => (a.nextRun ?? '').localeCompare(b.nextRun ?? ''));
  return {
    running,
    startedAt,
    headless: currentHeadless,
    scheduledRules: activeTasks.size,
    rules,
  };
}

function setRuleState(ruleId: string, patch: Partial<RuleState>) {
  const current = ruleStates.get(ruleId);
  if (!current) return;
  ruleStates.set(ruleId, { ...current, ...patch });
}

/**
 * One PublisherManager per account — each is bound to that account's own
 * browser session and proxy, so accounts never share a browser context.
 */
function buildPublishersByAccount(headless: boolean): Map<string, PublisherManager> {
  const publishers = new Map<string, PublisherManager>();
  for (const account of accountsRepo.getActive()) {
    publishers.set(account.id, new PublisherManager({
      playwrightUserDataDir: getAccountUserDataDir(account.id),
      playwrightHeadless: headless,
      proxy: account.proxy,
    }));
  }
  return publishers;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Random delay in ms between minMinutes and maxMinutes (inclusive).
 * Used to avoid publishing at the exact same clock time every day, which
 * is an easy pattern for anti-abuse systems to flag.
 */
function randomJitterMs(minMinutes: number, maxMinutes: number): number {
  if (maxMinutes <= minMinutes) return minMinutes * 60 * 1000;
  const minutes = minMinutes + Math.random() * (maxMinutes - minMinutes);
  return Math.round(minutes * 60 * 1000);
}

/**
 * Starts all active schedule rules as cron jobs, one PublisherManager per
 * account so each rule publishes through its own account's session/proxy.
 *
 * `headless` defaults to PLAYWRIGHT_HEADLESS (via getConfig) rather than a
 * hardcoded `true`, so "show me the browser" works from the dashboard and
 * the CLI alike.
 */
export function startScheduler(opts: { headless?: boolean } = {}) {
  const headless = opts.headless ?? getConfig().playwright.headless;
  currentHeadless = headless;

  const publishers = buildPublishersByAccount(headless);
  const rules = scheduleRepo.getActive();

  emit('info', `Arrancando scheduler — navegador ${headless ? 'oculto (headless)' : 'VISIBLE'}`);

  if (rules.length === 0) {
    emit('warn', 'No hay ninguna regla activa: el scheduler queda encendido pero no publicará nada.');
  }

  for (const rule of rules) {
    const publisher = publishers.get(rule.accountId);
    if (!publisher) {
      emit('warn', `Omitida: la cuenta ${rule.accountId} no está activa`, rule);
      continue;
    }
    startRule(rule, publisher);
  }

  running = true;
  startedAt = new Date().toISOString();
  emit(
    'info',
    `Scheduler activo: ${activeTasks.size} regla(s) programada(s) sobre ${publishers.size} cuenta(s)`
  );
  return getSchedulerStatus();
}

/**
 * Starts a single schedule rule.
 */
export function startRule(rule: ScheduleRule, publisher: PublisherManager) {
  if (activeTasks.has(rule.id)) {
    activeTasks.get(rule.id)!.stop();
  }

  if (!cron.validate(rule.cronExpression)) {
    emit('error', `Expresión cron inválida: "${rule.cronExpression}" — regla no programada`, rule);
    return;
  }

  let task: CronTask;
  try {
    task = cron.schedule(
      rule.cronExpression,
      () => executeRule(rule.id, publisher, { applyJitter: true }),
      { timezone: rule.timezone, name: rule.id }
    );
  } catch (error) {
    emit('error', `No se pudo programar (${error instanceof Error ? error.message : String(error)})`, rule);
    return;
  }

  activeTasks.set(rule.id, task);
  ruleStates.set(rule.id, { name: rule.name, accountId: rule.accountId, phase: 'idle' });

  const next = nextRunOf(task);
  emit(
    'info',
    `Programada: ${rule.cronExpression} (${rule.timezone})` +
      (next ? ` — próxima ejecución ${next}` : ''),
    rule
  );
}

/**
 * Stops a schedule rule.
 */
export function stopRule(ruleId: string) {
  const task = activeTasks.get(ruleId);
  if (task) {
    task.stop();
    activeTasks.delete(ruleId);
    const state = ruleStates.get(ruleId);
    ruleStates.delete(ruleId);
    emit('info', 'Regla detenida', state ? { id: ruleId, name: state.name } : undefined);
  }
}

/**
 * Stops all schedule rules.
 */
export function stopAll() {
  const count = activeTasks.size;
  for (const [, task] of activeTasks) {
    task.stop();
  }
  activeTasks.clear();
  ruleStates.clear();
  running = false;
  startedAt = null;
  emit('info', `Scheduler detenido (${count} regla(s) desprogramada(s))`);
  return getSchedulerStatus();
}

/**
 * Executes a schedule rule: selects template + group, renders content, publishes.
 *
 * Applies human-like pacing to avoid looking like scripted spam:
 *   - random jitter after the cron tick fires, so posts don't land at the
 *     exact same clock time every day
 *   - a minimum global gap between ANY two posts (across all groups), so
 *     the account never fires several posts back-to-back
 *   - an account-wide daily cap, independent of each group's own limit
 *
 * Every early return reports a reason instead of returning silently — a
 * skipped tick is the single most confusing thing this scheduler can do.
 */
async function executeRule(
  ruleId: string,
  publisher: PublisherManager,
  opts: { applyJitter?: boolean; ignoreGaps?: boolean } = {}
): Promise<ExecutionOutcome> {
  // Re-fetch the rule to get current rotation index
  const rule = scheduleRepo.getById(ruleId);
  if (!rule || !rule.isActive) {
    const reason = 'La regla ya no existe o está desactivada';
    emit('warn', reason, rule ?? undefined);
    return { outcome: 'skipped', reason };
  }

  const tag = { id: rule.id, name: rule.name };

  if (rule.templateIds.length === 0 || rule.groupIds.length === 0) {
    const reason = 'Sin plantillas o sin grupos configurados';
    emit('warn', reason, tag);
    return { outcome: 'skipped', reason };
  }

  const { behavior } = getConfig();

  if (opts.applyJitter && rule.useJitter && (behavior.jitterMaxMinutes > 0 || behavior.jitterMinMinutes > 0)) {
    const jitterMs = randomJitterMs(behavior.jitterMinMinutes, behavior.jitterMaxMinutes);
    const until = new Date(Date.now() + jitterMs).toISOString();
    setRuleState(ruleId, { phase: 'waiting-jitter', waitingUntil: until, detail: undefined });
    emit(
      'info',
      `Disparo recibido — esperando ${Math.round(jitterMs / 60000)} min de jitter (publica a las ${until})`,
      tag
    );
    await sleep(jitterMs);
    setRuleState(ruleId, { phase: 'idle', waitingUntil: undefined });
  }

  // Per-account daily cap, independent of per-group limits
  const totalToday = publicationsRepo.countTodayTotal(rule.accountId);
  if (totalToday >= behavior.maxPostsPerDayTotal) {
    const reason = `Límite diario de la cuenta alcanzado (${totalToday}/${behavior.maxPostsPerDayTotal})`;
    setRuleState(ruleId, { phase: 'idle', detail: reason });
    emit('warn', reason, tag);
    return { outcome: 'skipped', reason };
  }

  if (!opts.ignoreGaps) {
    // Minimum spacing between ANY two posts of THIS account — prevents
    // bursts that read as scripted activity even if per-group cooldowns pass
    const lastForAccount = publicationsRepo.getLastSuccessfulPublishedAt(rule.accountId);
    if (lastForAccount) {
      const elapsedMs = Date.now() - new Date(lastForAccount).getTime();
      const minGapMs = behavior.globalMinGapMinutes * 60 * 1000;
      if (elapsedMs < minGapMs) {
        const reason = `Espaciado mínimo de la cuenta no cumplido (${Math.round(elapsedMs / 60000)}/${behavior.globalMinGapMinutes} min)`;
        setRuleState(ruleId, { phase: 'idle', detail: reason });
        emit('warn', reason, tag);
        return { outcome: 'skipped', reason };
      }
    }

    // Minimum spacing between posts of DIFFERENT accounts — a synchronized
    // burst across accounts run from the same machine is itself a pattern,
    // even with each account on its own proxy
    const lastAnyAccount = publicationsRepo.getLastSuccessfulPublishedAtAny();
    if (lastAnyAccount) {
      const elapsedMs = Date.now() - new Date(lastAnyAccount).getTime();
      const crossGapMs = behavior.crossAccountMinGapMinutes * 60 * 1000;
      if (elapsedMs < crossGapMs) {
        const reason = `Espaciado entre cuentas no cumplido (${Math.round(elapsedMs / 60000)}/${behavior.crossAccountMinGapMinutes} min)`;
        setRuleState(ruleId, { phase: 'idle', detail: reason });
        emit('warn', reason, tag);
        return { outcome: 'skipped', reason };
      }
    }
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
    const reason = !template
      ? `La plantilla ${templateId} ya no existe`
      : `El grupo ${groupId} ya no existe`;
    emit('error', reason, tag);
    return { outcome: 'skipped', reason };
  }

  // Check cooldown
  if (group.lastPublishedAt) {
    const lastPublished = new Date(group.lastPublishedAt).getTime();
    const cooldownMs = group.cooldownMinutes * 60 * 1000;
    if (Date.now() - lastPublished < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - (Date.now() - lastPublished)) / 60000);
      const reason = `Grupo "${group.name}" en cooldown (faltan ${remaining} min)`;
      setRuleState(ruleId, { phase: 'idle', detail: reason });
      emit('warn', reason, tag);
      return { outcome: 'skipped', reason };
    }
  }

  // Check daily limit
  const todayCount = publicationsRepo.countTodayByGroup(group.id);
  if (todayCount >= group.maxPostsPerDay) {
    const reason = `Grupo "${group.name}" alcanzó su límite diario (${todayCount}/${group.maxPostsPerDay})`;
    setRuleState(ruleId, { phase: 'idle', detail: reason });
    emit('warn', reason, tag);
    return { outcome: 'skipped', reason };
  }

  // Render the template with deterministic rotation
  const rendered = renderTemplate(template, rule.rotationIndex);

  // Create publication record
  const publication = publicationsRepo.create({
    accountId: rule.accountId,
    groupId: group.id,
    templateId: template.id,
    content: rendered.text,
    status: 'publishing',
    publishMethod: 'playwright',
    attempts: 1,
    scheduledAt: new Date().toISOString(),
  });

  setRuleState(ruleId, { phase: 'publishing', detail: `Publicando en "${group.name}"`, waitingUntil: undefined });
  emit(
    'info',
    `Abriendo navegador (${currentHeadless ? 'headless' : 'visible'}) para publicar en "${group.name}" con la plantilla "${template.name}" (rotación #${rule.rotationIndex})`,
    tag
  );

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

  setRuleState(ruleId, { phase: 'idle', detail: undefined });

  if (result.success) {
    emit('success', `Publicado en "${group.name}"${result.postId ? ` (post ${result.postId})` : ''}`, tag);
    return { outcome: 'published', publicationId: publication.id, groupName: group.name, postId: result.postId };
  }

  emit('error', `Falló la publicación en "${group.name}": ${result.error}`, tag);
  return {
    outcome: 'failed',
    publicationId: publication.id,
    groupName: group.name,
    reason: result.error ?? 'Error desconocido',
  };
}

/**
 * Manually trigger a rule execution (for testing / CLI). No jitter delay,
 * so a manual test publishes immediately.
 *
 * `force` bypasses the min-gap checks — useful when you just want to watch
 * the browser drive a post. The per-group cooldown and both daily caps are
 * NOT bypassed: those protect the account, not the pacing pattern.
 */
export async function triggerRule(
  ruleId: string,
  publisher: PublisherManager,
  opts: { force?: boolean } = {}
): Promise<ExecutionOutcome> {
  return executeRule(ruleId, publisher, { applyJitter: false, ignoreGaps: opts.force });
}

/**
 * Runs one rule on demand, building a publisher for that rule's own account.
 * Defaults to a VISIBLE browser: the point of a manual run is to watch it.
 */
export async function triggerRuleNow(
  ruleId: string,
  opts: { headless?: boolean; force?: boolean } = {}
): Promise<ExecutionOutcome> {
  const rule = scheduleRepo.getById(ruleId);
  if (!rule) {
    return { outcome: 'skipped', reason: `No existe la regla ${ruleId}` };
  }

  const account = accountsRepo.getById(rule.accountId);
  if (!account) {
    const reason = `La cuenta ${rule.accountId} de la regla no existe`;
    emit('error', reason, rule);
    return { outcome: 'skipped', reason };
  }
  if (!account.isActive) {
    const reason = `La cuenta "${account.name}" está desactivada`;
    emit('warn', reason, rule);
    return { outcome: 'skipped', reason };
  }

  const headless = opts.headless ?? false;
  const publisher = new PublisherManager({
    playwrightUserDataDir: getAccountUserDataDir(account.id),
    playwrightHeadless: headless,
    proxy: account.proxy,
  });

  emit(
    'info',
    `Ejecución manual solicitada — navegador ${headless ? 'oculto' : 'VISIBLE'}${opts.force ? ', ignorando espaciados' : ''}`,
    rule
  );

  return triggerRule(ruleId, publisher, { force: opts.force });
}
