import { NextRequest, NextResponse } from 'next/server';
import { templatesRepo } from '@/lib/db/repositories';
import { renderTemplate, getTotalCombinations } from '@/lib/templates/engine';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { templateId, rotationIndex } = body;

  if (!templateId) {
    return NextResponse.json({ error: 'templateId is required' }, { status: 400 });
  }

  const template = templatesRepo.getById(templateId);
  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const index = rotationIndex ?? 0;
  const rendered = renderTemplate(template, index);
  const totalCombinations = getTotalCombinations(template.variables);

  return NextResponse.json({
    ...rendered,
    totalCombinations,
    currentCycle: Math.floor(index / totalCombinations),
    positionInCycle: index % totalCombinations,
  });
}
