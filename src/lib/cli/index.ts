#!/usr/bin/env node

import { groupsRepo, templatesRepo, publicationsRepo, scheduleRepo, accountsRepo } from '../db/repositories';
import { renderTemplate, getTotalCombinations } from '../templates/engine';
import { PublisherManager } from '../publishers';
import { getConfig, getAccountUserDataDir, DEFAULT_ACCOUNT_ID } from '../config';
import { startScheduler, triggerRule, stopAll } from '../scheduler/scheduler';
import type { ProxyConfig } from '../types';

const args = process.argv.slice(2);
const command = args[0];

/** Reads `--account <id>` from CLI args, defaulting to the single-account flow. */
function getAccountIdFlag(args: string[]): string {
  const flagIndex = args.indexOf('--account');
  return flagIndex !== -1 ? args[flagIndex + 1] : DEFAULT_ACCOUNT_ID;
}

/** Strips known flags (and their values) from positional args. */
function stripFlags(args: string[], flagsWithValue: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (flagsWithValue.includes(args[i])) { i++; continue; }
    result.push(args[i]);
  }
  return result;
}

function parseProxyUrl(input: string): ProxyConfig {
  const url = new URL(input);
  const server = `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
  return {
    server,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
  };
}

function requireAccount(accountId: string) {
  const account = accountsRepo.getById(accountId);
  if (!account) {
    console.log(`Cuenta no encontrada: ${accountId}. Usa "accounts list" para ver las cuentas disponibles.`);
    process.exit(1);
  }
  return account!;
}

function createPublisher(accountId: string, headlessOverride?: boolean) {
  const config = getConfig();
  const account = requireAccount(accountId);
  return new PublisherManager({
    playwrightUserDataDir: getAccountUserDataDir(accountId),
    playwrightHeadless: headlessOverride ?? config.playwright.headless,
    proxy: account.proxy,
  });
}

async function main() {
  switch (command) {
    case 'accounts':
      return handleAccounts(args.slice(1));
    case 'groups':
      return handleGroups(args.slice(1));
    case 'templates':
      return handleTemplates(args.slice(1));
    case 'publish':
      return handlePublish(args.slice(1));
    case 'schedule':
      return handleSchedule(args.slice(1));
    case 'status':
      return handleStatus();
    case 'preview':
      return handlePreview(args.slice(1));
    case 'login':
      return handleLogin(args.slice(1));
    default:
      printHelp();
  }
}

function printHelp() {
  console.log(`
  FB Publisher CLI - Publicador de anuncios en grupos de Facebook
  Usa m.facebook.com con Playwright para máxima estabilidad.

  Comandos:
    accounts list                       Listar cuentas de Facebook configuradas
    accounts add <name> [--proxy <url>] Agregar una cuenta (proxy opcional: http://user:pass@host:port)
    accounts remove <id>                Eliminar una cuenta

    login                               Abrir navegador para iniciar sesión en Facebook

    groups list                         Listar todos los grupos
    groups add <name> <url>             Agregar un grupo
    groups remove <id>                  Eliminar un grupo

    templates list                      Listar todas las plantillas
    templates add <name> <body>         Agregar una plantilla
    templates remove <id>               Eliminar una plantilla

    preview <templateId> [index]        Vista previa de una plantilla con rotación

    publish <groupId> <templateId>      Publicar manualmente en un grupo
    publish --all                       Publicar en todos los grupos activos

    schedule list                       Listar reglas de programación
    schedule start                      Iniciar el scheduler (todas las cuentas activas)
    schedule trigger <ruleId>           Ejecutar una regla manualmente
    schedule stop                       Detener el scheduler

    status                              Ver estado general

  Opciones:
    --account <id>                      Cuenta a usar (default: una sola cuenta "default")
    --rotation <number>                 Índice de rotación
    --no-headless                       Mostrar navegador
    --force                             (schedule trigger) Ignorar espaciados mínimos
  `);
}

function handleAccounts(args: string[]) {
  const subcommand = args[0];

  switch (subcommand) {
    case 'list': {
      const accounts = accountsRepo.getAll();
      if (accounts.length === 0) {
        console.log('No hay cuentas configuradas.');
        return;
      }
      console.log('\nCuentas de Facebook:\n');
      for (const a of accounts) {
        const status = a.isActive ? '●' : '○';
        console.log(`  ${status} ${a.name}`);
        console.log(`    ID: ${a.id}`);
        console.log(`    Proxy: ${a.proxy ? a.proxy.server : '(sin proxy)'}`);
        console.log('');
      }
      break;
    }
    case 'add': {
      const proxyFlagIndex = args.indexOf('--proxy');
      const proxyUrl = proxyFlagIndex !== -1 ? args[proxyFlagIndex + 1] : undefined;
      const name = stripFlags(args.slice(1), ['--proxy'])[0];
      if (!name) {
        console.log('Uso: accounts add <name> [--proxy http://user:pass@host:port]');
        return;
      }
      const account = accountsRepo.create({
        name,
        proxy: proxyUrl ? parseProxyUrl(proxyUrl) : undefined,
        isActive: true,
      });
      console.log(`Cuenta creada: ${account.name} (${account.id})`);
      break;
    }
    case 'remove': {
      const id = args[1];
      if (!id) { console.log('Uso: accounts remove <id>'); return; }
      accountsRepo.delete(id);
      console.log(`Cuenta eliminada: ${id}`);
      break;
    }
    default:
      console.log('Subcomandos: list, add, remove');
  }
}

/**
 * Opens a visible browser to m.facebook.com for manual login.
 * The session is saved in data/browser-session/ for future use.
 */
async function handleLogin(args: string[]) {
  const accountId = getAccountIdFlag(args);
  const account = requireAccount(accountId);

  console.log(`Abriendo navegador para iniciar sesión en Facebook (cuenta: ${account.name})...`);
  if (account.proxy) console.log(`Usando proxy: ${account.proxy.server}`);
  console.log('Inicia sesión manualmente. La sesión se guardará automáticamente.');
  console.log('Cierra el navegador cuando termines.\n');

  const { chromium } = await import('playwright');

  const context = await chromium.launchPersistentContext(getAccountUserDataDir(accountId), {
    headless: false,
    viewport: { width: 480, height: 800 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    proxy: account.proxy,
  });

  const page = context.pages()[0] || (await context.newPage());
  await page.goto('https://m.facebook.com');

  console.log('Navegador abierto en m.facebook.com');
  console.log('Esperando a que cierres el navegador...');

  // Wait until the browser is closed by the user
  await new Promise<void>((resolve) => {
    (context as any).on('close', resolve);
  });

  console.log('Sesión guardada. Ya puedes publicar con: npm run cli -- publish');
}

function handleGroups(args: string[]) {
  const subcommand = args[0];
  const accountId = getAccountIdFlag(args);
  const rest = stripFlags(args.slice(1), ['--account']);

  switch (subcommand) {
    case 'list': {
      const groups = groupsRepo.getAll(accountId);
      if (groups.length === 0) {
        console.log('No hay grupos configurados.');
        return;
      }
      console.log('\nGrupos de Facebook:\n');
      for (const g of groups) {
        const status = g.isActive ? '●' : '○';
        console.log(`  ${status} ${g.name}`);
        console.log(`    ID: ${g.id}`);
        console.log(`    FB Group: ${g.fbGroupId}`);
        console.log(`    Máx: ${g.maxPostsPerDay}/día | Cooldown: ${g.cooldownMinutes}min`);
        if (g.lastPublishedAt) console.log(`    Última publicación: ${g.lastPublishedAt}`);
        console.log('');
      }
      break;
    }
    case 'add': {
      const name = rest[0];
      const url = rest[1];
      if (!name || !url) {
        console.log('Uso: groups add <name> <url> [--account <id>]');
        return;
      }
      requireAccount(accountId);
      const match = url.match(/groups\/(\d+)/);
      const fbGroupId = match ? match[1] : url;
      const group = groupsRepo.create({
        accountId,
        name,
        fbGroupId,
        url,
        isActive: true,
        maxPostsPerDay: 3,
        cooldownMinutes: 60,
      });
      console.log(`Grupo creado: ${group.name} (${group.id})`);
      break;
    }
    case 'remove': {
      const id = rest[0];
      if (!id) { console.log('Uso: groups remove <id>'); return; }
      groupsRepo.delete(id);
      console.log(`Grupo eliminado: ${id}`);
      break;
    }
    default:
      console.log('Subcomandos: list, add, remove');
  }
}

function handleTemplates(args: string[]) {
  const subcommand = args[0];
  const accountId = getAccountIdFlag(args);
  const rest = stripFlags(args.slice(1), ['--account']);

  switch (subcommand) {
    case 'list': {
      const templates = templatesRepo.getAll(accountId);
      if (templates.length === 0) {
        console.log('No hay plantillas configuradas.');
        return;
      }
      console.log('\nPlantillas:\n');
      for (const t of templates) {
        console.log(`  ${t.name}`);
        console.log(`    ID: ${t.id}`);
        console.log(`    Variables: ${t.variables.length} | Combinaciones: ${getTotalCombinations(t.variables)}`);
        console.log(`    Body: ${t.body.substring(0, 80)}...`);
        console.log('');
      }
      break;
    }
    case 'add': {
      const name = rest[0];
      const body = rest.slice(1).join(' ');
      if (!name || !body) {
        console.log('Uso: templates add <name> "<body>" [--account <id>]');
        return;
      }
      requireAccount(accountId);
      const template = templatesRepo.create({
        accountId,
        name,
        body,
        variables: [],
        isActive: true,
      });
      console.log(`Plantilla creada: ${template.name} (${template.id})`);
      break;
    }
    case 'remove': {
      const id = rest[0];
      if (!id) { console.log('Uso: templates remove <id>'); return; }
      templatesRepo.delete(id);
      console.log(`Plantilla eliminada: ${id}`);
      break;
    }
    default:
      console.log('Subcomandos: list, add, remove');
  }
}

function handlePreview(args: string[]) {
  const templateId = args[0];
  const rotationIndex = parseInt(args[1] || '0', 10);

  if (!templateId) {
    console.log('Uso: preview <templateId> [rotationIndex]');
    return;
  }

  const template = templatesRepo.getById(templateId);
  if (!template) {
    console.log('Plantilla no encontrada.');
    return;
  }

  const total = getTotalCombinations(template.variables);
  console.log(`\nPlantilla: ${template.name}`);
  console.log(`Combinaciones totales: ${total}`);
  console.log(`Rotación #${rotationIndex} (ciclo ${Math.floor(rotationIndex / total)}, posición ${rotationIndex % total}):\n`);

  const rendered = renderTemplate(template, rotationIndex);
  console.log('─'.repeat(50));
  console.log(rendered.text);
  console.log('─'.repeat(50));

  if (Object.keys(rendered.variableValues).length > 0) {
    console.log('\nVariables utilizadas:');
    for (const [name, value] of Object.entries(rendered.variableValues)) {
      console.log(`  ${name}: ${value}`);
    }
  }
}

async function handlePublish(args: string[]) {
  const noHeadless = args.includes('--no-headless');
  const accountId = getAccountIdFlag(args);
  const publisher = createPublisher(accountId, noHeadless ? false : undefined);

  const rotationFlag = args.indexOf('--rotation');
  const rotation = rotationFlag !== -1 ? parseInt(args[rotationFlag + 1], 10) : 0;
  const rest = stripFlags(args, ['--account', '--rotation']);

  if (rest[0] === '--all') {
    const groups = groupsRepo.getActive(accountId);
    const templates = templatesRepo.getActive(accountId);
    if (groups.length === 0 || templates.length === 0) {
      console.log('No hay grupos activos o plantillas activas para esta cuenta.');
      return;
    }

    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const template = templates[i % templates.length];
      const rendered = renderTemplate(template, rotation + i);

      console.log(`Publicando en ${group.name}...`);
      const result = await publisher.publish(group.fbGroupId, rendered.text, template.images);
      console.log(`  ${result.success ? '✓' : '✗'} ${result.success ? 'Éxito' : result.error}`);
    }
    return;
  }

  const groupId = rest[0];
  const templateId = rest[1];

  if (!groupId || !templateId) {
    console.log('Uso: publish <groupId> <templateId> [--rotation N] [--account <id>]');
    return;
  }

  const group = groupsRepo.getById(groupId);
  const template = templatesRepo.getById(templateId);
  if (!group) { console.log('Grupo no encontrado.'); return; }
  if (!template) { console.log('Plantilla no encontrada.'); return; }

  const rendered = renderTemplate(template, rotation);
  console.log(`\nPublicando en "${group.name}" via m.facebook.com...`);
  console.log(`Contenido:\n${rendered.text}\n`);

  const result = await publisher.publish(group.fbGroupId, rendered.text, template.images);

  publicationsRepo.create({
    accountId,
    groupId: group.id,
    templateId: template.id,
    content: rendered.text,
    status: result.success ? 'success' : 'failed',
    publishMethod: result.method,
    fbPostId: result.postId,
    publishedAt: result.timestamp,
    error: result.error,
    attempts: 1,
  });

  console.log(`${result.success ? '✓' : '✗'} ${result.success ? `Publicado` : result.error}`);
}

