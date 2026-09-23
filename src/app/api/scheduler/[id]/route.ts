import { NextRequest, NextResponse } from 'next/server';
import { scheduleRepo } from '@/lib/db/repositories';
import { triggerRuleNow } from '@/lib/scheduler/scheduler';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rule = scheduleRepo.getById(id);
  if (!rule) return NextResponse.json({ error: 'Schedule rule not found' }, { status: 404 });
  return NextResponse.json(rule);
}

/**
 * Runs a rule once, right now, and waits for the outcome.
 *
 * Defaults to a VISIBLE browser: this endpoint exists so you can watch the
 * automation drive Facebook and see where it breaks. It answers with the
 * concrete outcome (published / failed / skipped + reason) rather than a
 * bare 200, because "nothing happened and I don't know why" is the whole
 * problem this endpoint solves.
 *
 * Body: { headless?: boolean, force?: boolean, dryRun?: boolean }
 * `dryRun` (default false here) skips the real Playwright publisher and
 * simulates the run instead — same checks, nothing touches Facebook.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rule = scheduleRepo.getById(id);
  if (!rule) return NextResponse.json({ error: 'Schedule rule not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const result = await triggerRuleNow(id, {
    headless: typeof body.headless === 'boolean' ? body.headless : undefined,
    force: body.force === true,
    dryRun: body.dryRun === true,
  });

  return NextResponse.json(result);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const rule = scheduleRepo.getById(id);
  if (!rule) return NextResponse.json({ error: 'Schedule rule not found' }, { status: 404 });
  scheduleRepo.update(id, body);
  return NextResponse.json({ ...rule, ...body });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  scheduleRepo.delete(id);
  return NextResponse.json({ success: true });
}
