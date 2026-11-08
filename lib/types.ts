export const CHANNELS = ['Facebook', 'Instagram', 'WhatsApp', 'Other'] as const;
export const STATUSES = ['new', 'contacted', 'converted', 'closed'] as const;
export const PRIORITIES = ['low', 'normal', 'high'] as const;

export type Channel = (typeof CHANNELS)[number];
export type InquiryStatus = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];

export interface Inquiry {
  id: string;
  customer_name: string;
  contact: string;
  channel: Channel;
  subject: string;
  status: InquiryStatus;
  priority: Priority;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Followup {
  id: string;
  inquiry_id: string;
  customer_name: string;
  subject: string;
  due_at: string;
  note: string;
  completed: boolean;
  created_at: string;
}

export interface Snapshot {
  inquiries: Inquiry[];
  followups: Followup[];
  workspace: string;
  demo: true;
}

export interface InquiryPayload {
  customer_name: string;
  contact: string;
  channel: Channel;
  subject: string;
  status: InquiryStatus;
  priority: Priority;
  notes: string;
}

export interface FollowupPayload {
  inquiry_id: string;
  due_at: string;
  note: string;
}
