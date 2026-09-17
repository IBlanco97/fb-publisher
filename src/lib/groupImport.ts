import { parseDelimited, stripAccents } from './csv';

export interface ImportedGroupRow {
  name: string;
  url: string;
  fbGroupId: string;
  category?: string;
}

export interface ImportSkip {
  line: number;
  reason: string;
}

export interface ImportParseResult {
  rows: ImportedGroupRow[];
  skipped: ImportSkip[];
}

const HEADER_ALIASES: Record<'name' | 'url' | 'category', string[]> = {
  name: ['nombre', 'name', 'grupo', 'nombre del grupo', 'nombre del grupo en facebook'],
  url: ['url', 'enlace', 'enlace de acceso', 'link', 'facebook', 'url del grupo'],
  category: ['categoria', 'category', 'categoria / pais', 'pais', 'tipo'],
};

const FB_GROUP_URL_RE = /facebook\.com\/groups\/([^\/?#]+)/i;

function detectHeader(row: string[]): { nameIdx: number; urlIdx: number; categoryIdx: number | null } | null {
  const normalized = row.map(stripAccents);
  const nameIdx = normalized.findIndex((c) => HEADER_ALIASES.name.includes(c));
  const urlIdx = normalized.findIndex((c) => HEADER_ALIASES.url.includes(c));
  if (nameIdx === -1 || urlIdx === -1) return null;
  const categoryIdx = normalized.findIndex((c) => HEADER_ALIASES.category.includes(c));
  return { nameIdx, urlIdx, categoryIdx: categoryIdx === -1 ? null : categoryIdx };
}

/** Parses pasted CSV/TSV text into group candidates, skipping non-Facebook and duplicate rows. */
export function parseGroupImportText(text: string): ImportParseResult {
  const allRows = parseDelimited(text);
  const skipped: ImportSkip[] = [];
  if (allRows.length === 0) return { rows: [], skipped };

  let dataRows = allRows;
  let nameIdx = 0;
  let urlIdx = 1;
  let categoryIdx: number | null = 2;

  const header = detectHeader(allRows[0]);
  if (header) {
    nameIdx = header.nameIdx;
    urlIdx = header.urlIdx;
    categoryIdx = header.categoryIdx;
    dataRows = allRows.slice(1);
  }

  const rows: ImportedGroupRow[] = [];
  const seenFbGroupIds = new Set<string>();

  dataRows.forEach((row, i) => {
    const line = i + (header ? 2 : 1); // 1-indexed, accounting for header row
    const name = row[nameIdx]?.trim();
    const url = row[urlIdx]?.trim();
    const category = categoryIdx !== null ? row[categoryIdx]?.trim() || undefined : undefined;

    if (!name || !url) {
      skipped.push({ line, reason: 'falta nombre o URL' });
      return;
    }

    const match = url.match(FB_GROUP_URL_RE);
    if (!match) {
      skipped.push({ line, reason: 'no es una URL de grupo de Facebook' });
      return;
    }

    const fbGroupId = decodeURIComponent(match[1]);
    if (!fbGroupId) {
      skipped.push({ line, reason: 'no se pudo extraer el ID del grupo' });
      return;
    }

    if (seenFbGroupIds.has(fbGroupId)) {
      skipped.push({ line, reason: 'duplicado en el archivo' });
      return;
    }
    seenFbGroupIds.add(fbGroupId);

    rows.push({ name, url, fbGroupId, category });
  });

  return { rows, skipped };
}
