import { NextRequest, NextResponse } from 'next/server';
import { groupsRepo } from '@/lib/db/repositories';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const group = groupsRepo.getById(id);
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  return NextResponse.json(group);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const group = groupsRepo.getById(id);
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  groupsRepo.update(id, body);
  return NextResponse.json({ ...group, ...body });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  groupsRepo.delete(id);
  return NextResponse.json({ success: true });
}
