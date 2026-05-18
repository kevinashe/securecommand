import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { FileText, Plus, DollarSign, Calendar, CheckCircle, Clock, Send, X, ArrowLeft, MapPin, ChevronDown, ChevronUp, Search, Users } from 'lucide-react';
import { showToast } from '../lib/toast';

interface SiteBreakdown {
  siteName: string;
  hours: number;
  amount: number;
  guardCount: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  billing_period_start: string;
  billing_period_end: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  due_date: string;
  paid_date: string | null;
  notes: string | null;
  created_at: string;
  siteBreakdowns?: SiteBreakdown[];
}

interface PreviewShift {
  id: string;
  siteName: string;
  guardName: string;
  startTime: string;
  endTime: string;
  hours: number;
}

interface SitePreview {
  siteName: string;
  shifts: PreviewShift[];
  totalHours: number;
  totalAmount: number;
  selected: boolean;
}

interface InvoicingViewProps {
  onBack: () => void;
}

export const InvoicingView: React.FC<InvoicingViewProps> = ({ onBack }) => {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

  // Create form
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState({
    billing_period_start: '',
    billing_period_end: '',
    due_date: '',
    tax_rate: 0,
    notes: '',
  });
  const [sitePreviews, setSitePreviews] = useState<SitePreview[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [defaultRate, setDefaultRate] = useState(25);

  useEffect(() => {
    loadInvoices();
  }, [profile]);

  const loadInvoices = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', profile.company_id!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data) { setInvoices([]); return; }

      const invoiceIds = data.map(inv => inv.id);
      let items: any[] = [];
      if (invoiceIds.length > 0) {
        const { data: itemData } = await supabase
          .from('invoice_items')
          .select('invoice_id, description, quantity, amount')
          .in('invoice_id', invoiceIds);
        items = itemData || [];
      }

      const invoicesWithBreakdowns = data.map(inv => {
        const invoiceItems = items.filter(it => it.invoice_id === inv.id);
        const siteMap = new Map<string, SiteBreakdown>();

        for (const item of invoiceItems) {
          const parts = (item.description || '').split(' - ');
          const siteName = parts.length >= 2 ? parts[1] : 'Unknown Site';

          const existing = siteMap.get(siteName);
          if (existing) {
            existing.hours += Number(item.quantity) || 0;
            existing.amount += Number(item.amount) || 0;
            existing.guardCount += 1;
          } else {
            siteMap.set(siteName, {
              siteName,
              hours: Number(item.quantity) || 0,
              amount: Number(item.amount) || 0,
              guardCount: 1,
            });
          }
        }

        return { ...inv, siteBreakdowns: Array.from(siteMap.values()) };
      });

      setInvoices(invoicesWithBreakdowns);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchShiftPreview = async () => {
    if (!formData.billing_period_start || !formData.billing_period_end) {
      showToast('error', 'Please select billing period dates first');
      return;
    }

    setPreviewLoading(true);
    try {
      const { data: rates } = await supabase
        .from('billing_rates')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .eq('is_active', true)
        .maybeSingle();

      const rate = rates?.rate_amount || 25;
      setDefaultRate(rate);

      const { data: shifts } = await supabase
        .from('shifts')
        .select('id, start_time, end_time, sites(name), profiles!shifts_guard_id_fkey(full_name)')
        .eq('status', 'completed')
        .gte('start_time', formData.billing_period_start)
        .lte('end_time', formData.billing_period_end);

      if (!shifts || shifts.length === 0) {
        setSitePreviews([]);
        showToast('warning', 'No completed shifts found for this period');
        return;
      }

      const siteMap = new Map<string, PreviewShift[]>();

      for (const shift of shifts) {
        const siteName = (shift as any).sites?.name || 'Unknown Site';
        const guardName = (shift as any).profiles?.full_name || 'Unknown';
        const start = new Date(shift.start_time);
        const end = new Date(shift.end_time);
        const hours = Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 100) / 100;

        const preview: PreviewShift = {
          id: shift.id,
          siteName,
          guardName,
          startTime: shift.start_time,
          endTime: shift.end_time,
          hours,
        };

        if (!siteMap.has(siteName)) siteMap.set(siteName, []);
        siteMap.get(siteName)!.push(preview);
      }

      const previews: SitePreview[] = Array.from(siteMap.entries()).map(([siteName, siteShifts]) => {
        const totalHours = siteShifts.reduce((s, sh) => s + sh.hours, 0);
        return {
          siteName,
          shifts: siteShifts,
          totalHours: Math.round(totalHours * 100) / 100,
          totalAmount: Math.round(totalHours * rate * 100) / 100,
          selected: true,
        };
      }).sort((a, b) => b.totalAmount - a.totalAmount);

      setSitePreviews(previews);
      setStep(2);
    } catch (error) {
      console.error('Error previewing shifts:', error);
      showToast('error', 'Failed to load shift data');
    } finally {
      setPreviewLoading(false);
    }
  };

  const toggleSite = (siteName: string) => {
    setSitePreviews(prev => prev.map(sp =>
      sp.siteName === siteName ? { ...sp, selected: !sp.selected } : sp
    ));
  };

  const selectedPreviews = sitePreviews.filter(sp => sp.selected);
  const previewSubtotal = selectedPreviews.reduce((s, sp) => s + sp.totalAmount, 0);
  const previewTax = Math.round(previewSubtotal * (formData.tax_rate / 100) * 100) / 100;
  const previewTotal = Math.round((previewSubtotal + previewTax) * 100) / 100;

  const generateInvoice = async () => {
    if (selectedPreviews.length === 0) {
      showToast('error', 'Select at least one site');
      return;
    }
    if (!formData.due_date) {
      showToast('error', 'Please set a due date');
      return;
    }

    setGenerating(true);
    try {
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          company_id: profile!.company_id,
          billing_period_start: formData.billing_period_start,
          billing_period_end: formData.billing_period_end,
          due_date: formData.due_date,
          tax_amount: 0,
          notes: formData.notes || null,
          status: 'draft',
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      const items = selectedPreviews.flatMap(site =>
        site.shifts.map(shift => ({
          invoice_id: invoice.id,
          description: `Security services - ${shift.siteName} - ${shift.guardName}`,
          quantity: shift.hours,
          unit_price: defaultRate,
          amount: Math.round(shift.hours * defaultRate * 100) / 100,
          shift_id: shift.id,
        }))
      );

      await supabase.from('invoice_items').insert(items);

      const subtotal = Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
      const taxAmount = Math.round(subtotal * (formData.tax_rate / 100) * 100) / 100;
      const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

      await supabase
        .from('invoices')
        .update({ subtotal, tax_amount: taxAmount, total_amount: totalAmount, amount: totalAmount })
        .eq('id', invoice.id);

      closeCreateModal();
      loadInvoices();
      showToast('success', 'Invoice generated successfully!');
    } catch (error) {
      console.error('Error generating invoice:', error);
      showToast('error', 'Error generating invoice. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setStep(1);
    setSitePreviews([]);
    setFormData({ billing_period_start: '', billing_period_end: '', due_date: '', tax_rate: 0, notes: '' });
  };

  const updateInvoiceStatus = async (invoiceId: string, status: string) => {
    try {
      const updates: any = { status };
      if (status === 'paid') updates.paid_date = new Date().toISOString().split('T')[0];
      await supabase.from('invoices').update(updates).eq('id', invoiceId);
      loadInvoices();
    } catch (error) {
      console.error('Error updating invoice:', error);
    }
  };

  const deleteInvoice = async (id: string) => {
    if (!confirm('Delete this invoice? This action cannot be undone.')) return;
    try {
      await supabase.from('invoices').delete().eq('id', id);
      loadInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors">
        <ArrowLeft className="h-5 w-5" />
        <span>Back to Dashboard</span>
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Invoicing</h2>
          <p className="text-gray-600">Generate and manage invoices per site</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Generate Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">Total Invoices</span>
            <FileText className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">Paid</span>
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-600">{invoices.filter(i => i.status === 'paid').length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">Pending</span>
            <Clock className="h-5 w-5 text-yellow-600" />
          </div>
          <p className="text-2xl font-bold text-yellow-600">{invoices.filter(i => i.status === 'sent').length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">Total Amount</span>
            <DollarSign className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${invoices.reduce((sum, i) => sum + (parseFloat(String(i.total_amount)) || 0), 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Invoice list */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">All Invoices</h3>

        {invoices.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 px-6 py-12 text-center text-gray-500">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-700 mb-1">No invoices yet</p>
            <p className="text-sm">Generate your first invoice to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {invoices.map((invoice) => {
              const isExpanded = expandedInvoice === invoice.id;
              const totalHours = invoice.siteBreakdowns?.reduce((s, b) => s + b.hours, 0) || 0;
              const siteCount = invoice.siteBreakdowns?.length || 0;

              return (
                <div key={invoice.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-gray-900 text-lg">{invoice.invoice_number}</h4>
                          <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                            {invoice.status.toUpperCase()}
                          </span>
                        </div>
                        {invoice.billing_period_start && (
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>
                              {new Date(invoice.billing_period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              {' - '}
                              {new Date(invoice.billing_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">
                          ${(parseFloat(String(invoice.total_amount)) || 0).toFixed(2)}
                        </p>
                        {invoice.tax_amount > 0 && (
                          <p className="text-xs text-gray-500">incl. ${parseFloat(String(invoice.tax_amount)).toFixed(2)} tax</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                        <p className="text-xs text-gray-500">Sites</p>
                        <p className="text-sm font-bold text-gray-900">{siteCount}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                        <p className="text-xs text-gray-500">Hours</p>
                        <p className="text-sm font-bold text-gray-900">{totalHours.toFixed(1)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                        <p className="text-xs text-gray-500">Due</p>
                        <p className="text-sm font-bold text-gray-900">
                          {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '--'}
                        </p>
                      </div>
                    </div>

                    {siteCount > 0 && (
                      <button
                        onClick={() => setExpandedInvoice(isExpanded ? null : invoice.id)}
                        className="w-full flex items-center justify-between px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                      >
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-4 w-4" />
                          Site Breakdown
                        </span>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    )}
                  </div>

                  {isExpanded && invoice.siteBreakdowns && invoice.siteBreakdowns.length > 0 && (
                    <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
                      <div className="space-y-2">
                        {invoice.siteBreakdowns.sort((a, b) => b.amount - a.amount).map((site, idx) => (
                          <div key={idx} className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-gray-100">
                            <div className="flex items-center gap-2 min-w-0">
                              <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{site.siteName}</p>
                                <p className="text-xs text-gray-500">{site.guardCount} shift{site.guardCount !== 1 ? 's' : ''} -- {site.hours.toFixed(1)} hrs</p>
                              </div>
                            </div>
                            <p className="text-sm font-bold text-gray-900 flex-shrink-0 ml-3">${site.amount.toFixed(2)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-end gap-2">
                    {invoice.status === 'draft' && (
                      <button onClick={() => updateInvoiceStatus(invoice.id, 'sent')} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Send className="h-4 w-4" /> Send
                      </button>
                    )}
                    {invoice.status === 'sent' && (
                      <button onClick={() => updateInvoiceStatus(invoice.id, 'paid')} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                        <CheckCircle className="h-4 w-4" /> Mark Paid
                      </button>
                    )}
                    <button onClick={() => deleteInvoice(invoice.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <X className="h-4 w-4" /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full my-8 shadow-xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Generate Invoice</h3>
                <p className="text-sm text-gray-500">
                  {step === 1 ? 'Select billing period' : `${selectedPreviews.length} site${selectedPreviews.length !== 1 ? 's' : ''} selected`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  <div className={`w-8 h-1 rounded-full ${step >= 1 ? 'bg-blue-600' : 'bg-gray-200'}`} />
                  <div className={`w-8 h-1 rounded-full ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
                </div>
                <button onClick={closeCreateModal} className="text-gray-400 hover:text-gray-600">
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>

            {/* Step 1: Select dates */}
            {step === 1 && (
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Period Start</label>
                    <input
                      type="date"
                      value={formData.billing_period_start}
                      onChange={(e) => setFormData({ ...formData, billing_period_start: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Period End</label>
                    <input
                      type="date"
                      value={formData.billing_period_end}
                      onChange={(e) => setFormData({ ...formData, billing_period_end: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={formData.tax_rate}
                      onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Additional notes..."
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={fetchShiftPreview}
                    disabled={previewLoading || !formData.billing_period_start || !formData.billing_period_end}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {previewLoading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    ) : (
                      <Search className="h-5 w-5" />
                    )}
                    {previewLoading ? 'Loading Shifts...' : 'Preview Shifts by Site'}
                  </button>
                  <button onClick={closeCreateModal} className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Review sites & generate */}
            {step === 2 && (
              <div className="flex flex-col" style={{ maxHeight: '70vh' }}>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {sitePreviews.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                      <p>No completed shifts found for this period</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600">
                          {sitePreviews.length} site{sitePreviews.length !== 1 ? 's' : ''} with completed shifts
                        </p>
                        <button
                          onClick={() => {
                            const allSelected = sitePreviews.every(s => s.selected);
                            setSitePreviews(prev => prev.map(sp => ({ ...sp, selected: !allSelected })));
                          }}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {sitePreviews.every(s => s.selected) ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>

                      {sitePreviews.map((site) => (
                        <div
                          key={site.siteName}
                          className={`rounded-xl border-2 transition-all ${
                            site.selected ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200 bg-white opacity-60'
                          }`}
                        >
                          <button
                            onClick={() => toggleSite(site.siteName)}
                            className="w-full flex items-center justify-between p-4 text-left"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                site.selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'
                              }`}>
                                {site.selected && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-gray-500" />
                                  <p className="font-semibold text-gray-900">{site.siteName}</p>
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{site.shifts.length} shift{site.shifts.length !== 1 ? 's' : ''}</span>
                                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{site.totalHours.toFixed(1)} hrs</span>
                                  <span>${defaultRate}/hr</span>
                                </div>
                              </div>
                            </div>
                            <p className="text-lg font-bold text-gray-900">${site.totalAmount.toFixed(2)}</p>
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {/* Summary & actions */}
                <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
                  <div className="space-y-1.5 mb-4">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Subtotal ({selectedPreviews.reduce((s, sp) => s + sp.shifts.length, 0)} shifts)</span>
                      <span>${previewSubtotal.toFixed(2)}</span>
                    </div>
                    {formData.tax_rate > 0 && (
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Tax ({formData.tax_rate}%)</span>
                        <span>${previewTax.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-bold text-gray-900 pt-1.5 border-t border-gray-300">
                      <span>Total</span>
                      <span>${previewTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep(1)}
                      className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={generateInvoice}
                      disabled={generating || selectedPreviews.length === 0}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {generating ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                      ) : (
                        <FileText className="h-5 w-5" />
                      )}
                      {generating ? 'Generating...' : `Generate Invoice -- $${previewTotal.toFixed(2)}`}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
