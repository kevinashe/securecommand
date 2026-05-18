import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/toast';
import {
  ArrowLeft, FileText, AlertTriangle, BookOpen, Clock, Download,
  Eye, Loader2, Calendar, Building2, Image, BarChart3, Shield,
} from 'lucide-react';

type ReportType = 'shift' | 'incident' | 'guard_activity' | 'site' | 'attendance';

interface ReportConfig {
  startDate: string;
  endDate: string;
  siteId: string;
  guardId: string;
  includePhotos: boolean;
}

interface ReportGeneratorViewProps {
  onBack?: () => void;
}

const REPORT_TYPES: { key: ReportType; label: string; desc: string; icon: React.ReactNode }[] = [
  { key: 'shift', label: 'Shift Report', desc: 'Shifts for a date range with guard and site details', icon: <Calendar className="w-6 h-6" /> },
  { key: 'incident', label: 'Incident Report', desc: 'Incidents logged within a date range', icon: <AlertTriangle className="w-6 h-6" /> },
  { key: 'guard_activity', label: 'Guard Activity Report', desc: 'Logbook entries for a specific guard', icon: <BookOpen className="w-6 h-6" /> },
  { key: 'site', label: 'Site Report', desc: 'All activity at a specific site', icon: <Building2 className="w-6 h-6" /> },
  { key: 'attendance', label: 'Attendance Report', desc: 'Time clock data and hours worked', icon: <Clock className="w-6 h-6" /> },
];

const ALLOWED_ROLES = ['company_admin', 'site_manager', 'super_admin', 'finance_officer'];

const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
const fmtDT = (s: string) => s ? new Date(s).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
const dateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => dateStr(new Date());
const ago30 = () => { const d = new Date(); d.setDate(d.getDate() - 30); return dateStr(d); };

const PRINT_CSS = `
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #1a1a1a; font-size: 11px; line-height: 1.5;
  }
  .page { padding: 32px; max-width: 900px; margin: 0 auto; }
  .hdr {
    border-bottom: 3px solid #1e3a5f; padding-bottom: 16px; margin-bottom: 24px;
    display: flex; justify-content: space-between; align-items: flex-end;
  }
  .hdr h1 { font-size: 22px; color: #1e3a5f; font-weight: 700; }
  .hdr .co { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
  .meta {
    background: #f1f5f9; border-radius: 6px; padding: 12px 16px;
    margin-bottom: 24px; font-size: 11px; display: flex; flex-wrap: wrap; gap: 16px;
  }
  .ml { font-weight: 600; color: #475569; }
  .mv { color: #1e293b; }
  .st {
    font-size: 14px; font-weight: 700; color: #1e3a5f;
    margin: 24px 0 10px; padding-bottom: 4px; border-bottom: 1px solid #cbd5e1;
  }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10px; }
  th { background: #1e3a5f; color: #fff; padding: 8px 10px; text-align: left; font-weight: 600; }
  td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  .b {
    display: inline-block; padding: 2px 8px; border-radius: 9999px;
    font-size: 9px; font-weight: 600; text-transform: uppercase;
  }
  .bg { background: #dcfce7; color: #166534; }
  .ba { background: #fef3c7; color: #92400e; }
  .br { background: #fee2e2; color: #991b1b; }
  .bb { background: #dbeafe; color: #1e40af; }
  .bx { background: #f1f5f9; color: #475569; }
  .sg {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px; margin-bottom: 24px;
  }
  .sc {
    background: #f8fafc; border: 1px solid #e2e8f0;
    border-radius: 8px; padding: 14px 16px; text-align: center;
  }
  .sc .v { font-size: 24px; font-weight: 700; color: #1e3a5f; }
  .sc .l { font-size: 10px; color: #64748b; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
  .ft {
    margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0;
    font-size: 9px; color: #94a3b8; text-align: center;
  }
  .pb { page-break-before: always; }
`;

