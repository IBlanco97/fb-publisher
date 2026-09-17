import { NextRequest, NextResponse } from 'next/server';
import { triggerRule } from '@/lib/scheduler/scheduler';
import { PublisherManager } from '@/lib/publishers';
import { scheduleRepo, accountsRepo } from '@/lib/db/repositories';
import { getAccountUserDataDir } from '@/lib/config';

/**
 * Runs a schedule rule once, immediately, outside of cron. `dryRun` defaults
 * to true — the real Playwright publisher only runs if the caller opts in
 * explicitly with { "dryRun": false }.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const dryRun = body.dryRun ?? true;

  const rule = scheduleRepo.getById(id);
  if (!rule) return NextResponse.json({ error: 'Rule not found' }, { status: 404 });

  const account = accountsRepo.getById(rule.accountId);
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const publisher = new PublisherManager({
    playwrightUserDataDir: getAccountUserDataDir(account.id),
    proxy: account.proxy,
    dryRun,
  });

  await triggerRule(id, publisher);
  return NextResponse.json({ ok: true, dryRun });
}
