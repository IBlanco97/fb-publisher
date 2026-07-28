import { NextRequest, NextResponse } from 'next/server';
import { groupsRepo, accountsRepo } from '@/lib/db/repositories';
import { checkGroupMembership } from '@/lib/publishers/membership-checker';
import { getConfig, getAccountUserDataDir } from '@/lib/config';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const group = groupsRepo.getById(id);
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const config = getConfig();
  const account = accountsRepo.getById(group.accountId);
  const status = await checkGroupMembership(group.fbGroupId, {
    userDataDir: getAccountUserDataDir(group.accountId),
    headless: config.playwright.headless,
    proxy: account?.proxy,
  });

  const checkedAt = new Date().toISOString();
  groupsRepo.update(id, { membershipStatus: status, membershipCheckedAt: checkedAt });

  return NextResponse.json({ ...group, membershipStatus: status, membershipCheckedAt: checkedAt });
}
