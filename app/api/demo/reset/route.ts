import { NextRequest, NextResponse } from 'next/server';
import { withWorkspace } from '@/lib/api';
import { resetSamples } from '@/lib/db';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  return withWorkspace(request, async workspace => {
    await resetSamples(workspace);
    return NextResponse.json({ message: 'Demo data restored.' });
  });
}