async function handleSchedule(args: string[]) {
  const subcommand = args[0];

  switch (subcommand) {
    case 'list': {
      const accountId = getAccountIdFlag(args);
      const rules = args.includes('--account') ? scheduleRepo.getAll(accountId) : scheduleRepo.getAll();
      if (rules.length === 0) {
        console.log('No hay reglas de programación.');
        return;
      }
      console.log('\nReglas de programación:\n');
      for (const r of rules) {
        const status = r.isActive ? '●' : '○';
        console.log(`  ${status} ${r.name}`);
        console.log(`    ID: ${r.id}`);
        console.log(`    Cuenta: ${r.accountId}`);
        console.log(`    Cron: ${r.cronExpression} (${r.timezone})`);
        console.log(`    Grupos: ${r.groupIds.length} | Plantillas: ${r.templateIds.length} | Rotación: #${r.rotationIndex}`);
        console.log('');
      }
      break;
    }
    case 'start': {
      const noHeadless = args.includes('--no-headless');
      console.log('Iniciando scheduler (todas las cuentas activas)...');
      startScheduler(noHeadless ? { headless: false } : {});
      console.log('Scheduler activo. Presiona Ctrl+C para detener.');
      await new Promise(() => {});
      break;
    }
    case 'trigger': {
      const rest = stripFlags(args.slice(1), ['--account']);
      const ruleId = rest[0];
      if (!ruleId) { console.log('Uso: schedule trigger <ruleId> [--no-headless] [--force]'); return; }
      const rule = scheduleRepo.getById(ruleId);
      if (!rule) { console.log('Regla no encontrada.'); return; }
      const showBrowser = args.includes('--no-headless');
      console.log('Ejecutando regla...');
      const publisher = createPublisher(rule.accountId, showBrowser ? false : undefined);
      const result = await triggerRule(ruleId, publisher, { force: args.includes('--force') });
      if (result.outcome === 'published') {
        console.log(`✓ Publicado en "${result.groupName}"`);
      } else if (result.outcome === 'failed') {
        console.log(`✗ Falló en "${result.groupName}": ${result.reason}`);
      } else {
        console.log(`– Omitido: ${result.reason}`);
      }
      break;
    }
    case 'stop': {
      stopAll();
      console.log('Scheduler detenido.');
      break;
    }
    default:
      console.log('Subcomandos: list, start, trigger, stop');
  }
}

function handleStatus() {
  const accounts = accountsRepo.getAll();
  const groups = groupsRepo.getAll();
  const templates = templatesRepo.getAll();
  const publications = publicationsRepo.getAll(100);
  const schedules = scheduleRepo.getAll();

  const successful = publications.filter((p) => p.status === 'success').length;
  const failed = publications.filter((p) => p.status === 'failed').length;

  console.log(`
  FB Publisher - Estado (Playwright + m.facebook.com)
  ─────────────────────────────────
  Cuentas:        ${accounts.length} (${accounts.filter((a) => a.isActive).length} activas)
  Grupos:         ${groups.length} (${groups.filter((g) => g.isActive).length} activos)
  Plantillas:     ${templates.length} (${templates.filter((t) => t.isActive).length} activas)
  Programaciones: ${schedules.length} (${schedules.filter((s) => s.isActive).length} activas)
  ─────────────────────────────────
  Publicaciones:  ${publications.length} total
    Exitosas:     ${successful}
    Fallidas:     ${failed}
    Tasa éxito:   ${publications.length > 0 ? Math.round((successful / publications.length) * 100) : 0}%
  ─────────────────────────────────
  `);
}

main().catch(console.error);
