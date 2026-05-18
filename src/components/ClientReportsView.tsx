import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/toast';
import { ArrowLeft, Plus, CreditCard as Edit2, Trash2, Eye, X, Mail, Calendar, Clock, CheckCircle, AlertTriangle, BookOpen, Shield, Users, FileText, Loader2, Send, Pause, Play, MapPin } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ClientReportsViewProps {
  onBack?: () => void;
}

interface ReportSchedule {
  id: string;
  company_id: string;
  client_id: string;
  site_ids: string[];
  frequency: 'daily' | 'weekly' | 'monthly';
  day_of_week: number | null;
  include_incidents: boolean;
  include_patrols: boolean;
  include_attendance: boolean;
  include_logbook: boolean;
  email_recipients: string[];
  is_active: boolean;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ScheduleForm {
  client_id: string;
  site_ids: string[];
  frequency: 'daily' | 'weekly' | 'monthly';
  day_of_week: number | null;
  include_incidents: boolean;
  include_patrols: boolean;
  include_attendance: boolean;
  include_logbook: boolean;
  email_recipients: string[];
  is_active: boolean;
}

const EMPTY_FORM: ScheduleForm = {
  client_id: '', site_ids: [], frequency: 'weekly', day_of_week: 1,
  include_incidents: true, include_patrols: true,
  include_attendance: true, include_logbook: true,
  email_recipients: [], is_active: true,
};

const ALLOWED_ROLES = ['company_admin', 'site_manager', 'super_admin'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const fmtDT = (s: string | null) =>
  s
    ? new Date(s).toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : 'Never';

/* ------------------------------------------------------------------ */
/*  Reusable Toggle                                                    */
/* ------------------------------------------------------------------ */

const Toggle: React.FC<{ enabled: boolean; onToggle: () => void }> = ({ enabled, onToggle }) => (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    onClick={onToggle}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      enabled ? 'bg-blue-600' : 'bg-gray-300'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
        enabled ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

/* ------------------------------------------------------------------ */
/*  Print CSS for preview window                                       */
/* ------------------------------------------------------------------ */

const PCSS = `@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none!important}}*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;font-size:11px;line-height:1.5}.page{padding:32px;max-width:900px;margin:0 auto}.hdr{border-bottom:3px solid #1e3a5f;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end}.hdr h1{font-size:22px;color:#1e3a5f;font-weight:700}.hdr .co{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px}.sg{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px}.sc{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;text-align:center}.sc .v{font-size:24px;font-weight:700;color:#1e3a5f}.sc .l{font-size:10px;color:#64748b;margin-top:2px;text-transform:uppercase;letter-spacing:.5px}.st{font-size:14px;font-weight:700;color:#1e3a5f;margin:24px 0 10px;padding-bottom:4px;border-bottom:1px solid #cbd5e1}table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:10px}th{background:#1e3a5f;color:#fff;padding:8px 10px;text-align:left;font-weight:600}td{padding:7px 10px;border-bottom:1px solid #e2e8f0}tr:nth-child(even) td{background:#f8fafc}.ft{margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:9px;color:#94a3b8;text-align:center}`;

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export const ClientReportsView: React.FC<ClientReportsViewProps> = ({ onBack }) => {
  const { profile } = useAuth();

  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [clients, setClients] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduleForm>({ ...EMPTY_FORM });
  const [emailInput, setEmailInput] = useState('');

  const hasAccess = profile && ALLOWED_ROLES.includes(profile.role);

  /* ---- Data Loading ---- */

  useEffect(() => {
    if (profile?.company_id) loadAll();
  }, [profile]);

  const loadAll = async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    try {
      const [schRes, clRes, siRes] = await Promise.all([
        supabase.from('client_report_schedules').select('*')
          .eq('company_id', profile.company_id).order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, email')
          .eq('company_id', profile.company_id).eq('role', 'client').order('full_name'),
        supabase.from('sites').select('id, name')
          .eq('company_id', profile.company_id).eq('is_active', true).order('name'),
      ]);
      if (schRes.error) throw schRes.error;
      if (clRes.error) throw clRes.error;
      if (siRes.error) throw siRes.error;
      setSchedules(schRes.data || []);
      setClients(clRes.data || []);
      setSites(siRes.data || []);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load report schedules');
    } finally {
      setLoading(false);
    }
  };

  /* ---- Helpers ---- */

  const clientName = (id: string) => clients.find((c) => c.id === id)?.full_name || 'Unknown Client';
  const siteName = (id: string) => sites.find((s) => s.id === id)?.name || 'Unknown Site';

  const freqBadge = (f: string) => {
    const cls = f === 'daily' ? 'bg-blue-100 text-blue-700'
      : f === 'weekly' ? 'bg-green-100 text-green-700'
      : 'bg-amber-100 text-amber-700';
    return (
      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${cls}`}>
        {f}
      </span>
    );
  };

  /* ---- Stats ---- */

  const totalSchedules = schedules.length;
  const activeSchedules = schedules.filter((s) => s.is_active).length;
  const clientsCovered = new Set(schedules.map((s) => s.client_id)).size;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const sentThisMonth = schedules.filter((s) => s.last_sent_at && s.last_sent_at >= monthStart).length;

  /* ---- Toggle Active ---- */

  const toggleActive = async (sch: ReportSchedule) => {
    const newVal = !sch.is_active;
    const { error } = await supabase.from('client_report_schedules')
      .update({ is_active: newVal, updated_at: new Date().toISOString() }).eq('id', sch.id);
    if (error) { showToast('error', 'Failed to update schedule'); return; }
    setSchedules((prev) => prev.map((s) => (s.id === sch.id ? { ...s, is_active: newVal } : s)));
    showToast('success', newVal ? 'Schedule activated' : 'Schedule paused');
  };

  /* ---- Create / Edit ---- */

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setEmailInput('');
    setShowModal(true);
  };

  const openEdit = (s: ReportSchedule) => {
    setEditingId(s.id);
    setForm({
      client_id: s.client_id, site_ids: s.site_ids || [],
      frequency: s.frequency, day_of_week: s.day_of_week,
      include_incidents: s.include_incidents, include_patrols: s.include_patrols,
      include_attendance: s.include_attendance, include_logbook: s.include_logbook,
      email_recipients: s.email_recipients || [], is_active: s.is_active,
    });
    setEmailInput('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!profile?.company_id) return;
    if (!form.client_id) { showToast('warning', 'Please select a client'); return; }
    if (form.site_ids.length === 0) { showToast('warning', 'Please select at least one site'); return; }
    if (form.email_recipients.length === 0) { showToast('warning', 'Please add at least one email recipient'); return; }

    setSaving(true);
    try {
      const payload = {
        company_id: profile.company_id, client_id: form.client_id,
        site_ids: form.site_ids, frequency: form.frequency,
        day_of_week: form.frequency === 'weekly' ? form.day_of_week : null,
        include_incidents: form.include_incidents, include_patrols: form.include_patrols,
        include_attendance: form.include_attendance, include_logbook: form.include_logbook,
        email_recipients: form.email_recipients, is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase.from('client_report_schedules').update(payload).eq('id', editingId);
        if (error) throw error;
        showToast('success', 'Schedule updated');
      } else {
        const { error } = await supabase.from('client_report_schedules')
          .insert({ ...payload, created_at: new Date().toISOString() });
        if (error) throw error;
        showToast('success', 'Schedule created');
      }
      setShowModal(false);
      loadAll();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  /* ---- Delete ---- */

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this report schedule?')) return;
    const { error } = await supabase.from('client_report_schedules').delete().eq('id', id);
    if (error) { showToast('error', 'Failed to delete schedule'); return; }
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    showToast('success', 'Schedule deleted');
  };

  /* ---- Email Chips ---- */

  const addEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('warning', 'Invalid email address'); return; }
    if (form.email_recipients.includes(email)) { showToast('warning', 'Email already added'); return; }
    setForm((prev) => ({ ...prev, email_recipients: [...prev.email_recipients, email] }));
    setEmailInput('');
  };

  const removeEmail = (em: string) => {
    setForm((prev) => ({ ...prev, email_recipients: prev.email_recipients.filter((e) => e !== em) }));
  };

  const toggleSite = (sid: string) => {
    setForm((prev) => ({
      ...prev,
      site_ids: prev.site_ids.includes(sid) ? prev.site_ids.filter((i) => i !== sid) : [...prev.site_ids, sid],
    }));
  };

  /* ---- Preview Report ---- */

  const handlePreview = async (sch: ReportSchedule) => {
    if (!profile?.company_id) return;
    setPreviewing(true);
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 7);
      const sf = sch.site_ids || [];
      if (!sf.length) { showToast('warning', 'No sites configured for this schedule'); setPreviewing(false); return; }

      const q = (table: string, dateCol: string, sel: string, enabled: boolean) =>
        enabled
          ? supabase.from(table).select(sel).in('site_id', sf).gte(dateCol, start.toISOString()).lte(dateCol, end.toISOString())
          : Promise.resolve({ data: [] });

      const [incR, patR, attR, logR] = await Promise.all([
        q('incidents', 'created_at', 'id, title, severity, status, created_at', sch.include_incidents),
        q('check_ins', 'created_at', 'id, status, created_at', sch.include_patrols),
        q('time_clocks', 'clock_in_time', 'id, clock_in_time, clock_out_time, total_hours', sch.include_attendance),
        q('logbook_entries', 'created_at', 'id, title, entry_type, created_at', sch.include_logbook),
      ]);

      const inc = incR.data || [], pat = patR.data || [], att = attR.data || [], log = logR.data || [];
      const cn = clientName(sch.client_id);
      const siteNames = sf.map(siteName).join(', ');
      const totalHrs = att.reduce((s: number, r: any) => s + (r.total_hours || 0), 0);
      const genDate = new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

      const sumCard = (v: string | number, l: string) => `<div class="sc"><div class="v">${v}</div><div class="l">${l}</div></div>`;
      const emptyRow = (c: number) => `<tr><td colspan="${c}" style="text-align:center;color:#94a3b8;padding:16px;">No records found</td></tr>`;
      const tbl = (heads: string[], rows: string) =>
        `<table><thead><tr>${heads.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;

      let body = '<div class="sg">';
      if (sch.include_incidents) body += sumCard(inc.length, 'Incidents');
      if (sch.include_patrols) body += sumCard(pat.length, 'Patrol Check-ins');
      if (sch.include_attendance) body += sumCard(totalHrs.toFixed(1), 'Hours Worked');
      if (sch.include_logbook) body += sumCard(log.length, 'Logbook Entries');
      body += '</div>';

      if (sch.include_incidents) {
        body += '<div class="st">Incidents</div>' + tbl(['Date', 'Title', 'Severity', 'Status'],
          inc.length ? inc.map((i: any) => `<tr><td>${fmtDT(i.created_at)}</td><td>${i.title || '-'}</td><td>${i.severity || '-'}</td><td>${i.status || '-'}</td></tr>`).join('') : emptyRow(4));
      }
      if (sch.include_patrols) {
        body += '<div class="st">Patrol Check-ins</div>' + tbl(['Date', 'Status'],
          pat.length ? pat.map((p: any) => `<tr><td>${fmtDT(p.created_at)}</td><td>${p.status || '-'}</td></tr>`).join('') : emptyRow(2));
      }
      if (sch.include_attendance) {
        body += '<div class="st">Attendance Records</div>' + tbl(['Clock In', 'Clock Out', 'Hours'],
          att.length ? att.map((a: any) => `<tr><td>${fmtDT(a.clock_in_time)}</td><td>${a.clock_out_time ? fmtDT(a.clock_out_time) : 'Active'}</td><td>${a.total_hours != null ? a.total_hours.toFixed(1) : '-'}</td></tr>`).join('') : emptyRow(3));
      }
      if (sch.include_logbook) {
        body += '<div class="st">Logbook Entries</div>' + tbl(['Date', 'Type', 'Title'],
          log.length ? log.map((l: any) => `<tr><td>${fmtDT(l.created_at)}</td><td>${l.entry_type || '-'}</td><td>${l.title || '-'}</td></tr>`).join('') : emptyRow(3));
      }

      const fmtShort = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Client Report - ${cn}</title><style>${PCSS}</style></head>
<body>
  <div class="page">
    <div class="hdr">
      <div><div class="co">Client Activity Report</div><h1>${cn}</h1></div>
      <div style="text-align:right;font-size:10px;color:#64748b">
        <div>${sch.frequency} report</div><div>Generated: ${genDate}</div>
      </div>
    </div>
    <div style="background:#f1f5f9;border-radius:6px;padding:12px 16px;margin-bottom:24px;font-size:11px">
      <strong>Sites:</strong> ${siteNames}<br/><strong>Period:</strong> ${fmtShort(start)} - ${fmtShort(end)}
    </div>
    ${body}
    <div class="ft">Client Activity Report -- ${cn} -- Generated ${genDate} -- Confidential</div>
  </div>
  <div class="no-print" style="text-align:center;margin:24px">
    <button onclick="window.print()" style="background:#1e3a5f;color:#fff;border:none;padding:10px 24px;border-radius:6px;cursor:pointer;font-size:13px">Print Report</button>
  </div>
</body>
</html>`;

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        showToast('error', 'Could not open preview window. Please allow pop-ups for this site.');
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to generate preview');
    } finally {
      setPreviewing(false);
    }
  };

  /* ---- Access Guard ---- */

  if (!hasAccess) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <Shield className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-red-700 mb-1">Access Denied</h2>
          <p className="text-red-600 text-sm">
            Only Company Admins, Site Managers, and Super Admins can manage client report schedules.
          </p>
          {onBack && (
            <button onClick={onBack} className="mt-4 text-sm text-red-600 underline hover:text-red-800">
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ---- Inline sub-components ---- */

  const StatCard: React.FC<{ icon: React.ReactNode; bg: string; value: number; label: string }> = ({ icon, bg, value, label }) => (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );

  const IncludeToggle: React.FC<{ icon: React.ReactNode; label: string; field: keyof ScheduleForm }> = ({ icon, label, field }) => (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <Toggle
        enabled={form[field] as boolean}
        onToggle={() => setForm((p) => ({ ...p, [field]: !p[field] }))}
      />
    </div>
  );

  /* ---- Render ---- */

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold text-gray-900">Client Report Schedules</h1>
              <p className="text-sm text-gray-500">Configure automated reports for your clients</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Schedule
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<FileText className="w-5 h-5 text-blue-600" />} bg="bg-blue-50" value={totalSchedules} label="Total Schedules" />
          <StatCard icon={<CheckCircle className="w-5 h-5 text-green-600" />} bg="bg-green-50" value={activeSchedules} label="Active" />
          <StatCard icon={<Users className="w-5 h-5 text-purple-600" />} bg="bg-purple-50" value={clientsCovered} label="Clients Covered" />
          <StatCard icon={<Send className="w-5 h-5 text-amber-600" />} bg="bg-amber-50" value={sentThisMonth} label="Sent This Month" />
        </div>

        {/* Schedule List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : schedules.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No Report Schedules</h3>
            <p className="text-sm text-gray-500 mb-4">
              Create your first automated client report schedule to get started.
            </p>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Create Schedule
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {schedules.map((sch) => (
              <div
                key={sch.id}
                className={`bg-white border rounded-xl p-5 transition-colors ${
                  sch.is_active ? 'border-gray-200' : 'border-gray-200 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-base font-semibold text-gray-900 truncate">
                        {clientName(sch.client_id)}
                      </h3>
                      {freqBadge(sch.frequency)}
                      {!sch.is_active && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          Paused
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">
                        {(sch.site_ids || []).map(siteName).join(', ') || 'No sites'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      {sch.include_incidents && (
                        <span className="flex items-center gap-1 text-xs text-gray-600">
                          <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />Incidents
                        </span>
                      )}
                      {sch.include_patrols && (
                        <span className="flex items-center gap-1 text-xs text-gray-600">
                          <Shield className="w-3.5 h-3.5 text-blue-500" />Patrols
                        </span>
                      )}
                      {sch.include_attendance && (
                        <span className="flex items-center gap-1 text-xs text-gray-600">
                          <Clock className="w-3.5 h-3.5 text-green-500" />Attendance
                        </span>
                      )}
                      {sch.include_logbook && (
                        <span className="flex items-center gap-1 text-xs text-gray-600">
                          <BookOpen className="w-3.5 h-3.5 text-purple-500" />Logbook
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                      <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">
                        {(sch.email_recipients || []).join(', ') || 'No recipients'}
                      </span>
                    </div>

                    <p className="text-xs text-gray-400 mt-1">
                      Last sent: {fmtDT(sch.last_sent_at)}
                      {sch.frequency === 'weekly' && sch.day_of_week != null && (
                        <span className="ml-2">(every {DAYS[sch.day_of_week]})</span>
                      )}
                    </p>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handlePreview(sch)}
                      disabled={previewing}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Preview report"
                    >
                      {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => toggleActive(sch)}
                      className={`p-2 rounded-lg transition-colors ${
                        sch.is_active ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'
                      }`}
                      title={sch.is_active ? 'Pause schedule' : 'Activate schedule'}
                    >
                      {sch.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => openEdit(sch)}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit schedule"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(sch.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete schedule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? 'Edit Report Schedule' : 'New Report Schedule'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 space-y-5">
              {/* Client */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                <select
                  value={form.client_id}
                  onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.full_name} ({c.email})</option>
                  ))}
                </select>
              </div>

              {/* Sites Multi-select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sites ({form.site_ids.length} selected)
                </label>
                <div className="border border-gray-300 rounded-lg max-h-40 overflow-y-auto">
                  {sites.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-gray-400">No active sites</p>
                  ) : (
                    sites.map((site) => (
                      <label key={site.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={form.site_ids.includes(site.id)}
                          onChange={() => toggleSite(site.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        {site.name}
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                <select
                  value={form.frequency}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      frequency: e.target.value as ScheduleForm['frequency'],
                      day_of_week: e.target.value === 'weekly' ? (p.day_of_week ?? 1) : null,
                    }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {/* Day of Week (weekly only) */}
              {form.frequency === 'weekly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
                  <select
                    value={form.day_of_week ?? 1}
                    onChange={(e) => setForm((p) => ({ ...p, day_of_week: parseInt(e.target.value, 10) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {DAYS.map((label, idx) => (
                      <option key={idx} value={idx}>{label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Include Sections */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Include in Report</label>
                <div className="space-y-3">
                  <IncludeToggle icon={<AlertTriangle className="w-4 h-4 text-orange-500" />} label="Incidents" field="include_incidents" />
                  <IncludeToggle icon={<Shield className="w-4 h-4 text-blue-500" />} label="Patrols" field="include_patrols" />
                  <IncludeToggle icon={<Clock className="w-4 h-4 text-green-500" />} label="Attendance" field="include_attendance" />
                  <IncludeToggle icon={<BookOpen className="w-4 h-4 text-purple-500" />} label="Logbook" field="include_logbook" />
                </div>
              </div>

              {/* Email Recipients */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Recipients</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail(); } }}
                    placeholder="Enter email address..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={addEmail}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    Add
                  </button>
                </div>
                {form.email_recipients.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.email_recipients.map((em) => (
                      <span key={em} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                        <Mail className="w-3 h-3" />
                        {em}
                        <button type="button" onClick={() => removeEmail(em)} className="ml-0.5 hover:text-red-600 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-700">Active</p>
                  <p className="text-xs text-gray-500">Enable or disable this schedule</p>
                </div>
                <Toggle enabled={form.is_active} onToggle={() => setForm((p) => ({ ...p, is_active: !p.is_active }))} />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingId ? 'Update Schedule' : 'Create Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
