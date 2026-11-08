import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInquiry, validateFollowup, validateFollowupPatch, InputError } from '../lib/validation.ts';
import { fillTemplate } from '../lib/templates.ts';
import { isOverdue, isDueToday, toDatetimeLocal } from '../lib/dates.ts';

const sample = {
  customer_name: '  Rahim Ahmed  ', contact: ' @rahim.demo ', channel: 'Facebook',
  subject: '  Cotton shirt sizes  ', status: 'new', priority: 'high', notes: '  Wants size L  ',
};

test('valid inquiry is trimmed, typed and preserved', () => {
  const item = validateInquiry(sample);
  assert.equal(item.customer_name, 'Rahim Ahmed');
  assert.equal(item.subject, 'Cotton shirt sizes');
  assert.equal(item.contact, '@rahim.demo');
  assert.equal(item.priority, 'high');
});
test('invalid or missing required inquiry fields fail', () => {
  assert.throws(() => validateInquiry({ ...sample, customer_name: '' }), InputError);
  assert.throws(() => validateInquiry({ ...sample, channel: 'Telegram' }), InputError);
  assert.throws(() => validateInquiry({ ...sample, subject: 'Hi' }), InputError);
  assert.throws(() => validateInquiry(null), InputError);
  assert.throws(() => validateInquiry({ ...sample, notes: 'a'.repeat(1201) }), InputError);
});
test('follow-up accepts ISO date and normalizes', () => {
  const f = validateFollowup({ inquiry_id: 'abc-123', due_at: '2026-11-05T12:30:00.000Z', note: '  Reply soon  ' });
  assert.equal(f.note, 'Reply soon');
  assert.equal(f.due_at, '2026-11-05T12:30:00.000Z');
});
test('follow-up rejects malformed dates and flags', () => {
  assert.throws(() => validateFollowup({ inquiry_id: '1', due_at: 'tomorrow', note: '' }), InputError);
  assert.throws(() => validateFollowupPatch({ completed: 'true' }), InputError);
  assert.deepEqual(validateFollowupPatch({ completed: true }), { completed: true });
});
test('template placeholders personalize correctly', () => {
  assert.equal(fillTemplate('Hi {name}, about {subject}!', 'Sadia', 'Eid collection'), 'Hi Sadia, about Eid collection!');
  assert.equal(fillTemplate('Hi {name}'), 'Hi there');
});
test('overdue and due today are based on current time', () => {
  const now = new Date('2026-11-03T10:00:00Z');
  assert.equal(isOverdue('2026-11-03T09:00:00Z', false, now), true);
  assert.equal(isOverdue('2026-11-03T09:00:00Z', true, now), false);
  assert.equal(isOverdue('2026-11-04T09:00:00Z', false, now), false);
  assert.equal(isDueToday('2026-11-03T09:00:00Z', true, now), false);
});
test('local datetime field is properly formatted', () => {
  assert.match(toDatetimeLocal(new Date('2026-11-03T09:45:00Z')), /^2026-11-03T\d{2}:45$/);
});
