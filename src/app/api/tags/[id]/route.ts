import { NextRequest, NextResponse } from 'next/server';
import { tagsRepo, groupsRepo } from '@/lib/db/repositories';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tag = tagsRepo.getById(id);
  if (!tag) return NextResponse.json({ error: 'Tag not found' }, { status: 404 });

  const body = await req.json();
  tagsRepo.update(id, body);
  return NextResponse.json({ ...tag, ...body });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // group_tags rows cascade; the groups themselves are untouched.
  tagsRepo.delete(id);
  return NextResponse.json({ success: true });
}

/** Bulk assign or unassign this tag over a set of groups. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tag = tagsRepo.getById(id);
  if (!tag) return NextResponse.json({ error: 'Tag not found' }, { status: 404 });

  const { groupIds, action } = await req.json();
  if (!Array.isArray(groupIds) || groupIds.length === 0) {
    return NextResponse.json({ error: 'groupIds must be a non-empty array' }, { status: 400 });
  }

  if (action === 'remove') {
    groupsRepo.removeTagFromGroups(id, groupIds);
  } else {
    groupsRepo.addTagToGroups(id, groupIds);
  }

  return NextResponse.json({ success: true, affected: groupIds.length });
}
