import { CHANNELS, PRIORITIES, STATUSES, type FollowupPayload, type InquiryPayload } from './types.ts';

export class InputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InputError';
  }
}

type AnyRecord = Record<string, unknown>;
function object(value: unknown): AnyRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InputError('Expected a JSON object.');
  }
  return value as AnyRecord;
}
function text(value: unknown, field: string, max: number, min = 0): string {
  if (typeof value !== 'string') throw new InputError(`${field} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new InputError(`${field} must be between ${min} and ${max} characters.`);
  }
  return trimmed;
}
function choice<const T extends readonly string[]>(value: unknown, allowed: T, field: string): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw new InputError(`Invalid ${field}.`);
  }
  return value as T[number];
}

export function validateInquiry(value: unknown): InquiryPayload {
  const data = object(value);
  return {
    customer_name: text(data.customer_name, 'Customer name', 70, 2),
    contact: text(data.contact ?? '', 'Contact', 100),
    channel: choice(data.channel, CHANNELS, 'channel'),
    subject: text(data.subject, 'Subject', 120, 3),
    status: choice(data.status, STATUSES, 'status'),
    priority: choice(data.priority, PRIORITIES, 'priority'),
    notes: text(data.notes ?? '', 'Notes', 1200),
  };
}

export function validateFollowup(value: unknown): FollowupPayload {
  const data = object(value);
  const inquiry_id = text(data.inquiry_id, 'Inquiry ID', 80, 1);
  const due_at = text(data.due_at, 'Due date', 60, 1);
  const parsed = Date.parse(due_at);
  if (!Number.isFinite(parsed) || !/^\d{4}-\d\d-\d\dT/.test(due_at)) {
    throw new InputError('Please provide a valid date and time.');
  }
  return { inquiry_id, due_at: new Date(parsed).toISOString(), note: text(data.note ?? '', 'Reminder note', 500) };
}

export function validateFollowupPatch(value: unknown): { completed: boolean } {
  const data = object(value);
  if (typeof data.completed !== 'boolean') throw new InputError('completed must be true or false.');
  return { completed: data.completed };
}
