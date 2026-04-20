#!/usr/bin/env node

import { groupsRepo, templatesRepo, publicationsRepo, scheduleRepo } from '../db/repositories';
import { renderTemplate, getTotalCombinations } from '../templates/engine';
import { PublisherManager } from '../publishers';
import { getConfig } from '../config';
import { startScheduler, triggerRule, stopAll } from '../scheduler/scheduler';

const args = process.argv.slice(2);
const command = args[0];

function createPublisher() {
  const config = getConfig();
  return new PublisherManager({
    playwrightUserDataDir: config.playwright.userDataDir,
    playwrightHeadless: config.playwright.headless,
  });
}

async function main() {
  switch (command) {
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
      return handleLogin();
    default:
      printHelp();
  }
}

function printHelp() {
  console.log(`
  FB Publisher CLI - Publicador de anuncios en grupos de Facebook
  Usa mbasic.facebook.com con Playwright para máxima estabilidad.

  Comandos:
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
    schedule start                      Iniciar el scheduler
    schedule trigger <ruleId>           Ejecutar una regla manualmente
    schedule stop                       Detener el scheduler

    status                              Ver estado general

  Opciones:
    --rotation <number>                 Índice de rotación
    --no-headless                       Mostrar navegador
  `);
}

/**
 * Opens a visible browser to mbasic.facebook.com for manual login.
 * The session is saved in data/browser-session/ for future use.
 */
async function handleLogin() {
  console.log('Abriendo navegador para iniciar sesión en Facebook...');
  console.log('Inicia sesión manualmente. La sesión se guardará automáticamente.');
  console.log('Cierra el navegador cuando termines.\n');

  const config = getConfig();
  const { chromium } = await import('playwright');

  const context = await chromium.launchPersistentContext(config.playwright.userDataDir, {
    headless: false,
    viewport: { width: 480, height: 800 },
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  });

  const page = context.pages()[0] || (await context.newPage());
  await page.goto('https://mbasic.facebook.com');

  console.log('Navegador abierto en mbasic.facebook.com');
  console.log('Esperando a que cierres el navegador...');

  // Wait until the browser is closed by the user
  await new Promise<void>((resolve) => {
    (context as any).on('close', resolve);
  });

  console.log('Sesión guardada. Ya puedes publicar con: npm run cli -- publish');
}

function handleGroups(args: string[]) {
  const subcommand = args[0];

  switch (subcommand) {
    case 'list': {
      const groups = groupsRepo.getAll();
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
      const name = args[1];
      const url = args[2];
      if (!name || !url) {
        console.log('Uso: groups add <name> <url>');
        return;
      }
      const match = url.match(/groups\/(\d+)/);
      const fbGroupId = match ? match[1] : url;
      const group = groupsRepo.create({
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
      const id = args[1];
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

  switch (subcommand) {
    case 'list': {
      const templates = templatesRepo.getAll();
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
      const name = args[1];
      const body = args.slice(2).join(' ');
      if (!name || !body) {
        console.log('Uso: templates add <name> "<body>"');
        return;
      }
      const template = templatesRepo.create({
        name,
        body,
        variables: [],
        isActive: true,
      });
      console.log(`Plantilla creada: ${template.name} (${template.id})`);
      break;
    }
    case 'remove': {
      const id = args[1];
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
  const publisher = createPublisher();

  const rotationFlag = args.indexOf('--rotation');
  const rotation = rotationFlag !== -1 ? parseInt(args[rotationFlag + 1], 10) : 0;

  if (args[0] === '--all') {
    const groups = groupsRepo.getActive();
    const templates = templatesRepo.getActive();
    if (groups.length === 0 || templates.length === 0) {
      console.log('No hay grupos activos o plantillas activas.');
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

  const groupId = args[0];
  const templateId = args[1];

  if (!groupId || !templateId) {
    console.log('Uso: publish <groupId> <templateId> [--rotation N]');
    return;
  }

  const group = groupsRepo.getById(groupId);
  const template = templatesRepo.getById(templateId);
  if (!group) { console.log('Grupo no encontrado.'); return; }
  if (!template) { console.log('Plantilla no encontrada.'); return; }

  const rendered = renderTemplate(template, rotation);
  console.log(`\nPublicando en "${group.name}" via mbasic.facebook.com...`);
  console.log(`Contenido:\n${rendered.text}\n`);

  const result = await publisher.publish(group.fbGroupId, rendered.text, template.images);

  publicationsRepo.create({
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
  const publisher = createPublisher();

  switch (subcommand) {
    case 'list': {
      const rules = scheduleRepo.getAll();
      if (rules.length === 0) {
        console.log('No hay reglas de programación.');
        return;
      }
      console.log('\nReglas de programación:\n');
      for (const r of rules) {
        const status = r.isActive ? '●' : '○';
        console.log(`  ${status} ${r.name}`);
        console.log(`    ID: ${r.id}`);
        console.log(`    Cron: ${r.cronExpression} (${r.timezone})`);
        console.log(`    Grupos: ${r.groupIds.length} | Plantillas: ${r.templateIds.length} | Rotación: #${r.rotationIndex}`);
        console.log('');
      }
      break;
    }
    case 'start': {
      console.log('Iniciando scheduler...');
      startScheduler(publisher);
      console.log('Scheduler activo. Presiona Ctrl+C para detener.');
      await new Promise(() => {});
      break;
    }
    case 'trigger': {
      const ruleId = args[1];
      if (!ruleId) { console.log('Uso: schedule trigger <ruleId>'); return; }
      console.log('Ejecutando regla...');
      await triggerRule(ruleId, publisher);
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
  const groups = groupsRepo.getAll();
  const templates = templatesRepo.getAll();
  const publications = publicationsRepo.getAll(100);
  const schedules = scheduleRepo.getAll();

  const successful = publications.filter((p) => p.status === 'success').length;
  const failed = publications.filter((p) => p.status === 'failed').length;

  console.log(`
  FB Publisher - Estado (Playwright + mbasic.facebook.com)
  ─────────────────────────────────
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
