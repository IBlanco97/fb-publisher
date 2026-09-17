import { NextRequest, NextResponse } from 'next/server';
import { groupsRepo } from '@/lib/db/repositories';
import { parseGroupImportText } from '@/lib/groupImport';
import { DEFAULT_ACCOUNT_ID } from '@/lib/config';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { text, accountId, isActive, maxPostsPerDay, cooldownMinutes } = body;

  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  const resolvedAccountId = accountId || DEFAULT_ACCOUNT_ID;
  const { rows, skipped } = parseGroupImportText(text);

  const existingFbGroupIds = new Set(groupsRepo.getAll(resolvedAccountId).map((g) => g.fbGroupId));
  const toCreate = [];
  for (const row of rows) {
    if (existingFbGroupIds.has(row.fbGroupId)) {
      skipped.push({ line: -1, reason: `ya existe en el catálogo: ${row.name}` });
      continue;
    }
    existingFbGroupIds.add(row.fbGroupId);
    toCreate.push({
      accountId: resolvedAccountId,
      name: row.name,
      fbGroupId: row.fbGroupId,
      url: row.url,
      category: row.category,
      isActive: !!isActive,
      maxPostsPerDay: maxPostsPerDay || 3,
      cooldownMinutes: cooldownMinutes || 60,
    });
  }

  const created = toCreate.length > 0 ? groupsRepo.createMany(toCreate) : [];

  return NextResponse.json({
    createdCount: created.length,
    skippedCount: skipped.length,
    skipped: skipped.slice(0, 50),
    groups: created,
  });
}
