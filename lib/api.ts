import 'server-only';
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ensureWorkspace } from './db';
import { InputError } from './validation';

const COOKIE_NAME = 'follownest_workspace';
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

type Reply = NextResponse;
type Controller = (workspace: string) => Promise<Reply>;

/** An anonymous, HttpOnly session isolates demo data by browser. NOT a production login system. */
export async function withWorkspace(request: NextRequest, controller: Controller): Promise<Reply> {
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const origin = request.headers.get('origin');
      if (origin && new URL(origin).host !== request.nextUrl.host) {
        return NextResponse.json({ error: 'Cross-origin modifications are not permitted.' }, { status: 403 });
      }
    }
    const stored = request.cookies.get(COOKIE_NAME)?.value;
    const fresh = !stored || !UUID_PATTERN.test(stored);
    const workspace = fresh ? randomUUID() : stored;
    await ensureWorkspace(workspace);
    const response = await controller(workspace);
    response.headers.set('Cache-Control', 'no-store');
    if (fresh) {
      response.cookies.set(COOKIE_NAME, workspace, {
        httpOnly: true,
        secure: request.nextUrl.protocol === 'https:',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return response;
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Error && error.message.startsWith('DEMO_LIMIT:')) {
      return NextResponse.json({ error: error.message.replace('DEMO_LIMIT: ', '') }, { status: 422 });
    }
    console.error('API error:', error);
    return NextResponse.json({ error: 'Unexpected server error. Check environment variables and server logs.' }, { status: 500 });
  }
}

export async function jsonBody(request: NextRequest): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new InputError('Request must have Content-Type: application/json.');
  }
  try { return await request.json() as unknown; }
  catch { throw new InputError('Invalid JSON.'); }
}
