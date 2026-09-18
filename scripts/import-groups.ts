/**
 * Imports Facebook groups from the production .xlsx lists and tags them by
 * country.
 *
 *   npx tsx scripts/import-groups.ts "<carpeta con los .xlsx>"          # dry-run
 *   npx tsx scripts/import-groups.ts "<carpeta>" --apply                # escribe
 *   npx tsx scripts/import-groups.ts "<carpeta>" --apply --account=xyz
 *
 * Dry-run is the default on purpose: the lists contain ~400 groups and an
 * accidental import is tedious to undo.
 *
 * The workbooks do not share a layout — some have a URL column, others hide the
 * link behind a "Ver Grupo" hyperlink — so columns are located by header name
 * rather than by position.
 */
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import { groupsRepo, tagsRepo } from '../src/lib/db/repositories';
import { DEFAULT_ACCOUNT_ID } from '../src/lib/config';

/** Sheets that hold commentary or search queries rather than groups. */
const SKIP_SHEETS = /^(resumen|metodolog|mensaje|busqueda)/i;

const TAG_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#84cc16'];

/**
 * Countries that appear across the lists, mapped from their normalized form to
 * a canonical spelling. Used as a whitelist because the
 * "Categoria / Pais" column mixes real countries (ESPANA, ITALIA) with topics
 * (TRAMITES, CUBANOS), and merged cells propagate a topic down over hundreds of
 * rows — which would produce one useless tag holding half the database.
 */
const COUNTRIES = new Map<string, string>(([
  'Argentina', 'Bolivia', 'Brasil', 'Chile', 'Colombia', 'Cuba', 'Ecuador',
  'Guyana', 'Paraguay', 'Perú', 'Surinam', 'Uruguay', 'Venezuela',
  'España', 'Italia', 'Francia', 'Alemania', 'Reino Unido', 'Bélgica',
  'Portugal', 'Holanda', 'Suecia', 'Polonia', 'Austria', 'Rusia', 'Noruega',
  'Dinamarca', 'Irlanda', 'Grecia', 'Rep. Checa', 'Suiza', 'Luxemburgo',
  'Finlandia',
] as const).map((name) => [normalizeHeader(name), name]));
/** Short, readable origin tag derived from the workbook filename. */
function originTag(filename: string): string {
  const f = filename.toLowerCase();
  if (f.includes('europa')) return 'Europa';
  if (f.includes('reclutamiento')) return 'Reclutamiento SA';
  if (f.includes('otros')) return 'Sudamerica 2';
  if (f.includes('sudamerica')) return 'Sudamerica 1';
  return 'Importado';
}

/**
 * Normalizes a cell value to a country name, or null when it is a topic
 * heading rather than a country.
 */
function asCountry(raw: string): string | null {
  // Returns the canonical spelling, not the one in the sheet: the same country
  // appears as ITALIA, Italia and italia across workbooks, which would
  // otherwise create three separate tags for one country.
  const key = normalizeHeader(raw).replace(/\s+/g, ' ').trim();
  return COUNTRIES.get(key) ?? null;
}

