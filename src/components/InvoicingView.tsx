import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { FileText, Plus, DollarSign, Calendar, CheckCircle, Clock, Send, X, Download } from 'lucide-react';

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
}

export const InvoicingView: React.FC = () => {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [generating, setGenerating] = useState(false);

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
      if (data) setInvoices(data);
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
        .select('*, sites(name), profiles(full_name)')
        .eq('status', 'completed')
        .gte('start_time', formData.billing_period_start)
        .lte('end_time', formData.billing_period_end);

      if (!shifts || shifts.length === 0) {
        alert('No completed shifts found for the selected period');
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
          quantity: hours,
          unit_price: defaultRate,
          amount: amount,
          shift_id: shift.id,
        };
      });

      await supabase.from('invoice_items').insert(items);

      const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
      const taxAmount = subtotal * (formData.tax_rate / 100);

      await supabase
        .from('invoices')
        .update({
          tax_amount: taxAmount,
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
      alert('Invoice generated successfully!');
    } catch (error) {
      console.error('Error generating invoice:', error);
      alert('Error generating invoice. Please try again.');
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

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">All Invoices</h3>
        </div>

        <div className="divide-y divide-gray-200">
          {invoices.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No invoices yet. Generate your first invoice to get started.
            </div>
          ) : (
            invoices.map((invoice) => (
              <div key={invoice.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-gray-900">{invoice.invoice_number}</h4>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(invoice.status)}`}>
                        {invoice.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {new Date(invoice.billing_period_start).toLocaleDateString()} - {new Date(invoice.billing_period_end).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        ${parseFloat(invoice.total_amount.toString()).toFixed(2)}
                      </span>
                      <span>Due: {new Date(invoice.due_date).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {invoice.status === 'draft' && (
                      <button
                        onClick={() => updateInvoiceStatus(invoice.id, 'sent')}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Send Invoice"
                      >
                        <Send className="h-5 w-5" />
                      </button>
                    )}
                    {invoice.status === 'sent' && (
                      <button
                        onClick={() => updateInvoiceStatus(invoice.id, 'paid')}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                        title="Mark as Paid"
                      >
                        <CheckCircle className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteInvoice(invoice.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
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