export const ReportGeneratorView: React.FC<ReportGeneratorViewProps> = ({ onBack }) => {
  const { profile } = useAuth();

  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [config, setConfig] = useState<ReportConfig>({
    startDate: ago30(),
    endDate: today(),
    siteId: '',
    guardId: '',
    includePhotos: false,
  });
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [guards, setGuards] = useState<{ id: string; full_name: string }[]>([]);
  const [reportData, setReportData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [previewing, setPreviewing] = useState(false);

  const hasAccess = profile && ALLOWED_ROLES.includes(profile.role);

  useEffect(() => {
    if (profile?.company_id) loadFilterOptions();
  }, [profile]);

  const loadFilterOptions = async () => {
    if (!profile?.company_id) return;
    setLoadingFilters(true);
    try {
      const [sRes, gRes] = await Promise.all([
        supabase
          .from('sites')
          .select('id, name')
          .eq('company_id', profile.company_id)
          .order('name'),
        supabase
          .from('profiles')
          .select('id, full_name')
          .eq('company_id', profile.company_id)
          .eq('role', 'security_officer')
          .order('full_name'),
      ]);
      if (sRes.data) setSites(sRes.data);
      if (gRes.data) setGuards(gRes.data);
    } catch {
      showToast('error', 'Failed to load filter options');
    } finally {
      setLoadingFilters(false);
    }
  };

  const fetchReportData = async () => {
    if (!profile?.company_id || !selectedType) return;
    setLoading(true);
    setReportData(null);
    const endTs = config.endDate + 'T23:59:59';
    try {
      let data: any[] = [];
      switch (selectedType) {
        case 'shift': {
          let q = supabase
            .from('shifts')
            .select('*, site:sites(name), guard:profiles(full_name)')
            .gte('start_time', config.startDate)
            .lte('start_time', endTs);
          if (config.siteId) q = q.eq('site_id', config.siteId);
          if (config.guardId) q = q.eq('guard_id', config.guardId);
          const r = await q.order('start_time', { ascending: false });
          if (r.error) throw r.error;
          data = r.data || [];
          break;
        }

        case 'incident': {
          let q = supabase
            .from('incidents')
            .select('*, site:sites(name), reporter:profiles(full_name)')
            .gte('created_at', config.startDate)
            .lte('created_at', endTs);
          if (config.siteId) q = q.eq('site_id', config.siteId);
          const r = await q.order('created_at', { ascending: false });
          if (r.error) throw r.error;
          data = r.data || [];
          break;
        }

        case 'guard_activity': {
          let q = supabase
            .from('logbook_entries')
            .select('*')
            .gte('created_at', config.startDate)
            .lte('created_at', endTs);
          if (config.guardId) q = q.eq('guard_id', config.guardId);
          if (config.siteId) q = q.eq('site_id', config.siteId);
          const r = await q.order('created_at', { ascending: false });
          if (r.error) throw r.error;

          const gIds = [...new Set((r.data || []).map((e: any) => e.guard_id))];
          const sIds = [...new Set((r.data || []).map((e: any) => e.site_id).filter(Boolean))];
          const [gR, sR] = await Promise.all([
            gIds.length
              ? supabase.from('profiles').select('id, full_name').in('id', gIds)
              : Promise.resolve({ data: [] }),
            sIds.length
              ? supabase.from('sites').select('id, name').in('id', sIds)
              : Promise.resolve({ data: [] }),
          ]);

          const gm: Record<string, string> = {};
          (gR.data || []).forEach((g: any) => { gm[g.id] = g.full_name; });
          const sm: Record<string, string> = {};
          (sR.data || []).forEach((s: any) => { sm[s.id] = s.name; });

          data = (r.data || []).map((e: any) => ({
            ...e,
            guard_name: gm[e.guard_id] || 'Unknown',
            site_name: e.site_id ? sm[e.site_id] || 'Unknown' : '-',
          }));
          break;
        }

        case 'site': {
          if (!config.siteId) {
            showToast('warning', 'Please select a site for the Site Report');
            setLoading(false);
            return;
          }
          const [sR, iR, lR] = await Promise.all([
            supabase.from('shifts').select('*, guard:profiles(full_name)')
              .eq('site_id', config.siteId)
              .gte('start_time', config.startDate).lte('start_time', endTs)
              .order('start_time', { ascending: false }),
            supabase.from('incidents').select('*, reporter:profiles(full_name)')
              .eq('site_id', config.siteId)
              .gte('created_at', config.startDate).lte('created_at', endTs)
              .order('created_at', { ascending: false }),
            supabase.from('logbook_entries').select('*')
              .eq('site_id', config.siteId)
              .gte('created_at', config.startDate).lte('created_at', endTs)
              .order('created_at', { ascending: false }),
          ]);
          data = [
            { section: 'shifts', items: sR.data || [] },
            { section: 'incidents', items: iR.data || [] },
            { section: 'logbook', items: lR.data || [] },
          ];
          break;
        }

        case 'attendance': {
          let q = supabase
            .from('time_clocks')
            .select('*, guard:profiles(full_name)')
            .gte('clock_in_time', config.startDate)
            .lte('clock_in_time', endTs);
          if (config.guardId) q = q.eq('guard_id', config.guardId);
          const r = await q.order('clock_in_time', { ascending: false });
          if (r.error) throw r.error;
          data = r.data || [];
          break;
        }
      }
      setReportData(data);
      setPreviewing(true);
    } catch (err: any) {
      showToast('error', err.message || 'Failed to fetch report data');
    } finally {
      setLoading(false);
    }
  };

  const reportLabel = REPORT_TYPES.find((r) => r.key === selectedType)?.label || 'Report';
  const siteName = sites.find((s) => s.id === config.siteId)?.name || 'All Sites';
  const guardName = guards.find((g) => g.id === config.guardId)?.full_name || 'All Guards';

  const sevBadge = (s: string) => { const m: Record<string, string> = { low: 'bb', medium: 'ba', high: 'br', critical: 'br' }; return `<span class="b ${m[s] || 'bx'}">${s}</span>`; };
  const stsBadge = (s: string) => { const m: Record<string, string> = { completed: 'bg', scheduled: 'bb', in_progress: 'ba', cancelled: 'bx', active: 'bg', resolved: 'bg' }; return `<span class="b ${m[s] || 'bx'}">${s}</span>`; };
  const sumCard = (v: string | number, l: string) => `<div class="sc"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  const emptyRow = (cols: number) => `<tr><td colspan="${cols}" style="text-align:center;color:#94a3b8;">No records found</td></tr>`;

  const buildPrintHTML = (): string => {
    if (!reportData || !selectedType) return '';
    const co = 'Security Operations';
    const now = new Date().toLocaleString();

    const hdr = `
      <div class="hdr">
        <div>
          <div class="co">${co}</div>
          <h1>${reportLabel}</h1>
        </div>
        <div style="text-align:right;font-size:10px;color:#64748b;">
          <div>Generated: ${now}</div>
          <div>By: ${profile?.full_name || 'Admin'}</div>
        </div>
      </div>`;

    const meta = `
      <div class="meta">
        <span class="ml">Period:</span>
        <span class="mv">${fmtDate(config.startDate)} - ${fmtDate(config.endDate)}</span>
        ${config.siteId ? `<span class="ml">Site:</span><span class="mv">${siteName}</span>` : ''}
        ${config.guardId ? `<span class="ml">Guard:</span><span class="mv">${guardName}</span>` : ''}
      </div>`;

    let body = '';
    switch (selectedType) {
      case 'shift': {
        const comp = reportData.filter((s: any) => s.status === 'completed').length;
        const sched = reportData.filter((s: any) => s.status === 'scheduled').length;
        body = `
          <div class="sg">${sumCard(reportData.length, 'Total Shifts')}${sumCard(comp, 'Completed')}${sumCard(sched, 'Scheduled')}</div>
          <table>
            <thead><tr><th>Date</th><th>Guard</th><th>Site</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
            <tbody>${reportData.map((s: any) => `<tr>
              <td>${fmtDate(s.start_time)}</td><td>${s.guard?.full_name || '-'}</td>
              <td>${s.site?.name || '-'}</td><td>${fmtDT(s.start_time)}</td>
              <td>${s.end_time ? fmtDT(s.end_time) : '-'}</td><td>${stsBadge(s.status || 'scheduled')}</td>
            </tr>`).join('')}</tbody>
          </table>`;
        break;
      }

      case 'incident': {
        const crit = reportData.filter((i: any) => i.severity === 'critical').length;
        const high = reportData.filter((i: any) => i.severity === 'high').length;
        body = `
          <div class="sg">${sumCard(reportData.length, 'Total Incidents')}${sumCard(crit, 'Critical')}${sumCard(high, 'High Severity')}</div>
          <table>
            <thead><tr><th>Date</th><th>Title</th><th>Site</th><th>Reporter</th><th>Severity</th><th>Status</th></tr></thead>
            <tbody>${reportData.map((i: any) => `<tr>
              <td>${fmtDT(i.created_at)}</td><td>${i.title || '-'}</td>
              <td>${i.site?.name || '-'}</td><td>${i.reporter?.full_name || '-'}</td>
              <td>${sevBadge(i.severity || 'medium')}</td><td>${stsBadge(i.status || 'active')}</td>
            </tr>`).join('')}</tbody>
          </table>`;
        break;
      }

      case 'guard_activity': {
        const ug = new Set(reportData.map((e: any) => e.guard_id)).size;
        const priBadge = (p: string) => `<span class="b ${p === 'urgent' ? 'br' : p === 'important' ? 'ba' : 'bx'}">${p || 'normal'}</span>`;
        body = `
          <div class="sg">${sumCard(reportData.length, 'Total Entries')}${sumCard(ug, 'Guards Involved')}</div>
          <table>
            <thead><tr><th>Date</th><th>Guard</th><th>Site</th><th>Type</th><th>Title</th><th>Priority</th></tr></thead>
            <tbody>${reportData.map((e: any) => `<tr>
              <td>${fmtDT(e.created_at)}</td><td>${e.guard_name || '-'}</td>
              <td>${e.site_name || '-'}</td><td>${e.entry_type || '-'}</td>
              <td>${e.title || '-'}</td><td>${priBadge(e.priority)}</td>
            </tr>`).join('')}</tbody>
          </table>`;
        break;
      }

      case 'site': {
        const sh = reportData.find((s: any) => s.section === 'shifts')?.items || [];
        const inc = reportData.find((s: any) => s.section === 'incidents')?.items || [];
        const lb = reportData.find((s: any) => s.section === 'logbook')?.items || [];
        body = `
          <div class="sg">${sumCard(sh.length, 'Shifts')}${sumCard(inc.length, 'Incidents')}${sumCard(lb.length, 'Logbook Entries')}</div>

          <div class="st">Shifts</div>
          <table>
            <thead><tr><th>Date</th><th>Guard</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
            <tbody>${sh.length === 0 ? emptyRow(5) : sh.map((s: any) => `<tr>
              <td>${fmtDate(s.start_time)}</td><td>${s.guard?.full_name || '-'}</td>
              <td>${fmtDT(s.start_time)}</td><td>${s.end_time ? fmtDT(s.end_time) : '-'}</td>
              <td>${stsBadge(s.status || 'scheduled')}</td>
            </tr>`).join('')}</tbody>
          </table>

          <div class="pb"></div>
          <div class="st">Incidents</div>
          <table>
            <thead><tr><th>Date</th><th>Title</th><th>Reporter</th><th>Severity</th><th>Status</th></tr></thead>
            <tbody>${inc.length === 0 ? emptyRow(5) : inc.map((i: any) => `<tr>
              <td>${fmtDT(i.created_at)}</td><td>${i.title || '-'}</td>
              <td>${i.reporter?.full_name || '-'}</td><td>${sevBadge(i.severity || 'medium')}</td>
              <td>${stsBadge(i.status || 'active')}</td>
            </tr>`).join('')}</tbody>
          </table>

          <div class="st">Logbook Entries</div>
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Title</th><th>Description</th></tr></thead>
            <tbody>${lb.length === 0 ? emptyRow(4) : lb.map((e: any) => {
              const desc = e.description || '-';
              return `<tr>
                <td>${fmtDT(e.created_at)}</td><td>${e.entry_type || '-'}</td>
                <td>${e.title || '-'}</td><td>${desc.substring(0, 80)}${desc.length > 80 ? '...' : ''}</td>
              </tr>`;
            }).join('')}</tbody>
          </table>`;
        break;
      }

      case 'attendance': {
        const totH = reportData.reduce((s: number, t: any) => s + (t.total_hours || 0), 0);
        const otH = reportData.reduce((s: number, t: any) => s + (t.overtime_hours || 0), 0);
        body = `
          <div class="sg">${sumCard(reportData.length, 'Clock Entries')}${sumCard(totH.toFixed(1), 'Total Hours')}${sumCard(otH.toFixed(1), 'Overtime Hours')}</div>
          <table>
            <thead><tr><th>Guard</th><th>Clock In</th><th>Clock Out</th><th>Hours</th><th>Overtime</th><th>Geofence</th></tr></thead>
            <tbody>${reportData.map((t: any) => `<tr>
              <td>${t.guard?.full_name || '-'}</td><td>${fmtDT(t.clock_in_time)}</td>
              <td>${t.clock_out_time ? fmtDT(t.clock_out_time) : 'Active'}</td>
              <td>${t.total_hours != null ? t.total_hours.toFixed(1) : '-'}</td>
              <td>${t.overtime_hours != null ? t.overtime_hours.toFixed(1) : '0'}</td>
              <td><span class="b ${t.is_within_geofence ? 'bg' : 'br'}">${t.is_within_geofence ? 'Yes' : 'No'}</span></td>
            </tr>`).join('')}</tbody>
          </table>`;
        break;
      }
    }

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>${reportLabel} - ${co}</title><style>${PRINT_CSS}</style></head>
<body>
  <div class="page">
    ${hdr}
    ${meta}
    ${body}
    <div class="ft">${co} -- ${reportLabel} -- Generated ${now} -- Confidential</div>
  </div>
</body>
</html>`;
  };

  const handleGeneratePDF = () => {
    if (!reportData) {
      showToast('warning', 'Please preview the report first');
      return;
    }

    const html = buildPrintHTML();
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast('error', 'Could not open print window. Please allow pop-ups for this site.');
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  const badgeCls = (type: string, value: string) => {
    if (type === 'status') {
      return value === 'completed' ? 'bg-green-100 text-green-700' : value === 'in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700';
    }
    if (type === 'severity') {
      return value === 'critical' || value === 'high' ? 'bg-red-100 text-red-700' : value === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700';
    }
    return 'bg-gray-100 text-gray-700';
  };

  const PreviewTable = ({ cols, rows }: { cols: string[]; rows: (string | React.ReactNode)[][] }) => (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-100 text-left">
          {cols.map((c) => (
            <th key={c} className="px-3 py-2 font-semibold text-gray-700">{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
            {row.map((cell, j) => (
              <td key={j} className="px-3 py-2 text-gray-800">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  const Badge = ({ value, type }: { value: string; type: string }) => (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badgeCls(type, value)}`}>
      {value}
    </span>
  );

  const renderPreview = () => {
    if (!reportData || !selectedType) return null;

    switch (selectedType) {
      case 'shift':
        return (
          <PreviewTable
            cols={['Date', 'Guard', 'Site', 'Status']}
            rows={reportData.map((s: any) => [
              fmtDate(s.start_time),
              s.guard?.full_name || '-',
              s.site?.name || '-',
              <Badge value={s.status || 'scheduled'} type="status" />,
            ])}
          />
        );

      case 'incident':
        return (
          <PreviewTable
            cols={['Date', 'Title', 'Site', 'Severity']}
            rows={reportData.map((i: any) => [
              fmtDate(i.created_at),
              i.title || '-',
              i.site?.name || '-',
              <Badge value={i.severity || 'medium'} type="severity" />,
            ])}
          />
        );

      case 'guard_activity':
        return (
          <PreviewTable
            cols={['Date', 'Guard', 'Type', 'Title']}
            rows={reportData.map((e: any) => [
              fmtDate(e.created_at),
              e.guard_name || '-',
              e.entry_type || '-',
              e.title || '-',
            ])}
          />
        );

      case 'site': {
        const sh = reportData.find((s: any) => s.section === 'shifts')?.items || [];
        const inc = reportData.find((s: any) => s.section === 'incidents')?.items || [];
        const lb = reportData.find((s: any) => s.section === 'logbook')?.items || [];
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-blue-700">{sh.length}</div>
                <div className="text-xs text-blue-600">Shifts</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-red-700">{inc.length}</div>
                <div className="text-xs text-red-600">Incidents</div>
              </div>
              <div className="bg-teal-50 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-teal-700">{lb.length}</div>
                <div className="text-xs text-teal-600">Log Entries</div>
              </div>
            </div>
            <p className="text-sm text-gray-600 text-center">
              {sh.length + inc.length + lb.length} total records found for this site.
            </p>
          </div>
        );
      }

      case 'attendance':
        return (
          <PreviewTable
            cols={['Guard', 'Clock In', 'Clock Out', 'Hours']}
            rows={reportData.map((t: any) => [
              t.guard?.full_name || '-',
              fmtDT(t.clock_in_time),
              t.clock_out_time ? fmtDT(t.clock_out_time) : 'Active',
              t.total_hours != null ? t.total_hours.toFixed(1) : '-',
            ])}
          />
        );

      default:
        return null;
    }
  };

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md text-center">
          <Shield className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">You do not have permission to generate reports. Contact your administrator for access.</p>
          {onBack && (
            <button onClick={onBack} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">Go Back</button>
          )}
        </div>
      </div>
    );
  }

  const showSiteFilter = selectedType === 'shift' || selectedType === 'incident' || selectedType === 'guard_activity' || selectedType === 'site';
  const showGuardFilter = selectedType === 'shift' || selectedType === 'guard_activity' || selectedType === 'attendance';
  const showPhotosToggle = selectedType === 'incident' || selectedType === 'guard_activity';
  const recordCount = selectedType === 'site' && reportData
    ? reportData.reduce((s: number, x: any) => s + (x.items?.length || 0), 0)
    : reportData?.length || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          )}
          <BarChart3 className="w-5 h-5 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Report Generator</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 space-y-6">
        {/* Step 1: Report Type Selection */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">1. Select Report Type</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {REPORT_TYPES.map((rt) => (
              <button
                key={rt.key}
                onClick={() => { setSelectedType(rt.key); setReportData(null); setPreviewing(false); }}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                  selectedType === rt.key ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`mt-0.5 ${selectedType === rt.key ? 'text-blue-600' : 'text-gray-400'}`}>{rt.icon}</div>
                <div>
                  <div className={`font-medium ${selectedType === rt.key ? 'text-blue-900' : 'text-gray-800'}`}>{rt.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{rt.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Configuration */}
        {selectedType && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">2. Configure Filters</h2>
            {loadingFilters ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" />
                <span className="text-sm text-gray-500">Loading filter options...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" value={config.startDate} onChange={(e) => setConfig((c) => ({ ...c, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" value={config.endDate} onChange={(e) => setConfig((c) => ({ ...c, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" />
                </div>
                {showSiteFilter && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Site {selectedType === 'site' ? '(required)' : '(optional)'}</label>
                    <select value={config.siteId} onChange={(e) => setConfig((c) => ({ ...c, siteId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white">
                      <option value="">All Sites</option>
                      {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                {showGuardFilter && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Guard (optional)</label>
                    <select value={config.guardId} onChange={(e) => setConfig((c) => ({ ...c, guardId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white">
                      <option value="">All Guards</option>
                      {guards.map((g) => <option key={g.id} value={g.id}>{g.full_name}</option>)}
                    </select>
                  </div>
                )}
                {showPhotosToggle && (
                  <div className="flex items-center gap-3 sm:col-span-2">
                    <button type="button" onClick={() => setConfig((c) => ({ ...c, includePhotos: !c.includePhotos }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.includePhotos ? 'bg-blue-600' : 'bg-gray-300'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.includePhotos ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <div className="flex items-center gap-1.5 text-sm text-gray-700">
                      <Image className="w-4 h-4 text-gray-400" />
                      Include photos in report
                    </div>
                  </div>
                )}
                <div className="sm:col-span-2 pt-2">
                  <button onClick={fetchReportData} disabled={loading}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Fetching Data...</> : <><Eye className="w-4 h-4" />Preview Report</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Preview */}
        {previewing && reportData && (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">3. Preview</h2>
              <span className="text-xs text-gray-400">{recordCount} records</span>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg shadow-inner overflow-hidden">
              <div className="bg-slate-700 text-white px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-300 uppercase tracking-wider">Security Operations</div>
                  <div className="text-sm font-semibold">{reportLabel}</div>
                </div>
                <div className="text-right text-xs text-slate-300">{fmtDate(config.startDate)} - {fmtDate(config.endDate)}</div>
              </div>
              <div className="p-4 max-h-96 overflow-auto">
                {selectedType !== 'site' && reportData.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm">No records found for the selected filters.</div>
                )}
                {renderPreview()}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button onClick={handleGeneratePDF}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                <Download className="w-4 h-4" />Generate PDF
              </button>
              <span className="text-xs text-gray-400">Opens print dialog -- save as PDF from your browser</span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!selectedType && (
          <div className="text-center py-12">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Select a report type above to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};
