import { NextRequest, NextResponse } from 'next/server';
import { publicationsRepo } from '@/lib/db/repositories';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const groupId = searchParams.get('groupId');
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  let publications;
  if (status) {
    publications = publicationsRepo.getByStatus(status);
  } else if (groupId) {
    publications = publicationsRepo.getByGroup(groupId, limit);
  } else {
    publications = publicationsRepo.getAll(limit);
  }

  return NextResponse.json(publications);
}
