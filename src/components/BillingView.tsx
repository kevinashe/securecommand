import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { DollarSign, FileText, Plus, X, Send, AlertCircle, CheckCircle, Clock, Settings } from 'lucide-react';

interface CompanyBilling {
  id: string;
  name: string;
  email: string;
  subscription_tier: string;
  is_active: boolean;
  guard_count: number;
  license_fee: number;
  monthly_per_guard: number;
  total_monthly: number;
  last_invoice_date: string | null;
  last_invoice_status: string | null;
  custom_license_fee: number | null;
  custom_per_guard_fee: number | null;
}

interface Invoice {
  id: string;
  company_id: string;
  company_name: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  status: string;
  created_at: string;
}

export const BillingView: React.FC = () => {
  const { profile } = useAuth();
  const [companies, setCompanies] = useState<CompanyBilling[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showCompanyPricingModal, setShowCompanyPricingModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyBilling | null>(null);
  const [billingSettingsId, setBillingSettingsId] = useState<string | null>(null);

  const [pricingConfig, setPricingConfig] = useState({
    license_fee: 500,
    monthly_per_guard: 25,
  });

  const [invoiceForm, setInvoiceForm] = useState({
    amount: 0,
    due_date: '',
    description: '',
  });

  const [companyPricingForm, setCompanyPricingForm] = useState({
    custom_license_fee: null as number | null,
    custom_per_guard_fee: null as number | null,
  });

  useEffect(() => {
    loadBillingSettings();
  }, []);

  useEffect(() => {
    if (pricingConfig.license_fee > 0) {
      loadBillingData();
    }
  }, [pricingConfig]);

  const loadBillingSettings = async () => {
    try {
      const { data } = await supabase
        .from('billing_settings')
        .select('*')
        .maybeSingle();

      if (data) {
        setBillingSettingsId(data.id);
        setPricingConfig({
          license_fee: parseFloat(data.license_fee),
          monthly_per_guard: parseFloat(data.per_guard_fee),
        });
      }
    } catch (error) {
      console.error('Error loading billing settings:', error);
    }
  };

  const loadBillingData = async () => {
    try {
      const { data: companiesData } = await supabase
        .from('companies')
        .select('id, name, email, subscription_tier, is_active, custom_license_fee, custom_per_guard_fee')
        .order('name');

      if (companiesData) {
        const companiesWithBilling = await Promise.all(
          companiesData.map(async (company) => {
            const { count: guardCount } = await supabase
              .from('profiles')
              .select('id', { count: 'exact', head: true })
              .eq('company_id', company.id)
              .eq('role', 'security_officer');

            const { data: lastInvoice } = await supabase
              .from('invoices')
              .select('created_at, status')
              .eq('company_id', company.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            const guards = guardCount || 0;
            const licenseFee = company.custom_license_fee ?? pricingConfig.license_fee;
            const monthlyPerGuard = company.custom_per_guard_fee ?? pricingConfig.monthly_per_guard;
            const totalMonthly = licenseFee + (guards * monthlyPerGuard);

            return {
              ...company,
              guard_count: guards,
              license_fee: licenseFee,
              monthly_per_guard: monthlyPerGuard,
              total_monthly: totalMonthly,
              last_invoice_date: lastInvoice?.created_at || null,
              last_invoice_status: lastInvoice?.status || null,
            };
          })
        );

        setCompanies(companiesWithBilling);
      }

      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('*, companies(name)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (invoicesData) {
        const formattedInvoices = invoicesData.map((inv: any) => ({
          id: inv.id,
          company_id: inv.company_id,
          company_name: inv.companies?.name || 'Unknown',
          invoice_number: inv.invoice_number,
          amount: inv.amount,
          due_date: inv.due_date,
          status: inv.status,
          created_at: inv.created_at,
        }));
        setInvoices(formattedInvoices);
      }
    } catch (error) {
      console.error('Error loading billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateBillingSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (billingSettingsId) {
        const { error } = await supabase
          .from('billing_settings')
          .update({
            license_fee: pricingConfig.license_fee,
            per_guard_fee: pricingConfig.monthly_per_guard,
            updated_at: new Date().toISOString(),
          })
          .eq('id', billingSettingsId);

        if (!error) {
          setShowSettingsModal(false);
          loadBillingData();
        }
      }
    } catch (error) {
      console.error('Error updating billing settings:', error);
    }
  };

  const openInvoiceModal = (company: CompanyBilling) => {
    setSelectedCompany(company);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    setInvoiceForm({
      amount: company.total_monthly,
      due_date: dueDate.toISOString().split('T')[0],
      description: `Monthly subscription for ${company.guard_count} guards`,
    });
    setShowInvoiceModal(true);
  };

  const openCompanyPricingModal = (company: CompanyBilling) => {
    setSelectedCompany(company);
    setCompanyPricingForm({
      custom_license_fee: company.custom_license_fee,
      custom_per_guard_fee: company.custom_per_guard_fee,
    });
    setShowCompanyPricingModal(true);
  };

  const updateCompanyPricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    try {
      const { error } = await supabase
        .from('companies')
        .update({
          custom_license_fee: companyPricingForm.custom_license_fee,
          custom_per_guard_fee: companyPricingForm.custom_per_guard_fee,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedCompany.id);

      if (!error) {
        setShowCompanyPricingModal(false);
        setSelectedCompany(null);
        loadBillingData();
      }
    } catch (error) {
      console.error('Error updating company pricing:', error);
    }
  };

  const generateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    try {
      const invoiceNumber = `INV-${Date.now()}`;

      const { error } = await supabase.from('invoices').insert([
        {
          company_id: selectedCompany.id,
          invoice_number: invoiceNumber,
          amount: invoiceForm.amount,
          due_date: invoiceForm.due_date,
          status: 'pending',
        },
      ]);

      if (!error) {
        setShowInvoiceModal(false);
        setSelectedCompany(null);
        loadBillingData();
      }
    } catch (error) {
      console.error('Error generating invoice:', error);
    }
  };

  const updateInvoiceStatus = async (invoiceId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', invoiceId);

      if (!error) {
        loadBillingData();
      }
    } catch (error) {
      console.error('Error updating invoice:', error);
    }
  };

  const totalRevenue = companies.reduce((sum, company) => {
    return company.is_active ? sum + company.total_monthly : sum;
  }, 0);

  const totalGuards = companies.reduce((sum, company) => sum + company.guard_count, 0);
  const activeCompanies = companies.filter((c) => c.is_active).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (profile?.role !== 'super_admin') {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">Access Denied</h1>
        <p className="text-gray-600">You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Billing Management</h1>
          <p className="text-gray-600 mt-1">Manage subscriptions, invoices, and payments</p>
        </div>
        <button
          onClick={() => setShowSettingsModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          <Settings className="h-5 w-5" />
          <span>Pricing Settings</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Monthly Revenue</p>
              <p className="text-2xl font-bold text-gray-900">${totalRevenue.toLocaleString()}</p>
            </div>
            <div className="bg-green-100 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Companies</p>
              <p className="text-2xl font-bold text-gray-900">{activeCompanies}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-lg">
              <CheckCircle className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Guards</p>
              <p className="text-2xl font-bold text-gray-900">{totalGuards}</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-lg">
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">License Fee</p>
              <p className="text-2xl font-bold text-gray-900">${pricingConfig.license_fee}</p>
              <p className="text-xs text-gray-500">+ ${pricingConfig.monthly_per_guard}/guard</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-lg">
              <DollarSign className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Company Subscriptions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Guards
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Pricing
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Total/Month
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{company.name}</p>
                      <p className="text-sm text-gray-500">{company.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{company.guard_count}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <p className="text-gray-900">
                        ${company.license_fee} + ${company.monthly_per_guard}/guard
                      </p>
                      {(company.custom_license_fee !== null || company.custom_per_guard_fee !== null) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 mt-1">
                          Custom Rate
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-gray-900">
                      ${company.total_monthly.toLocaleString()}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        company.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {company.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col space-y-2">
                      <button
                        onClick={() => openCompanyPricingModal(company)}
                        className="inline-flex items-center space-x-1 text-orange-600 hover:text-orange-700 text-sm font-medium"
                      >
                        <DollarSign className="h-4 w-4" />
                        <span>Edit Pricing</span>
                      </button>
                      <button
                        onClick={() => openInvoiceModal(company)}
                        className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        <Send className="h-4 w-4" />
                        <span>Generate Invoice</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Recent Invoices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Invoice #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No invoices generated yet
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {invoice.invoice_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{invoice.company_name}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      ${invoice.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(invoice.due_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full capitalize ${
                          invoice.status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : invoice.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : invoice.status === 'overdue'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {invoice.status === 'paid' && <CheckCircle className="h-3 w-3 mr-1" />}
                        {invoice.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                        {invoice.status === 'overdue' && <AlertCircle className="h-3 w-3 mr-1" />}
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {invoice.status === 'pending' && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => updateInvoiceStatus(invoice.id, 'paid')}
                            className="text-green-600 hover:text-green-700 text-sm font-medium"
                          >
                            Mark Paid
                          </button>
                          <button
                            onClick={() => updateInvoiceStatus(invoice.id, 'overdue')}
                            className="text-red-600 hover:text-red-700 text-sm font-medium"
                          >
                            Mark Overdue
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showInvoiceModal && selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Generate Invoice</h2>
              <button
                onClick={() => {
                  setShowInvoiceModal(false);
                  setSelectedCompany(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">{selectedCompany.name}</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <p>Guards: {selectedCompany.guard_count}</p>
                <p>License Fee: ${selectedCompany.license_fee}</p>
                <p>Per Guard: ${selectedCompany.monthly_per_guard} × {selectedCompany.guard_count}</p>
                <p className="font-semibold text-gray-900 pt-2 border-t border-gray-200">
                  Total: ${selectedCompany.total_monthly}
                </p>
              </div>
            </div>

            <form onSubmit={generateInvoice} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={invoiceForm.amount}
                  onChange={(e) =>
                    setInvoiceForm({ ...invoiceForm, amount: parseFloat(e.target.value) })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                <input
                  type="date"
                  value={invoiceForm.due_date}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={invoiceForm.description}
                  onChange={(e) =>
                    setInvoiceForm({ ...invoiceForm, description: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowInvoiceModal(false);
                    setSelectedCompany(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Generate Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCompanyPricingModal && selectedCompany && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Custom Pricing</h2>
              <button
                onClick={() => {
                  setShowCompanyPricingModal(false);
                  setSelectedCompany(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">{selectedCompany.name}</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <p>Current Guards: {selectedCompany.guard_count}</p>
                <p>Current Monthly Total: ${selectedCompany.total_monthly}</p>
              </div>
            </div>

            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                Leave fields empty to use global default rates (${pricingConfig.license_fee} license + ${pricingConfig.monthly_per_guard}/guard).
                Set custom values to give this company special pricing.
              </p>
            </div>

            <form onSubmit={updateCompanyPricing} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom License Fee (per month)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={companyPricingForm.custom_license_fee ?? ''}
                    onChange={(e) =>
                      setCompanyPricingForm({
                        ...companyPricingForm,
                        custom_license_fee: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    placeholder={`Default: ${pricingConfig.license_fee}`}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Empty = use default (${pricingConfig.license_fee})
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Per Guard Fee (per guard/month)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={companyPricingForm.custom_per_guard_fee ?? ''}
                    onChange={(e) =>
                      setCompanyPricingForm({
                        ...companyPricingForm,
                        custom_per_guard_fee: e.target.value ? parseFloat(e.target.value) : null,
                      })
                    }
                    placeholder={`Default: ${pricingConfig.monthly_per_guard}`}
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Empty = use default (${pricingConfig.monthly_per_guard})
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">New Pricing Preview:</p>
                <p className="text-sm text-gray-900">
                  License: ${companyPricingForm.custom_license_fee ?? pricingConfig.license_fee}
                </p>
                <p className="text-sm text-gray-900">
                  Per Guard: ${companyPricingForm.custom_per_guard_fee ?? pricingConfig.monthly_per_guard}
                </p>
                <p className="text-sm text-gray-900 mt-2">
                  Total with {selectedCompany.guard_count} guards: <strong>${(
                    (companyPricingForm.custom_license_fee ?? pricingConfig.license_fee) +
                    ((companyPricingForm.custom_per_guard_fee ?? pricingConfig.monthly_per_guard) * selectedCompany.guard_count)
                  ).toFixed(2)}</strong>/month
                </p>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCompanyPricingModal(false);
                    setSelectedCompany(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Custom Pricing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Pricing Settings</h2>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                These rates apply to all companies. Changes will affect future invoice calculations.
              </p>
            </div>

            <form onSubmit={updateBillingSettings} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  License Fee (per company/month)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={pricingConfig.license_fee}
                    onChange={(e) =>
                      setPricingConfig({ ...pricingConfig, license_fee: parseFloat(e.target.value) })
                    }
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Fixed monthly fee charged to each company
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Per Guard Fee (per guard/month)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={pricingConfig.monthly_per_guard}
                    onChange={(e) =>
                      setPricingConfig({
                        ...pricingConfig,
                        monthly_per_guard: parseFloat(e.target.value),
                      })
                    }
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Additional fee per security officer
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">Example Calculation:</p>
                <p className="text-sm text-gray-900">
                  Company with 10 guards:
                </p>
                <p className="text-sm text-gray-900 mt-1">
                  ${pricingConfig.license_fee} + (${pricingConfig.monthly_per_guard} × 10) = <strong>${(pricingConfig.license_fee + (pricingConfig.monthly_per_guard * 10)).toFixed(2)}</strong>/month
                </p>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
