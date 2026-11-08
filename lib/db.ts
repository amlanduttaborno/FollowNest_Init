import 'server-only';
import { createClient, type Client } from '@libsql/client';
import { randomUUID } from 'node:crypto';
import type { Followup, Inquiry, InquiryPayload, FollowupPayload, Snapshot } from './types';

let client: Client | undefined;
let schemaPromise: Promise<void> | undefined;
function database(): Client {
  if (!client) {
    const remoteUrl = process.env.TURSO_DATABASE_URL?.trim();
    if (process.env.VERCEL && !remoteUrl) {
      throw new Error('TURSO_DATABASE_URL is required on Vercel. Local SQLite cannot persist on Vercel.');
    }
    client = createClient({
      url: remoteUrl || 'file:data/follownest.db',
      authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined,
    });
  }
  return client;
}
export function db(): Client { return database(); }
export async function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await database().batch([
        `CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY, created_at TEXT NOT NULL
        )`,
        `CREATE TABLE IF NOT EXISTS inquiries (
          id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL,
          customer_name TEXT NOT NULL, contact TEXT NOT NULL DEFAULT '',
          channel TEXT NOT NULL, subject TEXT NOT NULL,
          status TEXT NOT NULL, priority TEXT NOT NULL,
          notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
        `CREATE INDEX IF NOT EXISTS inquiry_workspace_idx ON inquiries(workspace_id, created_at)`,
        `CREATE TABLE IF NOT EXISTS followups (
          id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL,
          inquiry_id TEXT NOT NULL, due_at TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '', completed INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        )`,
        `CREATE INDEX IF NOT EXISTS followups_workspace_idx ON followups(workspace_id, due_at)`,
      ], 'write');
    })().catch(error => { schemaPromise = undefined; throw error; });
  }
  await schemaPromise;
}

function isoOffset(days: number, hour = 14): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

async function insertSamples(workspace: string): Promise<void> {
  const now = new Date().toISOString();
  const examples: Array<InquiryPayload> = [
    { customer_name: 'Sadia Rahman', contact: '@sadia.demo', channel: 'Facebook', subject: 'Eid collection availability', status: 'new', priority: 'high', notes: 'Asked about blue kurti and sizes. Demo data only.' },
    { customer_name: 'Nusrat Jahan', contact: '@nusrat.demo', channel: 'Instagram', subject: 'Size and color confirmation', status: 'contacted', priority: 'normal', notes: 'Waiting for confirmation about medium size. Demo data only.' },
    { customer_name: 'Rafiul Islam', contact: '@rafiul.demo', channel: 'WhatsApp', subject: 'Bulk gift order', status: 'contacted', priority: 'high', notes: 'Asked for a quotation for 10 gift packs. Demo data only.' },
    { customer_name: 'Anika Chowdhury', contact: '@anika.demo', channel: 'Facebook', subject: 'Summer dress inquiry', status: 'converted', priority: 'low', notes: 'Customer confirmed their order. Demo data only.' },
  ];
  const ids = examples.map(() => randomUUID());
  const writes: Array<{ sql: string; args: Array<string | number> }> = examples.map((lead, i) => ({
    sql: `INSERT INTO inquiries (id,workspace_id,customer_name,contact,channel,subject,status,priority,notes,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    args: [ids[i], workspace, lead.customer_name, lead.contact, lead.channel, lead.subject, lead.status, lead.priority, lead.notes, now, now],
  }));
  writes.push(...[
    { inquiry_id: ids[0], due_at: isoOffset(-1), note: 'Reply with sizes and stock details', completed: 0 },
    { inquiry_id: ids[1], due_at: isoOffset(0, 23), note: 'Check if medium size works', completed: 0 },
    { inquiry_id: ids[2], due_at: isoOffset(2), note: 'Follow up on bulk price quotation', completed: 0 },
  ].map(item => ({
    sql: `INSERT INTO followups (id,workspace_id,inquiry_id,due_at,note,completed,created_at) VALUES (?,?,?,?,?,?,?)`,
    args: [randomUUID(), workspace, item.inquiry_id, item.due_at, item.note, item.completed, now],
  })));
  await database().batch(writes, 'write');
}

export async function ensureWorkspace(workspace: string): Promise<void> {
  await ensureSchema();
  const result = await database().execute({ sql: 'SELECT id FROM workspaces WHERE id = ?', args: [workspace] });
  if (result.rows.length) return;
  await database().execute({ sql: 'INSERT OR IGNORE INTO workspaces (id,created_at) VALUES (?,?)', args: [workspace, new Date().toISOString()] });
  await insertSamples(workspace);
}

