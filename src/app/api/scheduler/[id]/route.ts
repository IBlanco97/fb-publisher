import { NextRequest, NextResponse } from 'next/server';
import { scheduleRepo } from '@/lib/db/repositories';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rule = scheduleRepo.getById(id);
  if (!rule) return NextResponse.json({ error: 'Schedule rule not found' }, { status: 404 });
  return NextResponse.json(rule);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const rule = scheduleRepo.getById(id);
  if (!rule) return NextResponse.json({ error: 'Schedule rule not found' }, { status: 404 });
  scheduleRepo.update(id, body);
  return NextResponse.json({ ...rule, ...body });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  scheduleRepo.delete(id);
  return NextResponse.json({ success: true });
}
