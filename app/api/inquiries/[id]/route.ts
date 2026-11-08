import { NextRequest, NextResponse } from 'next/server';
import { jsonBody, withWorkspace } from '@/lib/api';
import { updateInquiry, deleteInquiry } from '@/lib/db';
import { validateInquiry } from '@/lib/validation';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, { params }: Context) {
  const { id } = await params;
  return withWorkspace(request, async workspace => {
    const item = validateInquiry(await jsonBody(request));
    const updated = await updateInquiry(workspace, id, item);
    return updated ? NextResponse.json({ message: 'Inquiry updated.' }) : NextResponse.json({ error: 'Inquiry not found.' }, { status: 404 });
  });
}
export async function DELETE(request: NextRequest, { params }: Context) {
  const { id } = await params;
  return withWorkspace(request, async workspace => {
    const deleted = await deleteInquiry(workspace, id);
    return deleted ? NextResponse.json({ message: 'Inquiry deleted.' }) : NextResponse.json({ error: 'Inquiry not found.' }, { status: 404 });
  });
}
