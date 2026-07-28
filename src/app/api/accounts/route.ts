import { NextRequest, NextResponse } from 'next/server';
import { accountsRepo } from '@/lib/db/repositories';

export async function GET() {
  const accounts = accountsRepo.getAll();
  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, proxyServer, proxyUsername, proxyPassword } = body;

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const account = accountsRepo.create({
    name,
    proxy: proxyServer ? { server: proxyServer, username: proxyUsername || undefined, password: proxyPassword || undefined } : undefined,
    isActive: true,
  });

  return NextResponse.json(account, { status: 201 });
}
