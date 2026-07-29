import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { accountsRepo } from '@/lib/db/repositories';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid account id' }, { status: 400 });
  }

  const account = accountsRepo.getById(id);
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  // Reuses the existing CLI login flow as a detached child process — it opens
  // a visible Chromium window ON THIS MACHINE (the one running the Next.js
  // server), not on whatever device is viewing the dashboard.
  // shell:true is required on Windows to resolve npm.cmd (spawning it
  // directly fails with EINVAL) — injection is prevented by the strict
  // allowlist regex on `id` above, not by argv-vs-shell semantics.
  const child = spawn('npm', ['run', 'cli', '--', 'login', '--account', id], {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
    shell: true,
  });
  child.unref();

  return NextResponse.json({ started: true });
}
