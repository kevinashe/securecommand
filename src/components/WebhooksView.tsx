import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/toast';
import { ArrowLeft, Webhook, Plus, CreditCard as Edit2, Trash2, Send, ChevronDown, ChevronUp, Copy, RefreshCw, Shield, Activity, AlertTriangle, CheckCircle, XCircle, Clock, Eye, EyeOff, FileText, Zap, BookOpen, X, ToggleLeft, ToggleRight } from 'lucide-react';

// -- Constants ----------------------------------------------------------------

const EVENT_TYPES = [
  'shift.created', 'shift.updated', 'shift.completed',
  'incident.created', 'incident.updated', 'incident.resolved',
  'clock_in', 'clock_out',
  'check_in.completed',
  'visitor.checked_in', 'visitor.checked_out',
  'invoice.created', 'invoice.paid',
  'sos.activated', 'sos.resolved',
  'guard.created', 'guard.deactivated',
] as const;

type EventType = (typeof EVENT_TYPES)[number];

interface EventCategory {
  label: string;
  color: string;
  events: EventType[];
}

const EVENT_CATEGORIES: EventCategory[] = [
  { label: 'Shifts', color: 'bg-blue-100 text-blue-800', events: ['shift.created', 'shift.updated', 'shift.completed'] },
  { label: 'Incidents', color: 'bg-red-100 text-red-800', events: ['incident.created', 'incident.updated', 'incident.resolved'] },
  { label: 'Time & Attendance', color: 'bg-green-100 text-green-800', events: ['clock_in', 'clock_out'] },
  { label: 'Check-Ins', color: 'bg-teal-100 text-teal-800', events: ['check_in.completed'] },
  { label: 'Visitors', color: 'bg-purple-100 text-purple-800', events: ['visitor.checked_in', 'visitor.checked_out'] },
  { label: 'Invoicing', color: 'bg-yellow-100 text-yellow-800', events: ['invoice.created', 'invoice.paid'] },
  { label: 'SOS', color: 'bg-orange-100 text-orange-800', events: ['sos.activated', 'sos.resolved'] },
  { label: 'Guards', color: 'bg-indigo-100 text-indigo-800', events: ['guard.created', 'guard.deactivated'] },
];

function categoryColorFor(event: string): string {
  for (const cat of EVENT_CATEGORIES) {
    if ((cat.events as readonly string[]).includes(event)) return cat.color;
  }
  return 'bg-gray-100 text-gray-700';
}

// -- Types --------------------------------------------------------------------

interface IntegrationWebhook {
  id: string;
  company_id: string;
  name: string;
  url: string;
  secret: string | null;
  events: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  last_status_code: number | null;
  failure_count: number;
  created_at: string;
  updated_at: string;
}

interface DeliveryLog {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  response_status: number | null;
  response_body: string | null;
  delivered_at: string;
  success: boolean;
}

interface WebhooksViewProps {
  onBack?: () => void;
}

// -- Helpers ------------------------------------------------------------------

function generateSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function truncateUrl(url: string, max = 50): string {
  return url.length > max ? url.slice(0, max) + '...' : url;
}

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

