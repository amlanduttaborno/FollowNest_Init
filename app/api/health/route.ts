import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
export const runtime = 'nodejs';
export async function GET() {
  try {
    await ensureSchema();
    return NextResponse.json({ status: 'ok', database: 'connected', name: 'FollowNest API' });
  } catch {
    return NextResponse.json({ status: 'error', database: 'unavailable' }, { status: 503 });
  }
}
