import { NextRequest, NextResponse } from 'next/server';
import { jsonBody, withWorkspace } from '@/lib/api';
import { deleteFollowup, setFollowupCompleted } from '@/lib/db';
import { validateFollowupPatch } from '@/lib/validation';
export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, { params }: Context) {
  const { id } = await params;
  return withWorkspace(request, async workspace => {
    const { completed } = validateFollowupPatch(await jsonBody(request));
    const updated = await setFollowupCompleted(workspace, id, completed);
    return updated ? NextResponse.json({ message: 'Reminder updated.' }) : NextResponse.json({ error: 'Reminder not found.' }, { status: 404 });
  });
}
export async function DELETE(request: NextRequest, { params }: Context) {
  const { id } = await params;
  return withWorkspace(request, async workspace => {
    const deleted = await deleteFollowup(workspace, id);
    return deleted ? NextResponse.json({ message: 'Reminder deleted.' }) : NextResponse.json({ error: 'Reminder not found.' }, { status: 404 });
  });
}
