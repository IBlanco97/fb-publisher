import { NextRequest, NextResponse } from 'next/server';
import { groupsRepo } from '@/lib/db/repositories';

export async function GET() {
  const groups = groupsRepo.getAll();
  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { name, fbGroupId, url, category, maxPostsPerDay, cooldownMinutes } = body;

  if (!name || !fbGroupId || !url) {
    return NextResponse.json({ error: 'name, fbGroupId, and url are required' }, { status: 400 });
  }

  const group = groupsRepo.create({
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
