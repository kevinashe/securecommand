import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  CreditCard,
  DollarSign,
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Plus,
  X,
  Wallet,
  Building2,
  Info,
} from 'lucide-react';

interface PaymentGateway {
  id: string;
  name: string;
  display_name: string;
  is_enabled: boolean;
  configuration: Record<string, unknown>;
}

interface PaymentMethod {
  id: string;
  company_id: string;
  gateway_id: string;
  type: string;
  details: Record<string, string>;
  is_default: boolean;
  is_active: boolean;
  gateway_name?: string;
  gateway_display_name?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  status: string;
  created_at: string;
}

interface PaymentTransaction {
  id: string;
  invoice_id: string;
  company_id: string;
  amount: number;
  currency: string;
  status: string;
  gateway_transaction_id: string | null;
  error_message: string | null;
  processed_at: string | null;
  created_at: string;
  invoice_number?: string;
  gateway_name?: string;
  company_name?: string;
}

interface PaymentsViewProps {
  onBack?: () => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({ onBack }) => {
  const { profile } = useAuth();
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMethodModal, setShowAddMethodModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showGatewaySettings, setShowGatewaySettings] = useState(false);
  const [error, setError] = useState('');

  const [newMethod, setNewMethod] = useState({
    gateway_id: '',
    type: 'bank_account',
    label: '',
    bank_name: '',
    account_last4: '',
    reference_note: '',
  });

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [profile]);

  const loadData = async () => {
    try {
      await Promise.all([
        loadGateways(),
        loadPaymentMethods(),
        loadPendingInvoices(),
        loadTransactions(),
      ]);
    } catch (err) {
      console.error('Error loading payment data:', err);
      setError('Failed to load payment data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const loadGateways = async () => {
    const query = supabase
      .from('payment_gateways')
      .select('*')
      .order('display_name');

    if (profile?.role !== 'super_admin') {
      query.eq('is_enabled', true);
    }

    const { data } = await query;
    setGateways(data || []);
  };

  const loadPaymentMethods = async () => {
    if (!profile?.company_id) return;

    const { data } = await supabase
      .from('payment_methods')
      .select('*, payment_gateways(name, display_name)')
      .eq('company_id', profile.company_id)
      .eq('is_active', true)
      .order('is_default', { ascending: false });

    const formatted = data?.map((item: Record<string, unknown>) => ({
      ...item,
      gateway_name: (item.payment_gateways as Record<string, string>)?.name,
      gateway_display_name: (item.payment_gateways as Record<string, string>)?.display_name,
    }));

    setPaymentMethods((formatted || []) as PaymentMethod[]);
  };

  const loadPendingInvoices = async () => {
    if (!profile?.company_id) return;

    const { data } = await supabase
      .from('invoices')
      .select('*')
      .eq('company_id', profile.company_id)
      .eq('status', 'pending')
      .order('due_date', { ascending: true });

    setPendingInvoices(data || []);
  };

  const loadTransactions = async () => {
    const query = supabase
      .from('payment_transactions')
      .select('*, invoices(invoice_number), payment_gateways(display_name), companies(name)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (profile?.role !== 'super_admin' && profile?.company_id) {
      query.eq('company_id', profile.company_id);
    }

    const { data } = await query;

    const formatted = data?.map((item: Record<string, unknown>) => ({
      ...item,
      invoice_number: (item.invoices as Record<string, string>)?.invoice_number,
      gateway_name: (item.payment_gateways as Record<string, string>)?.display_name,
      company_name: (item.companies as Record<string, string>)?.name,
    }));

    setTransactions((formatted || []) as PaymentTransaction[]);
  };

  const addPaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const gateway = gateways.find((g) => g.id === newMethod.gateway_id);
      if (!gateway) {
        setError('Please select a payment gateway.');
        return;
      }

      const details: Record<string, string> = {
        label: newMethod.label || `${newMethod.type} payment`,
      };

      if (newMethod.type === 'bank_account') {
        details.bank_name = newMethod.bank_name;
        details.last4 = newMethod.account_last4;
      } else if (newMethod.type === 'manual') {
        details.reference_note = newMethod.reference_note;
      }

      const { error: insertError } = await supabase.from('payment_methods').insert([
        {
          company_id: profile?.company_id,
          gateway_id: newMethod.gateway_id,
          type: newMethod.type,
          details,
          is_default: paymentMethods.length === 0,
        },
      ]);

      if (insertError) {
        setError('Failed to add payment method. Please try again.');
        return;
      }

      setShowAddMethodModal(false);
      loadPaymentMethods();
      setNewMethod({
        gateway_id: '',
        type: 'bank_account',
        label: '',
        bank_name: '',
        account_last4: '',
        reference_note: '',
      });
    } catch (err) {
      console.error('Error adding payment method:', err);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  const recordManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice || !selectedPaymentMethod) return;
    setError('');

    try {
      const method = paymentMethods.find((m) => m.id === selectedPaymentMethod);
      if (!method) return;

      const { error: txError } = await supabase.from('payment_transactions').insert([
        {
          invoice_id: selectedInvoice.id,
          company_id: profile?.company_id,
          payment_method_id: selectedPaymentMethod,
          gateway_id: method.gateway_id,
          amount: selectedInvoice.amount,
          currency: 'USD',
          status: 'pending',
          processed_at: new Date().toISOString(),
        },
      ]);

      if (txError) {
        setError('Failed to record payment. Please try again.');
        return;
      }

      setShowPaymentModal(false);
      setSelectedInvoice(null);
      setSelectedPaymentMethod('');
      loadData();
    } catch (err) {
      console.error('Error recording payment:', err);
      setError('An unexpected error occurred. Please try again.');
    }
  };

  const openPaymentModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setError('');
    if (paymentMethods.length > 0) {
      const defaultMethod = paymentMethods.find((m) => m.is_default);
      setSelectedPaymentMethod(defaultMethod?.id || paymentMethods[0].id);
    }
    setShowPaymentModal(true);
  };

  const toggleGateway = async (gatewayId: string, isEnabled: boolean) => {
    try {
      const { error: updateError } = await supabase
        .from('payment_gateways')
        .update({ is_enabled: !isEnabled, updated_at: new Date().toISOString() })
        .eq('id', gatewayId);

      if (!updateError) {
        loadGateways();
      }
    } catch (err) {
      console.error('Error toggling gateway:', err);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      case 'processing':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-yellow-100 text-yellow-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-600 mt-1">Manage payment methods and process invoices</p>
        </div>
        {profile?.role === 'super_admin' && (
          <button
            onClick={() => setShowGatewaySettings(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Settings className="h-5 w-5" />
            <span>Gateway Settings</span>
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Pending Invoices</p>
              <p className="text-2xl font-bold text-gray-900">{pendingInvoices.length}</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <AlertCircle className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Payment Methods</p>
              <p className="text-2xl font-bold text-gray-900">{paymentMethods.length}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <CreditCard className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Paid</p>
              <p className="text-2xl font-bold text-gray-900">
                $
                {transactions
                  .filter((t) => t.status === 'completed')
                  .reduce((sum, t) => sum + Number(t.amount), 0)
                  .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {profile?.role !== 'super_admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Payment Methods</h2>
              <button
                onClick={() => { setShowAddMethodModal(true); setError(''); }}
                className="flex items-center space-x-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add Method</span>
              </button>
            </div>
          <div className="p-6">
            {paymentMethods.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Wallet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p>No payment methods added</p>
                <button
                  onClick={() => { setShowAddMethodModal(true); setError(''); }}
                  className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                >
                  Add your first payment method
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        {method.type === 'bank_account' ? (
                          <Building2 className="h-5 w-5 text-blue-600" />
                        ) : (
                          <CreditCard className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {method.details.label || method.gateway_display_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {method.type === 'bank_account'
                            ? `${method.details.bank_name || 'Bank'} ${method.details.last4 ? `****${method.details.last4}` : ''}`
                            : method.gateway_display_name}
                        </p>
                      </div>
                    </div>
                    {method.is_default && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                        Default
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Pending Invoices</h2>
          </div>
          <div className="p-6">
            {pendingInvoices.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p>All invoices are paid!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{invoice.invoice_number}</p>
                      <p className="text-sm text-gray-500">
                        Due: {new Date(invoice.due_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        ${Number(invoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <button
                        onClick={() => openPaymentModal(invoice)}
                        disabled={paymentMethods.length === 0}
                        className="mt-1 text-blue-600 hover:text-blue-700 text-sm font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
                      >
                        Record Payment
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Payment History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Transaction ID
                </th>
                {profile?.role === 'super_admin' && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Company
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Gateway
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={profile?.role === 'super_admin' ? 7 : 6} className="px-6 py-12 text-center text-gray-500">
                    No payment history yet
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-mono text-gray-900">
                      {tx.gateway_transaction_id?.slice(0, 16) || tx.id.slice(0, 8)}
                    </td>
                    {profile?.role === 'super_admin' && (
                      <td className="px-6 py-4 text-sm text-gray-900">{tx.company_name || 'N/A'}</td>
                    )}
                    <td className="px-6 py-4 text-sm text-gray-900">{tx.invoice_number}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{tx.gateway_name}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      ${Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full capitalize ${getStatusColor(
                          tx.status
                        )}`}
                      >
                        {getStatusIcon(tx.status)}
                        <span className="ml-1">{tx.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddMethodModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Add Payment Method</h2>
              <button
                onClick={() => setShowAddMethodModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  Add your bank account or manual payment details for recording payments against invoices. An admin will verify and confirm each payment.
                </p>
              </div>
            </div>

            <form onSubmit={addPaymentMethod} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Gateway
                </label>
                <select
                  value={newMethod.gateway_id}
                  onChange={(e) => setNewMethod({ ...newMethod, gateway_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select Gateway</option>
                  {gateways.map((gateway) => (
                    <option key={gateway.id} value={gateway.id}>
                      {gateway.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={newMethod.type}
                  onChange={(e) => setNewMethod({ ...newMethod, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="bank_account">Bank Account / EFT</option>
                  <option value="manual">Manual / Cash / Check</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Label</label>
                <input
                  type="text"
                  value={newMethod.label}
                  onChange={(e) => setNewMethod({ ...newMethod, label: e.target.value })}
                  placeholder="e.g. Company Bank Account"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {newMethod.type === 'bank_account' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={newMethod.bank_name}
                      onChange={(e) => setNewMethod({ ...newMethod, bank_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last 4 Digits of Account
                    </label>
                    <input
                      type="text"
                      value={newMethod.account_last4}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setNewMethod({ ...newMethod, account_last4: val });
                      }}
                      placeholder="1234"
                      maxLength={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reference Note
                  </label>
                  <input
                    type="text"
                    value={newMethod.reference_note}
                    onChange={(e) => setNewMethod({ ...newMethod, reference_note: e.target.value })}
                    placeholder="e.g. Cash payment, Check #1234"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddMethodModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Method
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Record Payment</h2>
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedInvoice(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Invoice:</span>
                <span className="font-medium text-gray-900">{selectedInvoice.invoice_number}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Amount:</span>
                <span className="text-xl font-bold text-gray-900">
                  ${Number(selectedInvoice.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <Info className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-800">
                  This records a payment notification. An administrator will verify and confirm the payment before marking the invoice as paid.
                </p>
              </div>
            </div>

            <form onSubmit={recordManualPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <select
                  value={selectedPaymentMethod}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.details.label || method.gateway_display_name} {method.details.last4 ? `****${method.details.last4}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPaymentModal(false);
                    setSelectedInvoice(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showGatewaySettings && profile?.role === 'super_admin' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Payment Gateway Settings</h2>
              <button
                onClick={() => setShowGatewaySettings(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {gateways.map((gateway) => (
                <div
                  key={gateway.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-lg ${gateway.is_enabled ? 'bg-green-100' : 'bg-gray-100'}`}>
                      <CreditCard className={`h-6 w-6 ${gateway.is_enabled ? 'text-green-600' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{gateway.display_name}</h3>
                      <p className="text-sm text-gray-500">{gateway.name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleGateway(gateway.id, gateway.is_enabled)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      gateway.is_enabled
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {gateway.is_enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Enable or disable payment gateways to control which payment
                options are available to companies. Disabled gateways will not be visible to
                company administrators.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="font-semibold text-gray-900 mb-4">Payment Statistics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Total Transactions</p>
                  <p className="text-2xl font-bold text-gray-900">{transactions.length}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Success Rate</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {transactions.length > 0
                      ? Math.round(
                          (transactions.filter((t) => t.status === 'completed').length /
                            transactions.length) *
                            100
                        )
                      : 0}
                    %
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Completed Payments</p>
                  <p className="text-2xl font-bold text-green-600">
                    {transactions.filter((t) => t.status === 'completed').length}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">Failed Payments</p>
                  <p className="text-2xl font-bold text-red-600">
                    {transactions.filter((t) => t.status === 'failed').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setShowGatewaySettings(false)}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