function statusBadge(code: number | null) {
  if (code === null) return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500 font-mono">--</span>;
  const color = code >= 200 && code < 300 ? 'bg-green-100 text-green-700' : code >= 400 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700';
  return <span className={`px-2 py-0.5 text-xs rounded-full font-mono ${color}`}>{code}</span>;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// -- Component ----------------------------------------------------------------

export const WebhooksView: React.FC<WebhooksViewProps> = ({ onBack }) => {
  const { profile } = useAuth();

  const [webhooks, setWebhooks] = useState<IntegrationWebhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<IntegrationWebhook | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [expandedPayload, setExpandedPayload] = useState<string | null>(null);
  const [showDocs, setShowDocs] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [todayDeliveries, setTodayDeliveries] = useState(0);

  // Form state
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formSecret, setFormSecret] = useState('');
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [formActive, setFormActive] = useState(true);

  // Access control
  const isAuthorized = profile?.role === 'company_admin' || profile?.role === 'super_admin';

  // -- Data fetching -----------------------------------------------------------

  const fetchWebhooks = async () => {
    if (!profile?.company_id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('integration_webhooks').select('*')
      .eq('company_id', profile.company_id).order('created_at', { ascending: false });
    if (error) showToast('error', 'Failed to load webhooks');
    else setWebhooks(data || []);
    setLoading(false);
  };

  const fetchTodayDeliveries = async () => {
    if (!profile?.company_id) return;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('webhook_delivery_logs').select('id', { count: 'exact', head: true })
      .in('webhook_id', webhooks.map((w) => w.id))
      .gte('delivered_at', start.toISOString());
    setTodayDeliveries(count || 0);
  };

  const fetchLogs = async (webhookId: string) => {
    setLogsLoading(true);
    const { data, error } = await supabase
      .from('webhook_delivery_logs').select('*')
      .eq('webhook_id', webhookId).order('delivered_at', { ascending: false }).limit(20);
    if (error) showToast('error', 'Failed to load delivery logs');
    else setLogs(data || []);
    setLogsLoading(false);
  };

  useEffect(() => { if (isAuthorized) fetchWebhooks(); }, [profile?.company_id]);
  useEffect(() => { if (webhooks.length > 0) fetchTodayDeliveries(); }, [webhooks]);

  // -- Actions -----------------------------------------------------------------

  const openCreateModal = () => {
    setEditingWebhook(null);
    setFormName('');
    setFormUrl('');
    setFormSecret('');
    setFormEvents([]);
    setFormActive(true);
    setShowSecret(false);
    setShowModal(true);
  };

  const openEditModal = (wh: IntegrationWebhook) => {
    setEditingWebhook(wh);
    setFormName(wh.name);
    setFormUrl(wh.url);
    setFormSecret(wh.secret || '');
    setFormEvents([...wh.events]);
    setFormActive(wh.is_active);
    setShowSecret(false);
    setShowModal(true);
  };

  const toggleEvent = (evt: string) => {
    setFormEvents((prev) => (prev.includes(evt) ? prev.filter((e) => e !== evt) : [...prev, evt]));
  };

  const toggleCategoryEvents = (events: EventType[]) => {
    const allSelected = events.every((e) => formEvents.includes(e));
    if (allSelected) {
      setFormEvents((prev) => prev.filter((e) => !(events as readonly string[]).includes(e)));
    } else {
      setFormEvents((prev) => [...new Set([...prev, ...events])]);
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) { showToast('error', 'Name is required'); return; }
    if (!formUrl.trim() || !isValidUrl(formUrl.trim())) { showToast('error', 'A valid URL is required'); return; }
    if (formEvents.length === 0) { showToast('error', 'Select at least one event'); return; }

    setSaving(true);
    const payload = { company_id: profile!.company_id, name: formName.trim(), url: formUrl.trim(), secret: formSecret.trim() || null, events: formEvents, is_active: formActive };
    if (editingWebhook) {
      const { error } = await supabase.from('integration_webhooks').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingWebhook.id);
      if (error) showToast('error', 'Failed to update webhook');
      else { showToast('success', 'Webhook updated'); setShowModal(false); fetchWebhooks(); }
    } else {
      const { error } = await supabase.from('integration_webhooks').insert(payload);
      if (error) showToast('error', 'Failed to create webhook');
      else { showToast('success', 'Webhook created'); setShowModal(false); fetchWebhooks(); }
    }
    setSaving(false);
  };

  const handleDelete = async (wh: IntegrationWebhook) => {
    if (!confirm(`Delete webhook "${wh.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('integration_webhooks').delete().eq('id', wh.id);
    if (error) showToast('error', 'Failed to delete webhook');
    else { showToast('success', 'Webhook deleted'); fetchWebhooks(); }
  };

  const handleTest = async (wh: IntegrationWebhook) => {
    setTesting(wh.id);
    const testPayload = { event: 'test', timestamp: new Date().toISOString(), data: { message: 'Test webhook from SecureCommand' } };
    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let success = false;
    try {
      const res = await fetch(wh.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(testPayload) });
      responseStatus = res.status; responseBody = await res.text(); success = res.ok;
    } catch {
      responseBody = 'Request failed -- this may be due to CORS restrictions. The webhook endpoint may still have received the request.';
    }
    await supabase.from('webhook_delivery_logs').insert({ webhook_id: wh.id, event_type: 'test', payload: testPayload, response_status: responseStatus, response_body: responseBody, delivered_at: new Date().toISOString(), success });
    if (success) showToast('success', `Test delivered -- status ${responseStatus}`);
    else showToast('warning', responseStatus ? `Test returned status ${responseStatus}` : 'Test request failed (possibly CORS). Check server logs.');
    setTesting(null);
    fetchWebhooks();
  };

  const toggleLogs = (webhookId: string) => {
    if (expandedLogs === webhookId) {
      setExpandedLogs(null);
      setLogs([]);
    } else {
      setExpandedLogs(webhookId);
      fetchLogs(webhookId);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('success', 'Copied to clipboard');
  };

  // -- Access guard ------------------------------------------------------------

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Access restricted to administrators.</p>
        </div>
      </div>
    );
  }

  // -- Stats -------------------------------------------------------------------

  const totalWebhooks = webhooks.length;
  const activeWebhooks = webhooks.filter((w) => w.is_active).length;
  const failedWebhooks = webhooks.filter((w) => w.failure_count > 0).length;

  const stats = [
    { label: 'Total Webhooks', value: totalWebhooks, icon: Webhook, color: 'text-blue-600 bg-blue-50' },
    { label: 'Active', value: activeWebhooks, icon: Activity, color: 'text-green-600 bg-green-50' },
    { label: 'Failing', value: failedWebhooks, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
    { label: 'Deliveries Today', value: todayDeliveries, icon: Zap, color: 'text-purple-600 bg-purple-50' },
  ];

  // -- Render ------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Integration Webhooks</h1>
            <p className="text-sm text-gray-500 mt-0.5">Send real-time event data to external systems</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowDocs(!showDocs)} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <BookOpen className="w-4 h-4" />
            Docs
          </button>
          <button onClick={openCreateModal} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" />
            Add Webhook
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Documentation Panel */}
      {showDocs && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Webhook Documentation</h2>
            <button onClick={() => setShowDocs(false)} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <div className="p-5 space-y-5 text-sm text-gray-700">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Payload Format</h3>
              <p className="mb-2">Every webhook delivery sends a JSON POST request with the following structure:</p>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto font-mono text-xs leading-relaxed">
{`{
  "event": "shift.created",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "data": {
    "id": "uuid",
    "...": "event-specific fields"
  }
}`}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">HMAC Signature Verification</h3>
              <p className="mb-2">
                If a signing secret is configured, each request includes an <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-xs">X-Webhook-Signature</code> header
                containing an HMAC-SHA256 hex digest of the raw request body using your secret as the key.
              </p>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto font-mono text-xs leading-relaxed">
{`// Node.js verification example
const crypto = require('crypto');
const signature = req.headers['x-webhook-signature'];
const expected = crypto
  .createHmac('sha256', YOUR_SECRET)
  .update(rawBody)
  .digest('hex');
const valid = crypto.timingSafeEqual(
  Buffer.from(signature),
  Buffer.from(expected)
);`}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Retry Policy</h3>
              <p>
                Failed deliveries (non-2xx responses or timeouts) are retried up to 3 times with exponential backoff
                (1 min, 5 min, 30 min). After 3 consecutive failures the webhook is not automatically disabled but
                the failure count increments. Webhooks with high failure counts should be investigated.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Example Payloads</h3>
              <div className="space-y-3">
                {([
                  { event: 'shift.created', data: { id: 'abc-123', site_id: 'site-001', guard_id: 'guard-001', start_time: '2026-01-15T08:00:00Z' } },
                  { event: 'incident.created', data: { id: 'inc-456', site_id: 'site-001', severity: 'high', description: 'Unauthorized access attempt' } },
                  { event: 'clock_in', data: { guard_id: 'guard-001', site_id: 'site-001', timestamp: '2026-01-15T08:02:00Z' } },
                  { event: 'sos.activated', data: { guard_id: 'guard-001', location: { lat: -26.2041, lng: 28.0473 } } },
                ] as { event: string; data: Record<string, unknown> }[]).map((ex) => (
                  <div key={ex.event}>
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full mb-1 ${categoryColorFor(ex.event)}`}>{ex.event}</span>
                    <pre className="bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto font-mono text-xs leading-relaxed">
                      {JSON.stringify({ event: ex.event, timestamp: '2026-01-15T10:30:00.000Z', data: ex.data }, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Webhook List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      ) : webhooks.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Webhook className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No webhooks configured</h3>
          <p className="text-sm text-gray-500 mb-4">Create a webhook to start sending event data to your external systems.</p>
          <button onClick={openCreateModal} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
            <Plus className="w-4 h-4" />
            Add Webhook
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {webhooks.map((wh) => (
            <div key={wh.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Webhook card header */}
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${wh.is_active ? 'bg-green-50' : 'bg-gray-100'}`}>
                      <Webhook className={`w-5 h-5 ${wh.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{wh.name}</h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${wh.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {wh.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {wh.failure_count > 0 && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                            {wh.failure_count} failure{wh.failure_count !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">{truncateUrl(wh.url)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleTest(wh)} disabled={testing === wh.id} className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50" title="Send test">
                      {testing === wh.id ? <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" /> : <Send className="w-4 h-4 text-gray-500" />}
                    </button>
                    <button onClick={() => toggleLogs(wh.id)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="View logs">
                      <FileText className="w-4 h-4 text-gray-500" />
                    </button>
                    <button onClick={() => openEditModal(wh)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Edit">
                      <Edit2 className="w-4 h-4 text-gray-500" />
                    </button>
                    <button onClick={() => handleDelete(wh)} className="p-2 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>

                {/* Events */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {wh.events.map((evt) => (
                    <span key={evt} className={`px-2 py-0.5 text-xs font-medium rounded-full ${categoryColorFor(evt)}`}>{evt}</span>
                  ))}
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  {wh.last_triggered_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Last triggered {timeAgo(wh.last_triggered_at)}
                    </span>
                  )}
                  {wh.last_status_code !== null && (
                    <span className="flex items-center gap-1">
                      Last status: {statusBadge(wh.last_status_code)}
                    </span>
                  )}
                  {wh.secret && (
                    <span className="flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5" />
                      Signed
                    </span>
                  )}
                </div>
              </div>

              {/* Delivery logs (expanded) */}
              {expandedLogs === wh.id && (
                <div className="border-t border-gray-200 bg-gray-50">
                  <div className="px-5 py-3 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-700">Recent Deliveries</h4>
                    <button onClick={() => fetchLogs(wh.id)} className="text-xs text-blue-600 hover:text-blue-700">Refresh</button>
                  </div>
                  {logsLoading ? (
                    <div className="px-5 pb-4">
                      <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
                    </div>
                  ) : logs.length === 0 ? (
                    <p className="px-5 pb-4 text-xs text-gray-500">No delivery logs yet.</p>
                  ) : (
                    <div className="px-5 pb-4 space-y-2">
                      {logs.map((log) => (
                        <div key={log.id} className="bg-white border border-gray-200 rounded-lg">
                          <button
                            onClick={() => setExpandedPayload(expandedPayload === log.id ? null : log.id)}
                            className="w-full px-4 py-2.5 flex items-center justify-between text-left"
                          >
                            <div className="flex items-center gap-3">
                              {log.success ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${categoryColorFor(log.event_type)}`}>{log.event_type}</span>
                              {statusBadge(log.response_status)}
                              <span className="text-xs text-gray-500">{timeAgo(log.delivered_at)}</span>
                            </div>
                            {expandedPayload === log.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                          </button>
                          {expandedPayload === log.id && (
                            <div className="px-4 pb-3 space-y-2">
                              <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Payload</p>
                                <pre className="bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto font-mono text-xs leading-relaxed max-h-48 overflow-y-auto">
                                  {JSON.stringify(log.payload, null, 2)}
                                </pre>
                              </div>
                              {log.response_body && (
                                <div>
                                  <p className="text-xs font-medium text-gray-500 mb-1">Response</p>
                                  <pre className="bg-gray-900 text-gray-300 p-3 rounded-lg overflow-x-auto font-mono text-xs leading-relaxed max-h-48 overflow-y-auto">
                                    {log.response_body}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">{editingWebhook ? 'Edit Webhook' : 'Create Webhook'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Payroll Integration"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {/* URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endpoint URL</label>
                <input
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://api.example.com/webhooks"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {/* Secret */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Signing Secret (optional)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={formSecret}
                      onChange={(e) => setFormSecret(e.target.value)}
                      placeholder="Enter or generate a secret"
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                    >
                      {showSecret ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormSecret(generateSecret())}
                    className="px-3 py-2 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
                  >
                    Generate
                  </button>
                  {formSecret && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(formSecret)}
                      className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Copy className="w-4 h-4 text-gray-500" />
                    </button>
                  )}
                </div>
              </div>

              {/* Events */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Events</label>
                <div className="space-y-3 max-h-56 overflow-y-auto border border-gray-200 rounded-lg p-3">
                  {EVENT_CATEGORIES.map((cat) => {
                    const allSelected = cat.events.every((e) => formEvents.includes(e));
                    const someSelected = cat.events.some((e) => formEvents.includes(e));
                    return (
                      <div key={cat.label}>
                        <button
                          type="button"
                          onClick={() => toggleCategoryEvents(cat.events)}
                          className="flex items-center gap-2 mb-1 text-sm font-medium text-gray-800 hover:text-gray-900"
                        >
                          <span className={`w-4 h-4 border rounded flex items-center justify-center text-xs ${allSelected ? 'bg-blue-600 border-blue-600 text-white' : someSelected ? 'bg-blue-100 border-blue-400 text-blue-600' : 'border-gray-300'}`}>
                            {allSelected && <span>&#10003;</span>}
                            {someSelected && !allSelected && <span>-</span>}
                          </span>
                          {cat.label}
                        </button>
                        <div className="ml-6 flex flex-wrap gap-1.5">
                          {cat.events.map((evt) => (
                            <label key={evt} className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formEvents.includes(evt)}
                                onChange={() => toggleEvent(evt)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className={`px-2 py-0.5 text-xs rounded-full ${cat.color}`}>{evt}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Active</span>
                <button
                  type="button"
                  onClick={() => setFormActive(!formActive)}
                  className="flex items-center gap-2 text-sm"
                >
                  {formActive ? (
                    <ToggleRight className="w-8 h-8 text-blue-600" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? 'Saving...' : editingWebhook ? 'Update Webhook' : 'Create Webhook'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