interface ParsedGroup {
  name: string;
  url: string;
  fbGroupId: string;
  /** null when the source row carried a topic heading instead of a country. */
  country: string | null;
  origin: string;
  source: string;
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Facebook group URLs appear as numeric ids and as vanity slugs, on both
 * www. and business. hosts. Anything else (Telegram, Google searches, plain
 * pages) returns null and is skipped.
 */
function parseFacebookGroupId(url: string): string | null {
  const match = url.match(/facebook\.com\/groups\/([^/?#\s]+)/i);
  return match ? match[1] : null;
}

/**
 * Pulls a URL out of a cell, whether it is plain text or a hyperlink.
 * ExcelJS models a linked cell as `{ text, hyperlink }`, and the link can also
 * sit on the cell itself, so both shapes are checked.
 */
type LinkCellValue = { text?: string; hyperlink?: string };

function cellUrl(cell: ExcelJS.Cell): string | null {
  const value = cell.value as LinkCellValue | string | null;
  const link = (typeof value === 'object' && value?.hyperlink) || cell.hyperlink;
  if (typeof link === 'string' && link.startsWith('http')) return link;

  const text = typeof value === 'string' ? value : value?.text;
  if (typeof text === 'string' && text.startsWith('http')) return text;
  return null;
}

function findHeaderRow(sheet: ExcelJS.Worksheet): { rowNumber: number; headers: string[] } | null {
  const limit = Math.min(sheet.rowCount, 6);
  for (let r = 1; r <= limit; r++) {
    const headers: string[] = [];
    sheet.getRow(r).eachCell({ includeEmpty: true }, (cell, col) => {
      headers[col] = normalizeHeader(cell.value);
    });
    const joined = headers.join('|');
    if (/nombre/.test(joined) && /(url|enlace|pais|categoria)/.test(joined)) {
      return { rowNumber: r, headers };
    }
  }
  return null;
}

function columnMatching(headers: string[], pattern: RegExp): number | null {
  for (let i = 0; i < headers.length; i++) {
    if (headers[i] && pattern.test(headers[i])) return i;
  }
  return null;
}

async function parseWorkbook(file: string): Promise<ParsedGroup[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const found: ParsedGroup[] = [];

  for (const sheet of wb.worksheets) {
    if (SKIP_SHEETS.test(sheet.name)) continue;

    const header = findHeaderRow(sheet);
    if (!header) {
      console.warn(`  ! hoja "${sheet.name}": no se encontró fila de cabecera, se omite`);
      continue;
    }

    const nameCol = columnMatching(header.headers, /nombre/);
    const urlCol = columnMatching(header.headers, /url|enlace/);
    const countryCol = columnMatching(header.headers, /pais|categoria/);

    for (let r = header.rowNumber + 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);

      // Prefer the declared URL column, but fall back to scanning the row:
      // the Europa workbooks keep the link on a "Ver Grupo" label instead.
      let url: string | null = urlCol ? cellUrl(row.getCell(urlCol)) : null;
      if (!url) {
        row.eachCell({ includeEmpty: false }, (cell) => {
          if (!url) url = cellUrl(cell);
        });
      }
      if (!url) continue;

      const fbGroupId = parseFacebookGroupId(url);
      if (!fbGroupId) continue; // Telegram, Google, pages...

      const name = nameCol ? String(row.getCell(nameCol).value ?? '').trim() : '';

      // Try the country column first, then the city/region one: the Europa
      // workbook keeps the country there when the first column holds a topic.
      let country = countryCol ? asCountry(String(row.getCell(countryCol).value ?? '')) : null;
      if (!country) {
        const regionCol = columnMatching(header.headers, /ciudad|region/);
        if (regionCol) country = asCountry(String(row.getCell(regionCol).value ?? ''));
      }

      found.push({
        name: name || `Grupo ${fbGroupId}`,
        url: url.split('?')[0],
        fbGroupId,
        country,
        origin: originTag(path.basename(file)),
        source: path.basename(file),
      });
    }
  }

  return found;
}

async function main() {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--'));
  const apply = args.includes('--apply');
  const accountArg = args.find((a) => a.startsWith('--account='));
  const accountId = accountArg ? accountArg.split('=')[1] : DEFAULT_ACCOUNT_ID;

  if (!dir) {
    console.error('Uso: npx tsx scripts/import-groups.ts "<carpeta con .xlsx>" [--apply] [--account=id]');
    process.exit(1);
  }
  if (!fs.existsSync(dir)) {
    console.error(`No existe la carpeta: ${dir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.xlsx') && !f.startsWith('~$'));
  console.log(`${files.length} ficheros en ${dir}\n`);

  const all: ParsedGroup[] = [];
  for (const f of files) {
    console.log(`Leyendo ${f}`);
    const parsed = await parseWorkbook(path.join(dir, f));
    console.log(`  ${parsed.length} grupos de Facebook`);
    all.push(...parsed);
  }

  // Deduplicate by Facebook group id — the same group appears across workbooks
  // under slightly different names, so the name is not a usable key.
  const unique = new Map<string, ParsedGroup>();
  for (const g of all) {
    if (!unique.has(g.fbGroupId)) unique.set(g.fbGroupId, g);
  }

  const existing = new Set(groupsRepo.getAll(accountId).map((g) => g.fbGroupId));
  const toCreate = [...unique.values()].filter((g) => !existing.has(g.fbGroupId));

  // Every group gets its origin tag; those with a recognised country get that
  // one too. A group can carry both, which is the point of tags over a single
  // category field.
  const byTag = new Map<string, ParsedGroup[]>();
  const push = (tagName: string, g: ParsedGroup) => {
    const list = byTag.get(tagName);
    if (list) list.push(g);
    else byTag.set(tagName, [g]);
  };
  for (const g of toCreate) {
    push(g.origin, g);
    if (g.country) push(g.country, g);
  }
  const withoutCountry = toCreate.filter((g) => !g.country).length;

  console.log('\n─── Resumen ───');
  console.log(`  filas con grupo de Facebook : ${all.length}`);
  console.log(`  grupos únicos               : ${unique.size}`);
  console.log(`  ya en la base de datos      : ${unique.size - toCreate.length}`);
  console.log(`  se crearían                 : ${toCreate.length}`);
  console.log(`  sin país reconocido         : ${withoutCountry} (solo tag de origen)`);
  console.log('\n─── Tags que se crearían ───');
  for (const [tagName, list] of [...byTag].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${tagName.padEnd(28)} ${list.length}`);
  }

  if (!apply) {
    console.log('\nDRY-RUN: no se ha escrito nada. Añade --apply para importar.');
    return;
  }

  let colorIndex = tagsRepo.getAll(accountId).length;

  // Create the groups once, keyed by fbGroupId, then attach every tag that
  // applies. Creating per tag would duplicate groups that carry two tags.
  const idByFbGroupId = new Map<string, string>();
  for (const g of toCreate) {
    const group = groupsRepo.create({
      accountId,
      name: g.name,
      fbGroupId: g.fbGroupId,
      url: g.url,
      category: g.country ?? undefined,
      // Imported groups start inactive: membership is unverified, and
      // publishing to a group you have not joined burns the account.
      isActive: false,
      maxPostsPerDay: 1,
      cooldownMinutes: 1440,
    });
    idByFbGroupId.set(g.fbGroupId, group.id);
  }

  for (const [tagName, list] of byTag) {
    const tag = tagsRepo.findOrCreate(accountId, tagName, TAG_COLORS[colorIndex++ % TAG_COLORS.length]);
    const ids = list.map((g) => idByFbGroupId.get(g.fbGroupId)).filter((id): id is string => !!id);
    groupsRepo.addTagToGroups(tag.id, ids);
    console.log(`  tag "${tagName}": ${ids.length} grupos`);
  }

  console.log(`\n${idByFbGroupId.size} grupos importados (inactivos). Verifica membresía antes de activarlos.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
