export function isOverdue(dueAt: string, completed: boolean, now: Date = new Date()): boolean {
  return !completed && new Date(dueAt).getTime() < now.getTime();
}
export function isDueToday(dueAt: string, completed: boolean, now: Date = new Date()): boolean {
  if (completed) return false;
  const due = new Date(dueAt);
  return due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth() && due.getDate() === now.getDate();
}
export function niceDate(value: string): string {
  return new Date(value).toLocaleString('en-BD', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
export function toDatetimeLocal(value: Date): string {
  // datetime-local values must represent the user's local clock, not UTC.
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
