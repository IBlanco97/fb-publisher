import { NextRequest, NextResponse } from 'next/server';
import { settingsRepo } from '@/lib/db/repositories';
import type { BehaviorSettings } from '@/lib/types';

const FIELDS: Array<keyof BehaviorSettings> = [
  'jitterMinMinutes',
  'jitterMaxMinutes',
  'globalMinGapMinutes',
  'maxPostsPerDayTotal',
  'crossAccountMinGapMinutes',
];

export async function GET() {
  return NextResponse.json(settingsRepo.get());
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const update: Partial<BehaviorSettings> = {};

  for (const field of FIELDS) {
    if (body[field] === undefined) continue;
    const value = Number(body[field]);
    if (!Number.isInteger(value) || value < 0) {
      return NextResponse.json({ error: `${field} debe ser un número entero mayor o igual a 0` }, { status: 400 });
    }
    update[field] = value;
  }

  const jitterMin = update.jitterMinMinutes ?? settingsRepo.get().jitterMinMinutes;
  const jitterMax = update.jitterMaxMinutes ?? settingsRepo.get().jitterMaxMinutes;
  if (jitterMax < jitterMin) {
    return NextResponse.json({ error: 'El máximo de demora (jitter) no puede ser menor que el mínimo' }, { status: 400 });
  }

  const settings = settingsRepo.update(update);
  return NextResponse.json(settings);
}
