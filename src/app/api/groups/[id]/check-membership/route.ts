import { NextRequest, NextResponse } from 'next/server';
import { groupsRepo } from '@/lib/db/repositories';
import { checkGroupMembership } from '@/lib/publishers/membership-checker';
import { getConfig } from '@/lib/config';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const group = groupsRepo.getById(id);
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const config = getConfig();
  const status = await checkGroupMembership(group.fbGroupId, {
    userDataDir: config.playwright.userDataDir,
    headless: config.playwright.headless,
  });

  const checkedAt = new Date().toISOString();
  groupsRepo.update(id, { membershipStatus: status, membershipCheckedAt: checkedAt });

  return NextResponse.json({ ...group, membershipStatus: status, membershipCheckedAt: checkedAt });
}
