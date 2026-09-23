import { NextRequest, NextResponse } from 'next/server';
import {
  startScheduler,
  stopAll,
  getSchedulerStatus,
  getEvents,
} from '@/lib/scheduler/scheduler';

/**
 * Scheduler status + activity log.
 *
 * `?since=<eventId>` returns only events newer than that id, so the
 * dashboard can poll cheaply and append instead of re-rendering the log.
 */
export async function GET(req: NextRequest) {
  const since = Number(req.nextUrl.searchParams.get('since') ?? 0);
  return NextResponse.json({
    ...getSchedulerStatus(),
    events: getEvents(Number.isFinite(since) ? since : 0),
  });
}

export async function POST(req: NextRequest) {
  const { action, headless, dryRun } = await req.json();

  if (action === 'start') {
    // `headless` is forwarded so the dashboard can launch a watchable
    // browser; omitted it falls back to PLAYWRIGHT_HEADLESS. `dryRun` runs
    // the exact same cron/jitter/rate-limit pipeline without ever touching
    // Facebook — every rule "publishes" through DryRunPublisher instead.
    const status = startScheduler({
      headless: typeof headless === 'boolean' ? headless : undefined,
      dryRun: dryRun === true,
    });
    return NextResponse.json({ ...status, events: getEvents(0) });
  }

  if (action === 'stop') {
    const status = stopAll();
    return NextResponse.json({ ...status, events: getEvents(0) });
  }

  return NextResponse.json({ error: 'action must be "start" or "stop"' }, { status: 400 });
}
