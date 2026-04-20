import { NextRequest, NextResponse } from 'next/server';
import { scheduleRepo } from '@/lib/db/repositories';

export async function GET() {
  const rules = scheduleRepo.getAll();
  return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, groupIds, templateIds, cronExpression, timezone } = body;

  if (!name || !cronExpression) {
    return NextResponse.json({ error: 'name and cronExpression are required' }, { status: 400 });
  }

  const rule = scheduleRepo.create({
    name,
    groupIds: groupIds || [],
    templateIds: templateIds || [],
    cronExpression,
    rotationIndex: 0,
    isActive: true,
    timezone: timezone || 'America/Bogota',
  });

  return NextResponse.json(rule, { status: 201 });
}
