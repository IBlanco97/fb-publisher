import { NextRequest, NextResponse } from 'next/server';
import { scheduleRepo } from '@/lib/db/repositories';
import { DEFAULT_ACCOUNT_ID } from '@/lib/config';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('accountId') || DEFAULT_ACCOUNT_ID;
  const rules = scheduleRepo.getAll(accountId);
  return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, groupIds, tagIds, templateIds, cronExpression, timezone, useJitter, accountId } = body;

  if (!name || !cronExpression) {
    return NextResponse.json({ error: 'name and cronExpression are required' }, { status: 400 });
  }

  const rule = scheduleRepo.create({
    accountId: accountId || DEFAULT_ACCOUNT_ID,
    name,
    groupIds: groupIds || [],
    tagIds: tagIds || [],
    templateIds: templateIds || [],
    cronExpression,
    rotationIndex: 0,
    isActive: true,
    timezone: timezone || 'America/Bogota',
    useJitter: useJitter ?? true,
  });

  return NextResponse.json(rule, { status: 201 });
}
