import { NextRequest, NextResponse } from 'next/server';
import { templatesRepo } from '@/lib/db/repositories';

export async function GET() {
  const templates = templatesRepo.getAll();
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, body: templateBody, variables, images, tags } = body;

  if (!name || !templateBody) {
    return NextResponse.json({ error: 'name and body are required' }, { status: 400 });
  }

  const template = templatesRepo.create({
    name,
    body: templateBody,
    variables: variables || [],
    images: images || [],
    tags: tags || [],
    isActive: true,
  });

  return NextResponse.json(template, { status: 201 });
}
