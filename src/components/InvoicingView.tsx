import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { FileText, Plus, DollarSign, Calendar, CheckCircle, Clock, Send, X, ArrowLeft, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
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

  const [formData, setFormData] = useState({
    billing_period_start: '',
    billing_period_end: '',
    due_date: '',
    tax_rate: 0,
    notes: '',
  });

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
      const { data: items } = await supabase
        .from('invoice_items')
        .select('invoice_id, description, quantity, amount')
        .in('invoice_id', invoiceIds);

      const invoicesWithBreakdowns = data.map(inv => {
        const invoiceItems = (items || []).filter(it => it.invoice_id === inv.id);
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

  const generateInvoice = async () => {
    setGenerating(true);

    try {
      const { data: shifts } = await supabase
        .from('shifts')
        .select('*, sites(name), profiles!shifts_guard_id_fkey(full_name)')
        .eq('status', 'completed')
        .gte('start_time', formData.billing_period_start)
        .lte('end_time', formData.billing_period_end);

      if (!shifts || shifts.length === 0) {
        showToast('warning', 'No completed shifts found for the selected period');
        return;
      }

      const { data: rates } = await supabase
        .from('billing_rates')
        .select('*')
        .eq('company_id', profile!.company_id!)
        .eq('is_active', true)
        .maybeSingle();

      const defaultRate = rates?.rate_amount || 25;

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          company_id: profile!.company_id,
          billing_period_start: formData.billing_period_start,
          billing_period_end: formData.billing_period_end,
          due_date: formData.due_date,
          tax_amount: 0,
          notes: formData.notes,
          status: 'draft',
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      const items = shifts.map((shift) => {
        const start = new Date(shift.start_time);
        const end = new Date(shift.end_time);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        const amount = hours * defaultRate;

        return {
          invoice_id: invoice.id,
          description: `Security services - ${shift.sites?.name} - ${shift.profiles?.full_name}`,
          quantity: Math.round(hours * 100) / 100,
          unit_price: defaultRate,
          amount: Math.round(amount * 100) / 100,
          shift_id: shift.id,
        };
      });

      await supabase.from('invoice_items').insert(items);

      const subtotal = Math.round(items.reduce((sum, item) => sum + item.amount, 0) * 100) / 100;
      const taxAmount = Math.round(subtotal * (formData.tax_rate / 100) * 100) / 100;
      const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

      await supabase
        .from('invoices')
        .update({
          subtotal,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          amount: totalAmount,
        })
        .eq('id', invoice.id);

      setShowCreateModal(false);
      setFormData({
        billing_period_start: '',
        billing_period_end: '',
        due_date: '',
        tax_rate: 0,
        notes: '',
      });
      loadInvoices();
      showToast('success', 'Invoice generated successfully!');
    } catch (error) {
      console.error('Error generating invoice:', error);
      showToast('error', 'Error generating invoice. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const updateInvoiceStatus = async (invoiceId: string, status: string) => {
    try {
      const updates: any = { status };
      if (status === 'paid') {
        updates.paid_date = new Date().toISOString().split('T')[0];
      }

      await supabase
        .from('invoices')
        .update(updates)
        .eq('id', invoiceId);

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
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'sent':
        return 'bg-blue-100 text-blue-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
        <span>Back to Dashboard</span>
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Invoicing</h2>
          <p className="text-gray-600">Automated invoice generation and tracking</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-5 w-5" />
          Generate Invoice
        </button>
      </div>

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
          <p className="text-2xl font-bold text-green-600">
            {invoices.filter(i => i.status === 'paid').length}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">Pending</span>
            <Clock className="h-5 w-5 text-yellow-600" />
          </div>
          <p className="text-2xl font-bold text-yellow-600">
            {invoices.filter(i => i.status === 'sent').length}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">Total Amount</span>
            <DollarSign className="h-5 w-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ${invoices.reduce((sum, i) => sum + parseFloat(i.total_amount.toString()), 0).toFixed(2)}
          </p>
        </div>
      </div>

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
                <div
                  key={invoice.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  {/* Header */}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-gray-900 text-lg">{invoice.invoice_number}</h4>
                          <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                            {invoice.status.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {new Date(invoice.billing_period_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            {' - '}
                            {new Date(invoice.billing_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">
                          ${parseFloat(invoice.total_amount.toString()).toFixed(2)}
                        </p>
                        {invoice.tax_amount > 0 && (
                          <p className="text-xs text-gray-500">
                            incl. ${parseFloat(invoice.tax_amount.toString()).toFixed(2)} tax
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Summary stats row */}
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
                          {new Date(invoice.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>

                    {/* Site breakdown toggle */}
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

                  {/* Expanded site breakdown */}
                  {isExpanded && invoice.siteBreakdowns && invoice.siteBreakdowns.length > 0 && (
                    <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
                      <div className="space-y-2">
                        {invoice.siteBreakdowns
                          .sort((a, b) => b.amount - a.amount)
                          .map((site, idx) => (
                            <div key={idx} className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-gray-100">
                              <div className="flex items-center gap-2 min-w-0">
                                <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">{site.siteName}</p>
                                  <p className="text-xs text-gray-500">{site.guardCount} shift{site.guardCount !== 1 ? 's' : ''} -- {site.hours.toFixed(1)} hrs</p>
                                </div>
                              </div>
                              <p className="text-sm font-bold text-gray-900 flex-shrink-0 ml-3">
                                ${site.amount.toFixed(2)}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Action bar */}
                  <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-end gap-2">
                    {invoice.status === 'draft' && (
                      <button
                        onClick={() => updateInvoiceStatus(invoice.id, 'sent')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Send className="h-4 w-4" />
                        Send
                      </button>
                    )}
                    {invoice.status === 'sent' && (
                      <button
                        onClick={() => updateInvoiceStatus(invoice.id, 'paid')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Mark Paid
                      </button>
                    )}
                    <button
                      onClick={() => deleteInvoice(invoice.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Generate Invoice</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Billing Period Start
                </label>
                <input
                  type="date"
                  value={formData.billing_period_start}
                  onChange={(e) => setFormData({ ...formData, billing_period_start: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Billing Period End
                </label>
                <input
                  type="date"
                  value={formData.billing_period_end}
                  onChange={(e) => setFormData({ ...formData, billing_period_end: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.tax_rate}
                  onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Add any notes or special instructions..."
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={generateInvoice}
                  disabled={generating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {generating ? 'Generating...' : 'Generate Invoice'}
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={generating}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
