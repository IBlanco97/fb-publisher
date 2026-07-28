import { NextRequest, NextResponse } from 'next/server';
import { groupsRepo } from '@/lib/db/repositories';
import { DEFAULT_ACCOUNT_ID } from '@/lib/config';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('accountId') || DEFAULT_ACCOUNT_ID;
  const groups = groupsRepo.getAll(accountId);
  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { name, fbGroupId, url, category, maxPostsPerDay, cooldownMinutes, accountId } = body;

  if (!name || !fbGroupId || !url) {
    return NextResponse.json({ error: 'name, fbGroupId, and url are required' }, { status: 400 });
  }

  const group = groupsRepo.create({
    accountId: accountId || DEFAULT_ACCOUNT_ID,
    name,
    fbGroupId,
    url,
    category: category || null,
    isActive: true,
    maxPostsPerDay: maxPostsPerDay || 3,
    cooldownMinutes: cooldownMinutes || 60,
  });

  return NextResponse.json(group, { status: 201 });
}
