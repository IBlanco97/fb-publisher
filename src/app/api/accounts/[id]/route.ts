import { NextRequest, NextResponse } from 'next/server';
import { accountsRepo } from '@/lib/db/repositories';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = accountsRepo.getById(id);
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  return NextResponse.json(account);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const account = accountsRepo.getById(id);
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const { name, isActive, proxyServer, proxyUsername, proxyPassword } = body;
  accountsRepo.update(id, {
    ...(name !== undefined && { name }),
    ...(isActive !== undefined && { isActive }),
    ...(proxyServer !== undefined && {
      proxy: proxyServer ? { server: proxyServer, username: proxyUsername || undefined, password: proxyPassword || undefined } : null,
    }),
  });

  return NextResponse.json({ ...account, ...body });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  accountsRepo.delete(id);
  return NextResponse.json({ success: true });
}
