import { NextRequest, NextResponse } from 'next/server';
import { templatesRepo } from '@/lib/db/repositories';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const template = templatesRepo.getById(id);
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  return NextResponse.json(template);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const template = templatesRepo.getById(id);
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  templatesRepo.update(id, body);
  return NextResponse.json({ ...template, ...body });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  templatesRepo.delete(id);
  return NextResponse.json({ success: true });
}
