import React, { useState, useEffect } from 'react';
import { 
  dbGetInvoices, 
  dbDeleteInvoice, 
  dbUpdateInvoice,
  dbGetDefaultProfile,
  isMock 
} from '../firebase';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Input, Select } from './ui/input';
import { Button } from './ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { useToast } from './ui/toast';
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  FileText, 
  Search, 
  Trash2, 
  Edit3, 
  Download, 
  CheckCircle, 
  AlertCircle,
  FileWarning,
  CreditCard
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import AdBanner from './AdBanner';
import NativeAdBanner from './NativeAdBanner';

export default function Dashboard({ currentUser, onEditInvoice, triggerRefreshTab }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [targetCurrency, setTargetCurrency] = useState('USD');
  const [exchangeRates, setExchangeRates] = useState({ USD: 1, INR: 83.3, EUR: 0.92, GBP: 0.78, CAD: 1.36, AUD: 1.5 });
  const { toast } = useToast();

  // Load Invoices & Currency configuration
  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const data = await dbGetInvoices(currentUser?.uid);
      setInvoices(data);

      // Check default target currency settings
      if (currentUser?.uid) {
        const profile = await dbGetDefaultProfile(currentUser.uid);
        if (profile && profile.currency) {
          setTargetCurrency(profile.currency);
        } else {
          detectGeoCurrency();
        }
      } else {
        detectGeoCurrency();
      }
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error Fetching Invoices',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const detectGeoCurrency = async () => {
    try {
      const res = await fetch('https://ipapi.co/json/');
      const data = await res.json();
      if (data && data.currency) {
        setTargetCurrency(data.currency);
      }
    } catch (e) {
      console.warn('[GeoCurrency] Fallback location detection failed:', e);
    }
  };

  // Load Real-time Exchange Rates from public API
  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await res.json();
        if (data && data.rates) {
          setExchangeRates(data.rates);
        }
      } catch (err) {
        console.warn('[ExchangeRates] Failed to load exchange rates, using local fallback:', err);
      }
    };
    fetchRates();
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [triggerRefreshTab, currentUser]);

  // Conversion helper
  const getConversionFactor = (fromCurrency, toCurrency) => {
    if (fromCurrency === toCurrency) return 1;
    const fromRate = exchangeRates[fromCurrency] || 1;
    const toRate = exchangeRates[toCurrency] || 1;
    return toRate / fromRate;
  };

  // Statistics calculations with dynamic conversion and overdue dates check
  const stats = React.useMemo(() => {
    let total = 0;
    let paid = 0;
    let pending = 0;
    let overdue = 0;

    invoices.forEach(inv => {
      const conversionFactor = getConversionFactor(inv.currency || 'USD', targetCurrency);
      const amt = (Number(inv.totals?.grandTotal) || 0) * conversionFactor;
      
      const isOverdue = inv.status !== 'paid' && inv.dueDate && new Date(inv.dueDate) < new Date();
      
      total += amt;
      if (inv.status === 'paid') {
        paid += amt;
      } else if (isOverdue) {
        overdue += amt;
      } else {
        pending += amt;
      }
    });

    return { total, paid, pending, overdue };
  }, [invoices, targetCurrency, exchangeRates]);

  // Filters & Search
  const filteredInvoices = React.useMemo(() => {
    return invoices.filter(inv => {
      const matchesSearch = 
        inv.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.clientInfo?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.clientInfo?.email?.toLowerCase().includes(searchTerm.toLowerCase());

      const isOverdue = inv.status !== 'paid' && inv.dueDate && new Date(inv.dueDate) < new Date();
      const currentStatus = isOverdue ? 'overdue' : inv.status;

      const matchesStatus = statusFilter === 'all' || currentStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchTerm, statusFilter]);

  // Format Currency
  const formatCurrency = (val, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(val || 0);
  };

  // Format Date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Toggle paid/pending status
  const handleToggleStatus = async (inv) => {
    const nextStatus = inv.status === 'paid' ? 'pending' : 'paid';
    try {
      await dbUpdateInvoice(inv.id, { status: nextStatus }, currentUser?.uid);
      toast({
        title: 'Invoice Updated',
        description: `Invoice ${inv.invoiceNumber} status set to ${nextStatus}.`,
        variant: 'success'
      });
      fetchInvoices();
    } catch (err) {
      toast({
        title: 'Status Update Failed',
        description: err.message,
        variant: 'destructive'
      });
    }
  };

  /*
  // Razorpay Payment Handler
  const handlePayInvoice = (inv) => {
    const conversionFactor = getConversionFactor(inv.currency || 'USD', 'INR');
    const amountInInr = Math.round((Number(inv.totals?.grandTotal) || 0) * conversionFactor * 100);

    const options = {
      key: 'rzp_test_T9USe3K9T3MK8G', // Test API Key provided
      amount: amountInInr, // Amount in paise
      currency: 'INR',
      name: 'BillStacker Platform',
      description: `Invoice Payment #${inv.invoiceNumber}`,
      image: 'https://cdn-icons-png.flaticon.com/512/625/625599.png',
      handler: async function (response) {
        try {
          await dbUpdateInvoice(inv.id, { status: 'paid', razorpayPaymentId: response.razorpay_payment_id }, currentUser?.uid);
          toast({
            title: 'Payment Successful',
            description: `Invoice #${inv.invoiceNumber} paid via Razorpay! ID: ${response.razorpay_payment_id}`,
            variant: 'success'
          });
          fetchInvoices();
        } catch (err) {
          toast({
            title: 'Update Failed',
            description: err.message,
            variant: 'destructive'
          });
        }
      },
      prefill: {
        name: inv.clientInfo?.name || '',
        email: inv.clientInfo?.email || '',
      },
      theme: {
        color: '#7c3aed',
      }
    };

    if (window.Razorpay) {
      const rzp = new window.Razorpay(options);
      rzp.open();
    } else {
      toast({
        title: 'Razorpay SDK Error',
        description: 'Failed to load Razorpay library. Please refresh and try again.',
        variant: 'destructive'
      });
    }
  };
  */

  // Delete Invoice Confirmed
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await dbDeleteInvoice(deleteTarget.id, currentUser?.uid);
      toast({
        title: 'Invoice Deleted',
        description: `Successfully deleted invoice ${deleteTarget.invoiceNumber}.`,
        variant: 'success'
      });
      setDeleteTarget(null);
      fetchInvoices();
    } catch (err) {
      toast({
        title: 'Deletion Failed',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // PDF Export Trigger (for past invoices, generates a standard invoice structure)
  const handleExportPDF = async (inv) => {
    toast({
      title: 'Generating PDF',
      description: 'Rendering documents, please wait...',
    });

    // Create a temporary hidden DOM element to render the invoice beautifully and capture it.
    const element = document.createElement('div');
    element.style.position = 'fixed';
    element.style.left = '-9999px';
    element.style.top = '-9999px';
    element.style.width = '800px';
    element.style.padding = '40px';
    element.style.backgroundColor = '#ffffff';
    element.style.color = '#1e293b'; // slate-800
    element.style.fontFamily = 'system-ui, sans-serif';

    const invoiceHtml = `
      <div style="display:flex; justify-content:space-between; margin-bottom: 40px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px;">
        <div>
          ${inv.senderInfo?.logoUrl ? `<img src="${inv.senderInfo.logoUrl}" style="max-height:60px; max-width:150px; margin-bottom:10px; display:block;" />` : ''}
          <h2 style="margin:0; font-size:24px; color:#4c1d95;">${inv.senderInfo?.name || 'Company Name'}</h2>
          <p style="margin:2px 0; font-size:12px; color:#64748b;">${inv.senderInfo?.email || ''}</p>
          <p style="margin:2px 0; font-size:12px; color:#64748b;">${inv.senderInfo?.address || ''}</p>
          <p style="margin:2px 0; font-size:12px; color:#64748b;">${inv.senderInfo?.phone || ''}</p>
        </div>
        <div style="text-align:right;">
          <h1 style="margin:0; font-size:28px; font-weight:800; color:#1e293b;">INVOICE</h1>
          <p style="margin:5px 0; font-size:14px; font-weight:bold;"># ${inv.invoiceNumber}</p>
          <p style="margin:2px 0; font-size:12px; color:#64748b;">Date: ${formatDate(inv.invoiceDate)}</p>
          <p style="margin:2px 0; font-size:12px; color:#64748b;">Due Date: ${formatDate(inv.dueDate)}</p>
          <div style="margin-top:10px; display:inline-block; padding: 4px 10px; border-radius:12px; font-size:10px; text-transform:uppercase; font-weight:bold; background-color: ${inv.status === 'paid' ? '#d1fae5' : '#fef3c7'}; color: ${inv.status === 'paid' ? '#065f46' : '#92400e'};">
            ${inv.status}
          </div>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; margin-bottom: 40px;">
        <div style="width:48%;">
          <h3 style="margin:0 0 8px 0; font-size:14px; color:#64748b; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">BILL TO</h3>
          <h4 style="margin:0; font-size:16px; color:#1e293b;">${inv.clientInfo?.name || 'Client Name'}</h4>
          <p style="margin:2px 0; font-size:12px; color:#64748b;">${inv.clientInfo?.email || ''}</p>
          <p style="margin:2px 0; font-size:12px; color:#64748b;">${inv.clientInfo?.address || ''}</p>
          <p style="margin:2px 0; font-size:12px; color:#64748b;">${inv.clientInfo?.phone || ''}</p>
        </div>
        <div style="width:48%; text-align:right;">
          <h3 style="margin:0 0 8px 0; font-size:14px; color:#64748b; border-bottom:1px solid #e2e8f0; padding-bottom:4px;">PAYMENT DETAILS</h3>
          <p style="margin:2px 0; font-size:12px; color:#64748b;">Currency: <strong>${inv.currency || 'USD'}</strong></p>
          <p style="margin:2px 0; font-size:12px; color:#64748b;">Payment Method: ${inv.paymentDetails?.method || 'N/A'}</p>
          <p style="margin:2px 0; font-size:12px; color:#64748b;">Terms: ${inv.paymentDetails?.terms || 'N/A'}</p>
        </div>
      </div>

      <table style="width:100%; border-collapse:collapse; margin-bottom: 30px;">
        <thead>
          <tr style="background-color:#f8fafc; border-bottom: 2px solid #e2e8f0;">
            <th style="padding:10px 5px; text-align:left; font-size:12px; color:#475569;">Description</th>
            <th style="padding:10px 5px; text-align:center; font-size:12px; color:#475569; width:80px;">Qty</th>
            <th style="padding:10px 5px; text-align:right; font-size:12px; color:#475569; width:120px;">Rate</th>
            <th style="padding:10px 5px; text-align:right; font-size:12px; color:#475569; width:120px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${inv.items?.map(item => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding:12px 5px; font-size:13px; color:#1e293b;">
                <strong>${item.description}</strong>
                ${item.details ? `<br/><span style="font-size:11px; color:#64748b;">${item.details}</span>` : ''}
              </td>
              <td style="padding:12px 5px; text-align:center; font-size:13px; color:#1e293b;">${item.quantity}</td>
              <td style="padding:12px 5px; text-align:right; font-size:13px; color:#1e293b;">${formatCurrency(item.rate, inv.currency)}</td>
              <td style="padding:12px 5px; text-align:right; font-size:13px; color:#1e293b; font-weight:500;">${formatCurrency(item.quantity * item.rate, inv.currency)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div style="width:50%; font-size:12px; color:#64748b;">
          ${inv.notes ? `<h4 style="margin:0 0 5px 0; color:#475569;">Notes</h4><p style="margin:0; line-height:1.4;">${inv.notes}</p>` : ''}
        </div>
        <div style="width:40%; text-align:right;">
          <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;">
            <span style="color:#64748b;">Subtotal:</span>
            <span style="font-weight:500;">${formatCurrency(inv.totals?.subtotal, inv.currency)}</span>
          </div>
          ${inv.totals?.taxAmount > 0 ? `
            <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;">
              <span style="color:#64748b;">Tax (${inv.taxRate || 0}%):</span>
              <span style="color:#475569;">${formatCurrency(inv.totals.taxAmount, inv.currency)}</span>
            </div>
          ` : ''}
          ${inv.totals?.discountAmount > 0 ? `
            <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;">
              <span style="color:#64748b;">Discount:</span>
              <span style="color:#b91c1c;">-${formatCurrency(inv.totals.discountAmount, inv.currency)}</span>
            </div>
          ` : ''}
          <div style="display:flex; justify-content:space-between; margin-top:10px; border-top:2px solid #1e293b; padding-top:10px; font-size:16px; font-weight:800; color:#1e293b;">
            <span>Total:</span>
            <span style="color:#4c1d95;">${formatCurrency(inv.totals?.grandTotal, inv.currency)}</span>
          </div>
        </div>
      </div>
      ${!currentUser?.isPremium ? `
        <div style="margin-top: 50px; border-top: 1px dashed #cbd5e1; padding-top: 15px; text-align: center; font-size: 10px; color: #94a3b8; font-family: system-ui, sans-serif;">
          Powered by <strong>BillStacker</strong> • Free Invoice Suite
        </div>
      ` : ''}
    `;

    element.innerHTML = invoiceHtml;
    document.body.appendChild(element);

    try {
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'a4'
      });
      const imgWidth = 595.28; // A4 width in pt
      const pageHeight = 841.89; // A4 height in pt
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`invoice_${inv.invoiceNumber}.pdf`);
      toast({
        title: 'PDF Exported',
        description: `Invoice ${inv.invoiceNumber} successfully downloaded.`,
        variant: 'success'
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'PDF Generation Failed',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      document.body.removeChild(element);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      
      {/* Sandbox & Auth alerts */}
      {isMock && (
        <div className="flex items-center gap-3 p-3 bg-violet-950/40 border border-violet-800/60 rounded-xl text-violet-250 text-xs">
          <AlertCircle className="w-5 h-5 text-violet-400 shrink-0" />
          <div>
            <span className="font-semibold text-violet-300">Sandbox Mode:</span> LocalStorage fallback active. Add your Firebase credentials inside <code className="bg-slate-900 px-1.5 py-0.5 rounded font-mono text-[10px] text-white">.env</code> to activate cloud functions.
          </div>
        </div>
      )}

      {!currentUser && (
        <div className="flex items-center justify-between p-3.5 bg-violet-950/20 border border-violet-900/30 rounded-xl text-violet-250 text-xs sm:text-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-violet-400 shrink-0" />
            <div>
              <span className="font-semibold text-violet-300">You are in Guest Mode (Local Sandbox).</span> Sign in using Google at the bottom of the sidebar to enable cloud sync, document persistence, and automatic profile pre-filling.
            </div>
          </div>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-violet-600/10 rounded-full blur-2xl group-hover:bg-violet-600/20 transition-all" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total Revenue</CardTitle>
            <div className="p-2 rounded-lg bg-violet-600/10 text-violet-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{formatCurrency(stats.total, targetCurrency)}</div>
            <p className="text-xs text-slate-500 mt-1">Aggregated platform invoices</p>
          </CardContent>
        </Card>

        <Card className="glass-card relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-600/10 rounded-full blur-2xl group-hover:bg-emerald-600/20 transition-all" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Collected</CardTitle>
            <div className="p-2 rounded-lg bg-emerald-600/10 text-emerald-400">
              <CheckCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">{formatCurrency(stats.paid, targetCurrency)}</div>
            <p className="text-xs text-slate-500 mt-1">Invoices marked as paid</p>
          </CardContent>
        </Card>

        <Card className="glass-card relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-600/10 rounded-full blur-2xl group-hover:bg-amber-600/20 transition-all" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Outstanding</CardTitle>
            <div className="p-2 rounded-lg bg-amber-600/10 text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-400">{formatCurrency(stats.pending, targetCurrency)}</div>
            <p className="text-xs text-slate-500 mt-1">Awaiting client payment</p>
          </CardContent>
        </Card>

        <Card className="glass-card relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-600/10 rounded-full blur-2xl group-hover:bg-rose-600/20 transition-all" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Overdue</CardTitle>
            <div className="p-2 rounded-lg bg-rose-600/10 text-rose-450">
              <FileWarning className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-450">{formatCurrency(stats.overdue, targetCurrency)}</div>
            <p className="text-xs text-slate-500 mt-1">Past payment date limit</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Table Container */}
      <Card className="glass-panel">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold">Invoice History</CardTitle>
              <CardDescription>View, edit, toggle, and download generated client invoices</CardDescription>
            </div>
            
            {/* Search & Filter tools */}
            <div className="flex flex-wrap gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input
                  className="pl-9 h-10 w-full"
                  placeholder="Search invoice #, client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select
                className="w-36 h-10"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-t-2 border-r-2 border-violet-500 rounded-full animate-spin" />
              <p className="text-sm text-slate-400 font-medium">Fetching invoice log...</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="mx-auto h-12 w-12 text-slate-600 mb-3" />
              <h3 className="text-lg font-semibold text-slate-200">No invoices found</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                {invoices.length === 0 
                  ? "You haven't generated any invoices yet. Head over to the Invoice Builder tab to create one."
                  : "No invoices match the search query or status filters selected above."
                }
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Invoice No.</TableHead>
                  <TableHead className="font-semibold">Client Name</TableHead>
                  <TableHead className="font-semibold">Issue Date</TableHead>
                  <TableHead className="font-semibold">Due Date</TableHead>
                  <TableHead className="font-semibold text-right">Grand Total</TableHead>
                  <TableHead className="font-semibold text-center">Status</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono font-bold text-white">
                      {inv.invoiceNumber}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-slate-200">{inv.clientInfo?.name || 'N/A'}</div>
                      <div className="text-xs text-slate-500">{inv.clientInfo?.email || ''}</div>
                    </TableCell>
                    <TableCell className="text-slate-400">{formatDate(inv.invoiceDate)}</TableCell>
                    <TableCell className="text-slate-400">{formatDate(inv.dueDate)}</TableCell>
                    <TableCell className="text-right font-bold text-white">
                      {formatCurrency(inv.totals?.grandTotal, inv.currency)}
                    </TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        const isOverdue = inv.status !== 'paid' && inv.dueDate && new Date(inv.dueDate) < new Date();
                        const displayStatus = isOverdue ? 'overdue' : inv.status;
                        return (
                          <button
                            onClick={() => handleToggleStatus(inv)}
                            title="Click to toggle status"
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider cursor-pointer border transition-all select-none hover:scale-105 active:scale-95 ${
                              displayStatus === 'paid'
                                ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-450 hover:bg-emerald-900/40'
                                : displayStatus === 'pending'
                                ? 'bg-amber-950/40 border-amber-800/80 text-amber-450 hover:bg-amber-900/40'
                                : 'bg-rose-950/40 border-rose-800/80 text-rose-450 hover:bg-rose-900/40'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              displayStatus === 'paid' ? 'bg-emerald-500' : displayStatus === 'pending' ? 'bg-amber-500' : 'bg-rose-500'
                            }`} />
                            {displayStatus}
                          </button>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* 
                        {(() => {
                          const isOverdue = inv.status !== 'paid' && inv.dueDate && new Date(inv.dueDate) < new Date();
                          const displayStatus = isOverdue ? 'overdue' : inv.status;
                          return displayStatus !== 'paid' && (
                            <Button
                              variant="outline"
                              size="sm"
                              title="Pay via Razorpay"
                              onClick={() => handlePayInvoice(inv)}
                              className="h-8 px-2 text-[10px] font-bold border-violet-500/30 text-violet-400 hover:bg-violet-650 hover:text-white shrink-0"
                            >
                              <CreditCard className="h-3 w-3 mr-1" />
                              Pay
                            </Button>
                          );
                        })()}
                        */}
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Download PDF"
                          onClick={() => handleExportPDF(inv)}
                          className="h-8 w-8 text-slate-400 hover:text-white"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit Invoice"
                          onClick={() => onEditInvoice(inv)}
                          className="h-8 w-8 text-slate-400 hover:text-white"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete Invoice"
                          onClick={() => setDeleteTarget(inv)}
                          className="h-8 w-8 text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Adsterra Banners & Native Ads */}
      <div className="space-y-4 mt-8">
        <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest text-center">Sponsored Updates</div>
        <NativeAdBanner isPremium={currentUser?.isPremium} />
        {!currentUser?.isPremium && (
              <div className="py-4 border-t border-b border-slate-850/80 my-4">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center mb-2">Sponsor Feedback & Offers</div>
                <NativeAdBanner isPremium={currentUser?.isPremium} />
              </div>
            )}
        {/* Responsive footer banner */}
        <AdBanner 
          adKey="fc0ded85e24429b5a4db05e69a625aee" 
          format="iframe" 
          width={728} 
          height={90} 
          className="hidden md:flex mx-auto" 
          isPremium={currentUser?.isPremium}
        />
        <AdBanner 
          adKey="8933000d942a27ecc84dd3451f31535c" 
          format="iframe" 
          width={320} 
          height={50} 
          className="flex md:hidden mx-auto" 
          isPremium={currentUser?.isPremium}
        />
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogHeader>
          <DialogTitle className="text-slate-100">Delete Invoice</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete invoice <span className="text-white font-semibold font-mono">{deleteTarget?.invoiceNumber}</span>? This action is permanent and cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            isLoading={isDeleting}
            onClick={handleDeleteConfirm}
          >
            Delete
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
