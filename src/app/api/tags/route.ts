import { NextRequest, NextResponse } from 'next/server';
import { tagsRepo } from '@/lib/db/repositories';
import { DEFAULT_ACCOUNT_ID } from '@/lib/config';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('accountId') || DEFAULT_ACCOUNT_ID;
  return NextResponse.json(tagsRepo.getAll(accountId));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, color, accountId } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  // Tag names are unique per account, so creating an existing one returns it
  // instead of failing the request.
  const tag = tagsRepo.findOrCreate(accountId || DEFAULT_ACCOUNT_ID, name.trim(), color);
  return NextResponse.json(tag, { status: 201 });
}
