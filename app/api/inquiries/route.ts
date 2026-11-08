import { NextRequest, NextResponse } from 'next/server';
import { jsonBody, withWorkspace } from '@/lib/api';
import { createInquiry, getSnapshot } from '@/lib/db';
import { validateInquiry } from '@/lib/validation';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  return withWorkspace(request, async workspace => NextResponse.json({ items: (await getSnapshot(workspace)).inquiries }));
}
export async function POST(request: NextRequest) {
  return withWorkspace(request, async workspace => {
    const data = validateInquiry(await jsonBody(request));
    const id = await createInquiry(workspace, data);
    return NextResponse.json({ id, message: 'Inquiry created.' }, { status: 201 });
  });
}
