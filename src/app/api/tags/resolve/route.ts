import { NextRequest, NextResponse } from 'next/server';
import { groupsRepo } from '@/lib/db/repositories';
import { DEFAULT_ACCOUNT_ID, getConfig } from '@/lib/config';

/**
 * Resolves a tag selection to the set of groups a rule would actually publish
 * to, plus how long one full rotation takes.
 *
 * The coverage figure is the point of this endpoint: a rule over 396 groups is
 * not "396 posts", it is one post per cron tick capped by the per-account daily
 * limit, so a full pass takes weeks. Showing that next to the group count is
 * what tells someone whether the tag they picked is the right size.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('accountId') || DEFAULT_ACCOUNT_ID;
  const tagIds = (searchParams.get('tagIds') || '').split(',').filter(Boolean);

  const groups = groupsRepo.getActiveByTags(tagIds, accountId);

  // Total carrying the tag, active or not. The gap between the two is the
  // number the UI has to explain: a tag chip says "Argentina (26)" while only
  // the active ones are ever published to, and freshly imported groups start
  // inactive until their membership is verified.
  const all = groupsRepo.getAll(accountId);
  const totalCount = tagIds.length === 0
    ? all.length
    : all.filter((g) => g.tagIds.some((id) => tagIds.includes(id))).length;

  const { behavior } = getConfig();
  const perDay = Math.max(1, behavior.maxPostsPerDayTotal);

  return NextResponse.json({
    groupCount: groups.length,
    totalCount,
    inactiveCount: totalCount - groups.length,
    isAllGroups: tagIds.length === 0,
    maxPostsPerDay: behavior.maxPostsPerDayTotal,
    fullRotationDays: Math.ceil(groups.length / perDay),
  });
}
