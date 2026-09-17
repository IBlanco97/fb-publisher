import { NextRequest, NextResponse } from 'next/server';
import { startScheduler, stopAll, isSchedulerRunning } from '@/lib/scheduler/scheduler';

export async function GET() {
  return NextResponse.json({ running: isSchedulerRunning() });
}

export async function POST(req: NextRequest) {
  const { action, dryRun } = await req.json();

  if (action === 'start') {
    startScheduler({ dryRun });
  } else if (action === 'stop') {
    stopAll();
  } else {
    return NextResponse.json({ error: 'action must be "start" or "stop"' }, { status: 400 });
  }

  return NextResponse.json({ running: isSchedulerRunning() });
}
