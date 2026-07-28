import { NextRequest, NextResponse } from 'next/server';
import { templatesRepo } from '@/lib/db/repositories';
import { DEFAULT_ACCOUNT_ID } from '@/lib/config';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get('accountId') || DEFAULT_ACCOUNT_ID;
  const templates = templatesRepo.getAll(accountId);
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, body: templateBody, variables, images, tags, accountId } = body;

  if (!name || !templateBody) {
    return NextResponse.json({ error: 'name and body are required' }, { status: 400 });
  }

  const template = templatesRepo.create({
    accountId: accountId || DEFAULT_ACCOUNT_ID,
    name,
    body: templateBody,
    variables: variables || [],
    images: images || [],
    tags: tags || [],
    isActive: true,
  });

  return NextResponse.json(template, { status: 201 });
}
