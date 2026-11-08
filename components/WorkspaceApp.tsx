'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Activity, ArrowDownRight, ArrowRight, Bell, CalendarClock, Check, CheckCheck, CheckCircle2,
  ChevronDown, ChevronRight, CircleHelp, Clock3, Copy, FilePenLine, Inbox,
  LayoutDashboard, ListFilter, Menu, MessageCircle, MessageSquareText,
  MoreHorizontal, Plus, RefreshCcw, Search, Send, Settings2, Sparkles,
  Trash2, UsersRound, X,
} from 'lucide-react';
import type { Channel, Followup, Inquiry, InquiryPayload, InquiryStatus, Priority, Snapshot } from '@/lib/types';
import { CHANNELS, PRIORITIES, STATUSES } from '@/lib/types';
import { fillTemplate, messageTemplates } from '@/lib/templates';
import { isDueToday, isOverdue, niceDate, toDatetimeLocal } from '@/lib/dates';

type Page = 'overview' | 'inquiries' | 'followups' | 'templates';
type LeadForm = InquiryPayload;
const blankLead: LeadForm = {
  customer_name: '', contact: '', channel: 'Facebook', subject: '',
  status: 'new', priority: 'normal', notes: '',
};
const NAV: Array<{ page: Page; title: string; icon: typeof LayoutDashboard }> = [
  { page: 'overview', title: 'Overview', icon: LayoutDashboard },
  { page: 'inquiries', title: 'Inquiries', icon: Inbox },
  { page: 'followups', title: 'Follow-ups', icon: CalendarClock },
  { page: 'templates', title: 'Reply templates', icon: MessageSquareText },
];
const pageNames: Record<Page, string> = { overview: 'Overview', inquiries: 'Customer inquiries', followups: 'Follow-up planner', templates: 'Reply templates' };
const statusLabels: Record<InquiryStatus, string> = { new: 'New', contacted: 'Contacted', converted: 'Converted', closed: 'Closed' };
const statusClass: Record<InquiryStatus, string> = { new: 'chip-new', contacted: 'chip-contacted', converted: 'chip-converted', closed: 'chip-closed' };
const colorClasses = ['avatar', 'avatar avatar-orange', 'avatar avatar-purple', 'avatar avatar-blue'];
function initials(name: string): string { return name.split(' ').slice(0, 2).map(s => s.charAt(0)).join('').toUpperCase(); }
function getAvatarClass(i: number): string { return colorClasses[i % colorClasses.length]; }

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', ...options });
  const data: unknown = await response.json();
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'error' in data ? String(data.error) : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

