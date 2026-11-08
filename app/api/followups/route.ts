import { NextRequest, NextResponse } from 'next/server';
import { jsonBody, withWorkspace } from '@/lib/api';
import { createFollowup, getSnapshot } from '@/lib/db';
import { validateFollowup } from '@/lib/validation';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  return withWorkspace(request, async workspace => NextResponse.json({ items: (await getSnapshot(workspace)).followups }));
}
export async function POST(request: NextRequest) {
  return withWorkspace(request, async workspace => {
    const item = validateFollowup(await jsonBody(request));
    const id = await createFollowup(workspace, item);
    if (!id) return NextResponse.json({ error: 'Inquiry not found.' }, { status: 404 });
    return NextResponse.json({ id, message: 'Follow-up scheduled.' }, { status: 201 });
  });
}