export async function getSnapshot(workspace: string): Promise<Snapshot> {
  const [leadResult, followResult] = await Promise.all([
    database().execute({ sql: 'SELECT * FROM inquiries WHERE workspace_id = ? ORDER BY created_at DESC', args: [workspace] }),
    database().execute({ sql: `SELECT f.*, i.customer_name, i.subject FROM followups f
      JOIN inquiries i ON f.inquiry_id=i.id AND f.workspace_id=i.workspace_id
      WHERE f.workspace_id = ? ORDER BY f.due_at ASC`, args: [workspace] }),
  ]);
  const inquiries: Inquiry[] = leadResult.rows.map(row => ({
    id: String(row.id), customer_name: String(row.customer_name), contact: String(row.contact),
    channel: row.channel as Inquiry['channel'], subject: String(row.subject),
    status: row.status as Inquiry['status'], priority: row.priority as Inquiry['priority'],
    notes: String(row.notes), created_at: String(row.created_at), updated_at: String(row.updated_at),
  }));
  const followups: Followup[] = followResult.rows.map(row => ({
    id: String(row.id), inquiry_id: String(row.inquiry_id), customer_name: String(row.customer_name),
    subject: String(row.subject), due_at: String(row.due_at), note: String(row.note),
    completed: Number(row.completed) === 1, created_at: String(row.created_at),
  }));
  return { inquiries, followups, workspace: workspace.slice(0, 8), demo: true };
}

export async function createInquiry(workspace: string, item: InquiryPayload): Promise<string> {
  const count = await database().execute({ sql: 'SELECT COUNT(*) AS total FROM inquiries WHERE workspace_id = ?', args: [workspace] });
  if (Number(count.rows[0].total) >= 150) throw new Error('DEMO_LIMIT: You reached the 150-inquiry demo limit.');
  const id = randomUUID();
  const now = new Date().toISOString();
  await database().execute({
    sql: `INSERT INTO inquiries (id,workspace_id,customer_name,contact,channel,subject,status,priority,notes,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    args: [id, workspace, item.customer_name, item.contact, item.channel, item.subject, item.status, item.priority, item.notes, now, now],
  });
  return id;
}

export async function updateInquiry(workspace: string, id: string, item: InquiryPayload): Promise<boolean> {
  const result = await database().execute({
    sql: `UPDATE inquiries SET customer_name=?,contact=?,channel=?,subject=?,status=?,priority=?,notes=?,updated_at=?
      WHERE id=? AND workspace_id=?`,
    args: [item.customer_name, item.contact, item.channel, item.subject, item.status, item.priority, item.notes, new Date().toISOString(), id, workspace],
  });
  return result.rowsAffected > 0;
}

export async function deleteInquiry(workspace: string, id: string): Promise<boolean> {
  const found = await database().execute({ sql: 'SELECT id FROM inquiries WHERE id=? AND workspace_id=?', args: [id, workspace] });
  if (!found.rows.length) return false;
  await database().batch([
    { sql: 'DELETE FROM followups WHERE inquiry_id=? AND workspace_id=?', args: [id, workspace] },
    { sql: 'DELETE FROM inquiries WHERE id=? AND workspace_id=?', args: [id, workspace] },
  ], 'write');
  return true;
}

export async function createFollowup(workspace: string, item: FollowupPayload): Promise<string | null> {
  const found = await database().execute({ sql: 'SELECT id FROM inquiries WHERE id=? AND workspace_id=?', args: [item.inquiry_id, workspace] });
  if (!found.rows.length) return null;
  const id = randomUUID();
  await database().execute({
    sql: 'INSERT INTO followups (id,workspace_id,inquiry_id,due_at,note,completed,created_at) VALUES (?,?,?,?,?,0,?)',
    args: [id, workspace, item.inquiry_id, item.due_at, item.note, new Date().toISOString()],
  });
  return id;
}

export async function setFollowupCompleted(workspace: string, id: string, completed: boolean): Promise<boolean> {
  const result = await database().execute({
    sql: 'UPDATE followups SET completed=? WHERE id=? AND workspace_id=?',
    args: [completed ? 1 : 0, id, workspace],
  });
  return result.rowsAffected > 0;
}

export async function deleteFollowup(workspace: string, id: string): Promise<boolean> {
  const result = await database().execute({ sql: 'DELETE FROM followups WHERE id=? AND workspace_id=?', args: [id, workspace] });
  return result.rowsAffected > 0;
}

export async function resetSamples(workspace: string): Promise<void> {
  await database().batch([
    { sql: 'DELETE FROM followups WHERE workspace_id=?', args: [workspace] },
    { sql: 'DELETE FROM inquiries WHERE workspace_id=?', args: [workspace] },
  ], 'write');
  await insertSamples(workspace);
}
