import { NextRequest, NextResponse } from 'next/server';
import { withWorkspace } from '@/lib/api';
import { getSnapshot } from '@/lib/db';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  return withWorkspace(request, async workspace => NextResponse.json(await getSnapshot(workspace)));
}
