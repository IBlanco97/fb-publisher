import { NextRequest, NextResponse } from 'next/server';
import { publicationsRepo } from '@/lib/db/repositories';
import { DEFAULT_ACCOUNT_ID } from '@/lib/config';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const groupId = searchParams.get('groupId');
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const accountId = searchParams.get('accountId') || DEFAULT_ACCOUNT_ID;

  let publications;
  if (status) {
    publications = publicationsRepo.getByStatus(status, accountId);
  } else if (groupId) {
    publications = publicationsRepo.getByGroup(groupId, limit);
  } else {
    publications = publicationsRepo.getAll(limit, accountId);
  }

  return NextResponse.json(publications);
}