function Status({ status }: { status: InquiryStatus }) {
  return <span className={`chip ${statusClass[status]}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{statusLabels[status]}</span>;
}
function PriorityChip({ priority }: { priority: Priority }) {
  return <span className={`chip chip-priority-${priority}`}>{priority === 'high' ? '↑ ' : ''}{priority.charAt(0).toUpperCase() + priority.slice(1)}</span>;
}
function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="flex flex-wrap items-start justify-between gap-3">
    <div><h2 className="text-[17px] font-extrabold tracking-[-0.45px] text-[#1a4046]">{title}</h2>{subtitle && <p className="text-muted mt-1 text-xs leading-5">{subtitle}</p>}</div>
    {action}
  </div>;
}
function EmptyState({ icon: Icon, title, detail, action }: { icon: typeof Inbox; title: string; detail: string; action?: ReactNode }) {
  return <div className="empty"><div className="mb-3 rounded-2xl bg-[#f0f7f4] p-4 text-[#20836e]"><Icon size={24}/></div>
    <p className="text-sm font-extrabold text-[#34555a]">{title}</p><p className="mt-1 max-w-[270px] text-xs leading-5">{detail}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

export default function WorkspaceApp() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [page, setPage] = useState<Page>('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InquiryStatus>('all');
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [editing, setEditing] = useState<Inquiry | null>(null);
  const [leadForm, setLeadForm] = useState<LeadForm>(blankLead);
  const [reminderModalOpen, setReminderModalOpen] = useState(false);
  const [reminderLeadId, setReminderLeadId] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reminderNote, setReminderNote] = useState('');
  const [templateLanguage, setTemplateLanguage] = useState<'en' | 'bn'>('en');
  const [templateLead, setTemplateLead] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await api<Snapshot>('/api/bootstrap');
      setSnapshot(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the dashboard.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setLeadModalOpen(false); setReminderModalOpen(false); setMenuOpen(false); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const inquiries = useMemo(() => snapshot?.inquiries ?? [], [snapshot]);
  const followups = useMemo(() => snapshot?.followups ?? [], [snapshot]);
  const pending = inquiries.filter(l => l.status === 'new').length;
  const active = inquiries.filter(l => l.status === 'new' || l.status === 'contacted').length;
  const overdue = followups.filter(f => isOverdue(f.due_at, f.completed)).length;
  const today = followups.filter(f => isDueToday(f.due_at, f.completed)).length;
  const complete = followups.filter(f => f.completed).length;
  const searchLower = search.toLowerCase().trim();
  const visible = inquiries.filter(l => (statusFilter === 'all' || l.status === statusFilter)
    && (!searchLower || [l.customer_name, l.subject, l.channel, l.contact].some(v => v.toLowerCase().includes(searchLower))));
  const openReminders = followups.filter(f => !f.completed);

  function navigate(next: Page) { setPage(next); setMenuOpen(false); }
  function openNewLead() { setEditing(null); setLeadForm({ ...blankLead }); setLeadModalOpen(true); }
  function openEditLead(lead: Inquiry) {
    setEditing(lead);
    setLeadForm({ customer_name: lead.customer_name, contact: lead.contact, channel: lead.channel,
      subject: lead.subject, status: lead.status, priority: lead.priority, notes: lead.notes });
    setLeadModalOpen(true);
  }
  function openReminder(leadId = '') {
    setReminderLeadId(leadId || inquiries[0]?.id || '');
    setReminderDate(toDatetimeLocal(new Date(Date.now() + 24 * 3600_000)));
    setReminderNote('');
    setReminderModalOpen(true);
  }
  async function mutate(action: () => Promise<unknown>, message: string): Promise<boolean> {
    setWorking(true); setNotice('');
    try {
      await action();
      await load();
      setNotice(message);
      return true;
    } catch (e) {
      setNotice(e instanceof Error ? `Error: ${e.message}` : 'Something went wrong.');
      return false;
    } finally { setWorking(false); }
  }
  async function saveLead(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const path = editing ? `/api/inquiries/${editing.id}` : '/api/inquiries';
    const ok = await mutate(() => api(path, { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(leadForm) }), editing ? 'Inquiry updated successfully.' : 'New inquiry created.');
    if (ok) setLeadModalOpen(false);
  }
  async function saveReminder(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!reminderLeadId || !reminderDate) return;
    const parsed = new Date(reminderDate);
    if (Number.isNaN(parsed.getTime())) { setNotice('Choose a valid reminder date.'); return; }
    const ok = await mutate(() => api('/api/followups', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inquiry_id: reminderLeadId, due_at: parsed.toISOString(), note: reminderNote }) }), 'Follow-up scheduled.');
    if (ok) setReminderModalOpen(false);
  }
  async function toggleReminder(reminder: Followup) {
    await mutate(() => api(`/api/followups/${reminder.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: !reminder.completed }) }), reminder.completed ? 'Reminder marked pending.' : 'Follow-up completed!');
  }
  async function removeLead(lead: Inquiry) {
    if (!window.confirm(`Delete the inquiry from ${lead.customer_name}? Its reminders will also be removed.`)) return;
    const ok = await mutate(() => api(`/api/inquiries/${lead.id}`, { method: 'DELETE' }), 'Inquiry deleted.');
    if (ok) setLeadModalOpen(false);
  }
  async function removeReminder(reminder: Followup) {
    if (!window.confirm(`Delete this follow-up for ${reminder.customer_name}?`)) return;
    await mutate(() => api(`/api/followups/${reminder.id}`, { method: 'DELETE' }), 'Follow-up deleted.');
  }
  async function resetDemo() {
    if (!window.confirm('Replace your current demo records with the original sample data? Your changes will be lost.')) return;
    const ok = await mutate(() => api('/api/demo/reset', { method: 'POST' }), 'Sample data restored.');
    if (ok) { setSearch(''); setStatusFilter('all'); navigate('overview'); }
  }
  async function copyTemplate(source: string) {
    const lead = inquiries.find(l => l.id === templateLead);
    const copy = fillTemplate(source, lead?.customer_name ?? 'there', lead?.subject ?? 'your inquiry');
    try { await navigator.clipboard.writeText(copy); setNotice('Message copied! You can paste it into your messaging app.'); }
    catch { setNotice('Clipboard access was blocked. Please use HTTPS or localhost.'); }
  }

  const reminderList = (items: Followup[], condensed = false) => <div>
    {items.length === 0 ? <EmptyState icon={CheckCheck} title="All caught up!" detail="No follow-ups to show right now."/> : items.map(f => (
      <div key={f.id} className="flex items-start gap-3 border-b border-[#edf1ef] px-5 py-4 last:border-b-0">
        <button type="button" disabled={working} aria-label={f.completed ? `Mark ${f.customer_name} as pending` : `Complete follow-up for ${f.customer_name}`} onClick={() => void toggleReminder(f)}
          className={`mt-1 flex h-[21px] w-[21px] shrink-0 items-center justify-center rounded-md border ${f.completed ? 'border-[#16977d] bg-[#16977d] text-white' : 'border-[#b2c9c3] text-transparent hover:border-[#16977d]'}`}><Check size={14}/></button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[13px] font-bold ${f.completed ? 'text-[#8ba09d] line-through' : 'text-[#25454c]'}`}>{f.customer_name}</span>
            {!f.completed && isOverdue(f.due_at, false) && <span className="chip chip-overdue">Overdue</span>}
          </div>
          <p className="mt-0.5 truncate text-xs text-[#6b8084]">{f.note || f.subject}</p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#80999a]"><Clock3 size={11}/>{niceDate(f.due_at)} · {f.completed ? 'Completed' : 'Pending'}</p>
        </div>
        {!condensed && <button aria-label="Delete reminder" onClick={() => void removeReminder(f)} disabled={working} className="rounded-lg p-2 text-[#93a5a4] hover:bg-[#fff1f1] hover:text-[#b14b42]"><Trash2 size={15}/></button>}
      </div>
    ))}
  </div>;

  const inquiryTable = (rows: Inquiry[], condensed = false) => <div className="table-wrap">
    {rows.length === 0 ? <EmptyState icon={Inbox} title="No matching inquiries" detail="Try changing the search or create a new inquiry." action={<button className="btn btn-primary" onClick={openNewLead}><Plus size={15}/> New inquiry</button>} /> :
    <table className="data-table"><thead><tr><th>Customer</th><th>Inquiry</th><th>Channel</th><th>Status</th>{!condensed && <th>Priority</th>}<th className="text-right">Action</th></tr></thead>
      <tbody>{rows.map((l, i) => <tr key={l.id}>
        <td><div className="flex items-center gap-3"><div className={getAvatarClass(i)}>{initials(l.customer_name)}</div><div><div className="font-bold text-[#26454c]">{l.customer_name}</div><div className="mt-0.5 text-[10px] text-[#90a1a5]">{l.contact || 'No contact provided'}</div></div></div></td>
        <td><div className="max-w-[215px] truncate font-semibold text-[#3c5a60]" title={l.subject}>{l.subject}</div></td>
        <td><span className="text-[#698184]">{l.channel}</span></td>
        <td><Status status={l.status}/></td>
        {!condensed && <td><PriorityChip priority={l.priority}/></td>}
        <td className="text-right"><button className="btn btn-outline !px-3 !py-2" onClick={() => openEditLead(l)} aria-label={`Edit ${l.customer_name}`}>View <ChevronRight size={13}/></button></td>
      </tr>)}</tbody></table>}
  </div>;

  return <div className="app-shell">
    <div className={`mobile-shade ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)} aria-hidden="true" />
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`} aria-label="Main navigation">
      <div className="mb-3 flex items-center gap-3 px-2">
        <div className="brand-mark"><MessageCircle size={23} strokeWidth={2.6}/></div>
        <div><div className="brand-name">FollowNest<span className="text-[#7bdbc2]">.</span></div><div className="brand-subtitle">EVERY INQUIRY MATTERS</div></div>
      </div>
      <div className="nav-heading">Workspace</div>
      <nav aria-label="Workspace pages">
        {NAV.map(item => <button key={item.page} className={`nav-item ${page === item.page ? 'active' : ''}`} onClick={() => navigate(item.page)} aria-current={page === item.page ? 'page' : undefined}>
          <item.icon size={17}/>{item.title}{item.page === 'followups' && overdue > 0 && <span className="nav-count">{overdue}</span>}
        </button>)}
      </nav>
      <div className="nav-heading">Demo tools</div>
      <button className="nav-item" onClick={() => void resetDemo()} disabled={working}><RefreshCcw size={17}/> Reset sample data</button>
      <div className="sidebar-footer">
        <div className="mb-2 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#357163] text-[#dbfff3]"><Sparkles size={15}/></span><span className="text-xs font-extrabold text-white">Smarter Follow-Ups</span></div>
        <p className="text-[11px] leading-[1.6] text-[#b4d0cb]">Never miss a customer conversation. Stay organized,
    follow up, and grow your business.</p>
      </div>
    </aside>

    <main className="main">
      <header className="topbar">
        <div className="flex items-center gap-3"><button className="mobile-trigger rounded-lg p-2 text-[#284b4c]" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={20}/></button><span className="text-[13px] font-bold text-[#36565c]">Workspace <span className="mx-2 text-[#aec2c0]">/</span> <span className="text-[#1c806a]">{pageNames[page]}</span></span></div>
        <div className="flex items-center gap-3"><span className="hidden items-center gap-2 rounded-full bg-[#e8f6f1] px-3 py-1.5 text-[10px] font-extrabold text-[#23826e] sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-[#36aa86]"/> DEMO WORKSPACE</span><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#dcefe8] text-xs font-extrabold text-[#25755f]">FN</div></div>
      </header>
      <div className="page">
        {loading ? <div className="surface p-12 text-center"><div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-[#d7ede5] border-t-[#17856d]"/><p className="text-sm text-muted">Preparing your demo workspace...</p></div>
        : error ? <div className="surface mx-auto max-w-xl p-10 text-center"><CircleHelp className="mx-auto mb-4 text-[#b56d46]" size={32}/><h1 className="text-xl font-extrabold">Could not load FollowNest</h1><p className="text-muted mt-2 text-sm">{error}</p><p className="text-muted mt-3 text-xs">Check the terminal for errors and review README.md database setup.</p><button className="btn btn-primary mt-5" onClick={() => { setLoading(true); void load(); }}><RefreshCcw size={15}/> Retry</button></div>
        : <>
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div><div className="eyebrow mb-2">Small business, smarter follow-ups</div><h1 className="heading">{page === 'overview' ? 'Good to see you again 👋' : pageNames[page]}</h1><p className="subheading">{page === 'overview' ? 'Here is what is happening with your customer conversations today.' : page === 'inquiries' ? 'Keep every potential customer organized in one place.' : page === 'followups' ? 'Never forget a conversation that deserves a second message.' : 'Respond faster with friendly, ready-to-personalize messages.'}</p></div>
            <button onClick={openNewLead} className="btn btn-primary"><Plus size={16}/> New inquiry</button>
          </div>

          {page === 'overview' && <div className="space-y-6">
            <section className="hero flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
              <div className="relative z-10 max-w-[600px]"><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#ffffff22] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest"><Sparkles size={12}/> Simple selling, less chaos</div>
                <h2 className="mt-1 text-[24px] font-extrabold tracking-tight sm:text-[27px]">Turn inquiries into conversations.</h2><p className="mt-2 max-w-[500px] text-[13px] leading-6 text-[#d8eee7]">Keep track of every customer, remember who to contact next, and make every reply count.</p>
                <button onClick={() => navigate('inquiries')} className="btn mt-5 bg-white !text-[#126854] hover:bg-[#eafbf2]">Explore inquiries <ArrowRight size={15}/></button></div>
              <div className="relative z-10 hidden h-28 w-36 shrink-0 items-center justify-center lg:flex"><div className="absolute top-0 right-0 rotate-6 rounded-2xl border border-white/30 bg-white/20 p-4 text-white shadow-xl"><MessageCircle size={42}/></div><div className="absolute bottom-0 left-2 -rotate-12 rounded-xl border border-white/35 bg-[#cff6e5] p-3 text-[#1b8166] shadow-lg"><CheckCircle2 size={29}/></div></div>
            </section>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[
                { title:'Total inquiries', value: inquiries.length, icon: Inbox, tone:'bg-[#e9f4f5] text-[#29778b]', hint:'All customer inquiries' },
                { title:'Active conversations', value: active, icon: MessageCircle, tone:'bg-[#edf5ff] text-[#507ab0]', hint:'New + contacted' },
                { title:'Waiting for reply', value: pending, icon: Clock3, tone:'bg-[#fff5e5] text-[#ac7b2e]', hint:'Unanswered inquiries' },
                { title:'Overdue follow-ups', value: overdue, icon: Bell, tone:'bg-[#fff0eb] text-[#c46a4f]', hint:'Needs attention' },
              ].map(item => <div key={item.title} className="surface p-[18px] sm:p-[22px]"><div className="mb-5 flex items-center justify-between"><div className={`rounded-xl p-2.5 ${item.tone}`}><item.icon size={19}/></div><ArrowDownRight className="text-[#c9d6d3]" size={16}/></div><div className="kpi-number">{item.value}</div><p className="mt-2 text-[12px] font-bold text-[#36565b]">{item.title}</p><p className="mt-1 text-[10px] text-[#8aa09e]">{item.hint}</p></div>)}
            </div>
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
              <section className="surface overflow-hidden"><div className="flex items-center justify-between px-5 pt-5 pb-4"><SectionTitle title="Recent inquiries" subtitle="Customer conversations in your pipeline"/><button className="btn btn-outline !px-3 !py-2" onClick={() => navigate('inquiries')}>View all <ArrowRight size={13}/></button></div>{inquiryTable(inquiries.slice(0, 4), true)}</section>
              <section className="surface overflow-hidden"><div className="flex items-center justify-between px-5 pt-5 pb-4"><SectionTitle title="Next follow-ups" subtitle={`${today} due today · ${overdue} overdue`}/><button onClick={() => navigate('followups')} className="rounded-lg p-2 text-[#6e8d89] hover:bg-[#eef5f1]" aria-label="View all follow-ups"><ArrowRight size={17}/></button></div>{reminderList(openReminders.slice(0, 4), true)}<div className="border-t border-[#edf1ef] p-3"><button onClick={() => openReminder()} disabled={inquiries.length === 0} className="btn btn-soft w-full"><Plus size={14}/> Schedule a reminder</button></div></section>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <section className="surface p-5 sm:p-6"><SectionTitle title="Where inquiries come from" subtitle="Source breakdown of all inquiries"/>
                <div className="mt-6 space-y-4">{CHANNELS.map(channel => { const total = inquiries.filter(l => l.channel === channel).length; return <div key={channel}><div className="mb-1.5 flex justify-between text-xs"><span className="font-semibold text-[#3d5d5d]">{channel}</span><span className="font-bold text-[#587474]">{total}</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${inquiries.length ? (total / inquiries.length) * 100 : 0}%` }}/></div></div>; })}</div>
              </section>
              <section className="surface flex flex-col justify-between p-5 sm:p-6"><div><SectionTitle title="A little progress every day" subtitle="Keep your follow-ups moving"/><div className="mt-6 flex items-center gap-4"><div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-[8px] border-[#d7f0e6] bg-[#f4fbf7] text-xl font-extrabold text-[#187967]">{followups.length ? Math.round(complete / followups.length * 100) : 0}%</div><div><p className="text-sm font-extrabold text-[#32585a]">{complete} reminders completed</p><p className="mt-1 text-xs leading-5 text-[#829895]">Every timely follow-up is an opportunity to build trust.</p></div></div></div><button className="btn btn-outline mt-5" onClick={() => navigate('followups')}>Review follow-ups <ArrowRight size={14}/></button></section>
            </div>
          </div>}

          {page === 'inquiries' && <section className="surface overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5"><SectionTitle title="Your inquiry pipeline" subtitle={`${visible.length} shown · ${inquiries.length} total`}/><button className="btn btn-soft" onClick={() => openReminder()} disabled={!inquiries.length}><CalendarClock size={14}/> Schedule follow-up</button></div>
            <div className="flex flex-col gap-3 border-y border-[#edf1ef] bg-[#fbfcfb] px-5 py-4 sm:flex-row sm:items-center">
              <label className="relative min-w-0 flex-1"><Search size={17} className="absolute top-[13px] left-3 text-[#96a9a5]"/><input aria-label="Search inquiries" value={search} onChange={e => setSearch(e.target.value)} className="control !pl-10" placeholder="Search by customer, topic or channel..." /></label>
              <label className="relative flex shrink-0 items-center"><ListFilter size={15} className="absolute left-3 text-[#849999]"/><select aria-label="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)} className="control !min-w-[160px] !pl-10"><option value="all">All statuses</option>{STATUSES.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></label>
            </div>{inquiryTable(visible)}</section>}

          {page === 'followups' && <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
            <section className="surface overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5"><SectionTitle title="Pending follow-ups" subtitle="Your scheduled customer reminders"/><button className="btn btn-primary" onClick={() => openReminder()} disabled={!inquiries.length}><Plus size={15}/> Schedule</button></div>{reminderList(openReminders)}</section>
            <div className="space-y-5"><section className="surface p-5"><SectionTitle title="Follow-up health" subtitle="Snapshot of your reminders"/><div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-xl bg-[#eef8f4] p-4"><p className="text-[28px] font-extrabold text-[#278169]">{complete}</p><p className="text-[11px] font-semibold text-[#5a8176]">Completed</p></div><div className="rounded-xl bg-[#fff0ea] p-4"><p className="text-[28px] font-extrabold text-[#ba614c]">{overdue}</p><p className="text-[11px] font-semibold text-[#a47b6e]">Overdue</p></div></div><p className="mt-4 text-xs leading-5 text-[#829896]">Reminders are shown inside the app. Email, SMS and push notifications are not part of this demo.</p></section>
              <section className="surface overflow-hidden"><div className="px-5 pt-5 pb-3"><SectionTitle title="Completed reminders" subtitle="Conversations you followed up on"/></div>{reminderList(followups.filter(f => f.completed))}</section></div>
          </div>}

          {page === 'templates' && <div className="space-y-5">
            <div className="surface flex flex-wrap items-end justify-between gap-3 p-5"><div><label className="field" htmlFor="template-lead">Personalize with a customer (optional)</label><select id="template-lead" value={templateLead} onChange={e => setTemplateLead(e.target.value)} className="control min-w-[250px]"><option value="">Generic greeting</option>{inquiries.map(l => <option value={l.id} key={l.id}>{l.customer_name} — {l.subject}</option>)}</select></div>
              <div><div className="field">Message language</div><div className="flex rounded-xl bg-[#edf5f1] p-1"><button className={`btn !px-4 !py-2 ${templateLanguage === 'en' ? 'bg-white text-[#236c5d] shadow-sm' : '!text-[#778d88]'}`} onClick={() => setTemplateLanguage('en')}>English</button><button className={`btn !px-4 !py-2 ${templateLanguage === 'bn' ? 'bg-white text-[#236c5d] shadow-sm' : '!text-[#778d88]'}`} onClick={() => setTemplateLanguage('bn')}>বাংলা</button></div></div></div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{messageTemplates.map((t, i) => { const lead = inquiries.find(l => l.id === templateLead); const output = fillTemplate(t[templateLanguage], lead?.customer_name, lead?.subject); return <article key={t.id} className="template-card flex min-h-[265px] flex-col"><div className="mb-4 flex items-center justify-between"><span className={`rounded-xl p-2.5 ${i === 0 ? 'bg-[#eaf5ed] text-[#278369]' : i === 1 ? 'bg-[#fff5df] text-[#a57937]' : 'bg-[#eaf0ff] text-[#527eb6]'}`}>{i === 0 ? <MessageCircle size={20}/> : i === 1 ? <Clock3 size={20}/> : <CheckCircle2 size={20}/>}</span><span className="text-[10px] font-bold uppercase tracking-wider text-[#94a9a5]">Template 0{i+1}</span></div><h3 className="mb-3 text-[15px] font-extrabold text-[#2e5457]">{t.title}</h3><p className="flex-1 text-[13px] leading-[1.75] text-[#647e80]">{output}</p><button className="btn btn-outline mt-6 self-start" onClick={() => void copyTemplate(t[templateLanguage])}><Copy size={14}/> Copy reply</button></article>; })}</div>
            <div className="rounded-xl border border-[#dce9e4] bg-[#f0f8f4] p-4 text-xs leading-6 text-[#537b71]"><strong>Important:</strong> Copying a template does not send it to a customer. Messages are pasted manually into the seller's messaging app. No platform integration or automatic messaging is claimed.</div>
          </div>}
        </>}
      </div>
    </main>

    {notice && <div className="toast" role="status"><span>{notice}</span><button className="rounded-md p-1 hover:bg-white/20" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={16}/></button></div>}

    {leadModalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setLeadModalOpen(false); }}><section className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="lead-dialog-title"><div className="flex items-start justify-between border-b border-[#eaf0ed] px-6 py-5"><div><div className="eyebrow">Customer relationship</div><h2 id="lead-dialog-title" className="mt-1 text-xl font-extrabold tracking-tight">{editing ? 'Edit inquiry' : 'Add an inquiry'}</h2><p className="text-muted mt-1 text-xs">Keep the conversation details organized.</p></div><button onClick={() => setLeadModalOpen(false)} aria-label="Close dialog" className="rounded-lg p-2 text-[#7b9894] hover:bg-[#eef5f1]"><X size={20}/></button></div>
      <form onSubmit={e => void saveLead(e)} className="space-y-4 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><label className="field" htmlFor="lead-name">Customer name *</label><input id="lead-name" required minLength={2} maxLength={70} autoFocus className="control" placeholder="e.g. Sadia Rahman" value={leadForm.customer_name} onChange={e => setLeadForm(s => ({...s,customer_name:e.target.value}))}/></div>
        <div><label className="field" htmlFor="lead-contact">Contact / handle</label><input id="lead-contact" maxLength={100} className="control" placeholder="e.g. @sadia" value={leadForm.contact} onChange={e => setLeadForm(s => ({...s,contact:e.target.value}))}/></div></div>
        <div><label className="field" htmlFor="lead-subject">What did they ask about? *</label><input id="lead-subject" required minLength={3} maxLength={120} className="control" placeholder="e.g. Blue kurti availability" value={leadForm.subject} onChange={e => setLeadForm(s => ({...s,subject:e.target.value}))}/></div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><div><label htmlFor="lead-channel" className="field">Source</label><select id="lead-channel" className="control" value={leadForm.channel} onChange={e => setLeadForm(s => ({...s,channel:e.target.value as Channel}))}>{CHANNELS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
        <div><label htmlFor="lead-status" className="field">Status</label><select id="lead-status" className="control" value={leadForm.status} onChange={e => setLeadForm(s => ({...s,status:e.target.value as InquiryStatus}))}>{STATUSES.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></div>
        <div><label htmlFor="lead-priority" className="field">Priority</label><select id="lead-priority" className="control" value={leadForm.priority} onChange={e => setLeadForm(s => ({...s,priority:e.target.value as Priority}))}>{PRIORITIES.map(s => <option key={s} value={s}>{s[0].toUpperCase()+s.slice(1)}</option>)}</select></div></div>
        <div><label htmlFor="lead-notes" className="field">Notes</label><textarea id="lead-notes" rows={4} maxLength={1200} className="control resize-y" placeholder="What does the seller need to remember?" value={leadForm.notes} onChange={e => setLeadForm(s => ({...s,notes:e.target.value}))}/></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eaf0ed] pt-5"><div>{editing && <button type="button" disabled={working} className="btn btn-danger" onClick={() => void removeLead(editing)}><Trash2 size={14}/> Delete</button>}</div><div className="flex gap-2"><button type="button" className="btn btn-outline" onClick={() => setLeadModalOpen(false)}>Cancel</button>{editing && <button type="button" className="btn btn-soft" onClick={() => { setLeadModalOpen(false); openReminder(editing.id); }}><CalendarClock size={14}/> Follow-up</button>}<button type="submit" className="btn btn-primary" disabled={working}><Check size={14}/>{working ? 'Saving...' : editing ? 'Save changes' : 'Create inquiry'}</button></div></div>
      </form></section></div>}

    {reminderModalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setReminderModalOpen(false); }}><section className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="reminder-dialog-title"><div className="flex justify-between border-b border-[#eaf0ed] px-6 py-5"><div><div className="eyebrow">Keep the conversation alive</div><h2 id="reminder-dialog-title" className="mt-1 text-xl font-extrabold">Schedule a follow-up</h2><p className="text-muted mt-1 text-xs">Create an in-app reminder for a customer.</p></div><button className="rounded-lg p-2 text-[#7b9894] hover:bg-[#eef5f1]" aria-label="Close dialog" onClick={() => setReminderModalOpen(false)}><X size={20}/></button></div>
      <form className="space-y-4 p-6" onSubmit={e => void saveReminder(e)}><div><label className="field" htmlFor="followup-inquiry">Customer inquiry *</label><select id="followup-inquiry" required className="control" value={reminderLeadId} onChange={e => setReminderLeadId(e.target.value)}><option value="" disabled>Select an inquiry</option>{inquiries.map(l => <option value={l.id} key={l.id}>{l.customer_name} — {l.subject}</option>)}</select></div>
      <div><label className="field" htmlFor="followup-date">When to follow up? *</label><input id="followup-date" required type="datetime-local" className="control" value={reminderDate} onChange={e => setReminderDate(e.target.value)} /></div>
      <div><label className="field" htmlFor="followup-note">Reminder message</label><textarea id="followup-note" maxLength={500} rows={3} className="control" placeholder="e.g. Ask whether the customer has decided on the size." value={reminderNote} onChange={e => setReminderNote(e.target.value)}/></div>
      <p className="rounded-lg bg-[#f0f8f4] p-3 text-[11px] leading-5 text-[#588478]">FollowNest displays reminders in the application only. It will not send notifications or contact customers automatically.</p>
      <div className="flex justify-end gap-2 border-t border-[#eaf0ed] pt-5"><button type="button" className="btn btn-outline" onClick={() => setReminderModalOpen(false)}>Cancel</button><button type="submit" disabled={working || !reminderLeadId} className="btn btn-primary"><CalendarClock size={14}/>{working ? 'Scheduling...' : 'Save reminder'}</button></div></form></section></div>}
  </div>;
}
