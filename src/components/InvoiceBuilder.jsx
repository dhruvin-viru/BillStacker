import React, { useState, useEffect } from 'react';
import { 
  dbSaveInvoice, 
  dbUpdateInvoice, 
  dbUploadLogo, 
  isMock,
  dbSaveDefaultProfile,
  dbGetDefaultProfile
} from '../firebase';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input, Textarea, Select, Label } from './ui/input';
import { Button } from './ui/button';
import { useToast } from './ui/toast';
import AdBanner from './AdBanner';
import NativeAdBanner from './NativeAdBanner';
import { 
  Plus, 
  Trash2, 
  Download, 
  Save, 
  RefreshCw, 
  Upload, 
  X, 
  AlertCircle,
  FileText,
  FileCheck2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const initialInvoiceState = {
  invoiceNumber: 'INV-' + Math.floor(1000 + Math.random() * 9000),
  invoiceDate: new Date().toISOString().split('T')[0],
  dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 14 days later
  currency: 'USD',
  status: 'pending',
  senderInfo: {
    name: '',
    email: '',
    address: '',
    phone: '',
    logoUrl: ''
  },
  clientInfo: {
    name: '',
    email: '',
    address: '',
    phone: ''
  },
  items: [
    { description: 'Consulting Services', details: 'Project scoping and wireframing', quantity: 1, rate: 120 }
  ],
  paymentDetails: {
    method: 'Bank Transfer',
    terms: 'Net 14'
  },
  taxRate: 0,
  discountRate: 0,
  notes: 'Thank you for your business. Please make payments within the due date.',
};

// Styles and typography mapping for 10 invoice templates
const getTemplateStyles = (template) => {
  const defaultStyles = {
    fontFamily: 'system-ui, sans-serif',
    bgColor: 'bg-white',
    textColor: 'text-slate-800',
    primaryColor: 'text-violet-900',
    accentColor: 'bg-violet-900',
    borderColor: 'border-slate-100',
    tableHeaderBg: 'bg-slate-50',
    tableHeaderTextColor: 'text-slate-500',
    totalsBorderColor: 'border-slate-800',
    totalsTextColor: 'text-violet-900',
    badgeBg: 'bg-slate-100',
    badgeTextColor: 'text-slate-700',
    containerPadding: 'p-8',
    titleColor: 'text-slate-800',
    topStripe: 'border-t-0',
  };

  switch (template) {
    case 'corporate':
      return {
        ...defaultStyles,
        primaryColor: 'text-indigo-900',
        accentColor: 'bg-indigo-900',
        borderColor: 'border-indigo-100',
        tableHeaderBg: 'bg-indigo-900',
        tableHeaderTextColor: 'text-white',
        totalsTextColor: 'text-indigo-900',
        badgeBg: 'bg-indigo-50',
        badgeTextColor: 'text-indigo-800',
        topStripe: 'border-t-[6px] border-indigo-900',
      };
    case 'compact':
      return {
        ...defaultStyles,
        containerPadding: 'p-5',
        primaryColor: 'text-emerald-800',
        accentColor: 'bg-emerald-800',
        borderColor: 'border-slate-100',
        tableHeaderBg: 'bg-slate-50',
        totalsTextColor: 'text-emerald-800',
        badgeBg: 'bg-emerald-50',
        badgeTextColor: 'text-emerald-800',
      };
    case 'retro':
      return {
        ...defaultStyles,
        fontFamily: 'Georgia, serif',
        primaryColor: 'text-amber-950',
        accentColor: 'bg-amber-950',
        borderColor: 'border-amber-200',
        tableHeaderBg: 'bg-amber-50/50',
        totalsBorderColor: 'border-amber-950',
        totalsTextColor: 'text-amber-950',
        badgeBg: 'bg-amber-100/70',
        badgeTextColor: 'text-amber-900',
        titleColor: 'text-amber-950',
        topStripe: 'border-t-[4px] border-amber-950',
      };
    case 'bold':
      return {
        ...defaultStyles,
        primaryColor: 'text-pink-700',
        accentColor: 'bg-pink-700',
        borderColor: 'border-slate-200',
        tableHeaderBg: 'bg-pink-700',
        tableHeaderTextColor: 'text-white',
        totalsTextColor: 'text-pink-700',
        badgeBg: 'bg-pink-50',
        badgeTextColor: 'text-pink-800',
        titleColor: 'text-pink-900',
        topStripe: 'border-t-[8px] border-pink-700',
      };
    case 'tech':
      return {
        ...defaultStyles,
        fontFamily: 'Courier New, monospace',
        primaryColor: 'text-cyan-800',
        accentColor: 'bg-cyan-800',
        borderColor: 'border-slate-300 border-dashed',
        tableHeaderBg: 'bg-slate-100',
        totalsBorderColor: 'border-slate-900 border-dashed',
        totalsTextColor: 'text-cyan-900',
        badgeBg: 'bg-slate-100',
        badgeTextColor: 'text-slate-800',
      };
    case 'classic':
      return {
        ...defaultStyles,
        fontFamily: 'Times New Roman, serif',
        primaryColor: 'text-slate-900',
        accentColor: 'bg-slate-900',
        borderColor: 'border-slate-300',
        tableHeaderBg: 'bg-transparent border-t border-b border-slate-400',
        tableHeaderTextColor: 'text-slate-800',
        totalsTextColor: 'text-slate-900',
        badgeBg: 'bg-slate-100',
        badgeTextColor: 'text-slate-900',
      };
    case 'borderless':
      return {
        ...defaultStyles,
        primaryColor: 'text-slate-700',
        accentColor: 'bg-transparent',
        borderColor: 'border-transparent',
        tableHeaderBg: 'bg-transparent border-b border-slate-100',
        tableHeaderTextColor: 'text-slate-400',
        totalsTextColor: 'text-slate-800',
        badgeBg: 'bg-slate-50',
        badgeTextColor: 'text-slate-600',
      };
    case 'dark':
      return {
        ...defaultStyles,
        bgColor: 'bg-slate-900',
        textColor: 'text-slate-200',
        primaryColor: 'text-violet-400',
        accentColor: 'bg-violet-600',
        borderColor: 'border-slate-800',
        tableHeaderBg: 'bg-slate-950',
        tableHeaderTextColor: 'text-slate-400',
        totalsBorderColor: 'border-violet-500',
        totalsTextColor: 'text-violet-400',
        badgeBg: 'bg-slate-950',
        badgeTextColor: 'text-violet-400',
        titleColor: 'text-white',
      };
    default:
      return defaultStyles;
  }
};

export default function InvoiceBuilder({ currentUser, editInvoiceData, onSaveSuccess }) {
  const [invoice, setInvoice] = useState(initialInvoiceState);
  const [logoFile, setLogoFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { toast } = useToast();
  
  const isEditing = !!editInvoiceData;

  // Load Default Profile on Login / Geolocation fallback
  useEffect(() => {
    const loadDefaultProfile = async () => {
      let profileLoaded = false;
      if (currentUser?.uid && !isEditing) {
        try {
          const profile = await dbGetDefaultProfile(currentUser.uid);
          if (profile) {
            setInvoice(prev => ({
              ...prev,
              senderInfo: { ...prev.senderInfo, ...profile.senderInfo },
              currency: profile.currency || prev.currency,
              paymentDetails: { ...prev.paymentDetails, ...profile.paymentDetails }
            }));
            profileLoaded = true;
            toast({
              title: 'Default Profile Loaded',
              description: 'Your default company and payment options have been loaded.',
              variant: 'success'
            });
          }
        } catch (err) {
          console.error('[Profile Load Error]', err);
        }
      }

      // Geo IP detection if no profile currency was loaded and we are not editing
      if (!profileLoaded && !isEditing) {
        try {
          const res = await fetch('https://ipapi.co/json/');
          const data = await res.json();
          if (data && data.currency) {
            setInvoice(prev => ({
              ...prev,
              currency: data.currency
            }));
          }
        } catch (err) {
          console.warn('[GeoCurrency] Fallback location detection failed:', err);
        }
      }
    };
    loadDefaultProfile();
  }, [currentUser, isEditing]);

  // Reset sender/payment info on logout
  useEffect(() => {
    if (!currentUser && !isEditing) {
      setInvoice(prev => ({
        ...prev,
        senderInfo: initialInvoiceState.senderInfo,
        paymentDetails: initialInvoiceState.paymentDetails,
        currency: initialInvoiceState.currency
      }));
    }
  }, [currentUser, isEditing]);

  // Save Default Profile settings
  const handleSaveDefaultProfile = async () => {
    if (!currentUser) return;
    try {
      setIsSaving(true);
      let logoUrl = invoice.senderInfo.logoUrl;

      if (logoFile) {
        setIsUploading(true);
        const uploadedUrl = await dbUploadLogo(logoFile);
        if (uploadedUrl) {
          logoUrl = uploadedUrl;
        }
        setIsUploading(false);
      }

      const profileData = {
        senderInfo: {
          ...invoice.senderInfo,
          logoUrl
        },
        currency: invoice.currency,
        paymentDetails: invoice.paymentDetails
      };

      await dbSaveDefaultProfile(currentUser.uid, profileData);
      
      // Sync the uploaded logo in state
      setInvoice(prev => ({
        ...prev,
        senderInfo: { ...prev.senderInfo, logoUrl }
      }));
      setLogoFile(null);

      toast({
        title: 'Default Saved',
        description: 'Your standard profile is now saved as the default configuration.',
        variant: 'success'
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Profile Save Failed',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  };



  // Sync edit state
  useEffect(() => {
    if (editInvoiceData) {
      setInvoice(editInvoiceData);
    } else {
      setInvoice({
        ...initialInvoiceState,
        invoiceNumber: 'INV-' + Math.floor(1000 + Math.random() * 9000)
      });
    }
    setLogoFile(null);
  }, [editInvoiceData]);

  // Recalculate totals
  const totals = React.useMemo(() => {
    const subtotal = invoice.items.reduce((sum, item) => sum + (item.quantity * item.rate), 0);
    const taxAmount = parseFloat(((subtotal * (invoice.taxRate || 0)) / 100).toFixed(2));
    const discountAmount = parseFloat(((subtotal * (invoice.discountRate || 0)) / 100).toFixed(2));
    const grandTotal = parseFloat((subtotal + taxAmount - discountAmount).toFixed(2));

    return { subtotal, taxAmount, discountAmount, grandTotal };
  }, [invoice.items, invoice.taxRate, invoice.discountRate]);

  // Handle logo change
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: 'File Too Large',
          description: 'Logo size must be less than 2MB.',
          variant: 'destructive'
        });
        return;
      }
      setLogoFile(file);
      // Generate object url for immediate preview
      const previewUrl = URL.createObjectURL(file);
      setInvoice(prev => ({
        ...prev,
        senderInfo: { ...prev.senderInfo, logoUrl: previewUrl }
      }));
    }
  };

  // Remove Logo
  const handleRemoveLogo = () => {
    setLogoFile(null);
    setInvoice(prev => ({
      ...prev,
      senderInfo: { ...prev.senderInfo, logoUrl: '' }
    }));
  };

  // Handle Input Changes
  const handleSenderChange = (field, val) => {
    setInvoice(prev => ({
      ...prev,
      senderInfo: { ...prev.senderInfo, [field]: val }
    }));
  };

  const handleClientChange = (field, val) => {
    setInvoice(prev => ({
      ...prev,
      clientInfo: { ...prev.clientInfo, [field]: val }
    }));
  };

  const handlePaymentChange = (field, val) => {
    setInvoice(prev => ({
      ...prev,
      paymentDetails: { ...prev.paymentDetails, [field]: val }
    }));
  };

  // Line item handlers
  const handleItemChange = (index, field, val) => {
    const newItems = [...invoice.items];
    newItems[index] = {
      ...newItems[index],
      [field]: field === 'description' || field === 'details' ? val : Number(val) || 0
    };
    setInvoice(prev => ({ ...prev, items: newItems }));
  };

  const handleAddItem = () => {
    setInvoice(prev => ({
      ...prev,
      items: [...prev.items, { description: '', details: '', quantity: 1, rate: 0 }]
    }));
  };

  const handleRemoveItem = (index) => {
    if (invoice.items.length <= 1) {
      toast({
        title: 'Cannot Delete Row',
        description: 'You need at least 1 item in the invoice.',
        variant: 'destructive'
      });
      return;
    }
    const newItems = invoice.items.filter((_, i) => i !== index);
    setInvoice(prev => ({ ...prev, items: newItems }));
  };

  // Reset Form
  const handleReset = () => {
    setInvoice({
      ...initialInvoiceState,
      invoiceNumber: 'INV-' + Math.floor(1000 + Math.random() * 9000)
    });
    setLogoFile(null);
    toast({
      title: 'Form Reset',
      description: 'The invoice builder has been cleared.'
    });
  };

  // Save/Update Invoice Handler
  const handleSaveInvoice = async (saveAsNewCopy = false) => {
    if (!invoice.invoiceNumber) {
      toast({
        title: 'Validation Error',
        description: 'Please provide an invoice number.',
        variant: 'destructive'
      });
      return;
    }
    if (!invoice.clientInfo.name) {
      toast({
        title: 'Validation Error',
        description: 'Please provide client name.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsSaving(true);
      let logoUrl = invoice.senderInfo.logoUrl;

      // Upload logo if it's a new file
      if (logoFile) {
        setIsUploading(true);
        const uploadedUrl = await dbUploadLogo(logoFile);
        if (uploadedUrl) {
          logoUrl = uploadedUrl;
        }
        setIsUploading(false);
      }

      const finalInvoiceData = {
        ...invoice,
        senderInfo: {
          ...invoice.senderInfo,
          logoUrl
        },
        totals
      };

      if (isEditing && !saveAsNewCopy) {
        // Update existing invoice
        await dbUpdateInvoice(invoice.id, finalInvoiceData, currentUser?.uid);
        toast({
          title: 'Invoice Updated',
          description: `Invoice ${invoice.invoiceNumber} updated successfully.`,
          variant: 'success'
        });
      } else {
        // Save new invoice
        const saved = await dbSaveInvoice(finalInvoiceData, currentUser?.uid);
        toast({
          title: 'Invoice Saved',
          description: `Invoice ${saved.invoiceNumber} created and saved in log.`,
          variant: 'success'
        });
      }

      // Spark confetti
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 }
      });

      // Reset / callback
      onSaveSuccess();
    } catch (err) {
      console.error(err);
      toast({
        title: 'Saving Failed',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  };

  // Generate and Download PDF
  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    toast({
      title: 'Compiling PDF',
      description: 'Creating high-fidelity vector rendering...'
    });

    const element = document.getElementById('invoice-preview-sheet');
    if (!element) {
      toast({
        title: 'Error',
        description: 'Preview document element could not be found.',
        variant: 'destructive'
      });
      setIsGeneratingPdf(false);
      return;
    }

    try {
      // Temporarily scale up element styling to make canvas print crisp
      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
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

      pdf.save(`invoice_${invoice.invoiceNumber}.pdf`);
      
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.8 }
      });

      toast({
        title: 'Download Started',
        description: 'Your invoice PDF has been downloaded.',
        variant: 'success'
      });
    } catch (err) {
      console.error('PDF Download Error:', err);
      toast({
        title: 'PDF Export Failed',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: invoice.currency,
    }).format(val || 0);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in-50 duration-300">
      
      {/* Left Pane - Forms (Full Width) */}
      <div className="space-y-6">
        
        {!currentUser && (
          <div className="flex items-center gap-3 p-3 bg-violet-950/20 border border-violet-900/40 rounded-xl text-violet-250 text-xs">
            <AlertCircle className="w-4 h-4 text-violet-400 shrink-0" />
            <div>
              <span className="font-bold text-violet-300">Tip:</span> Sign in with Google (at the bottom of the sidebar) to save this company profile as default so it pre-fills automatically!
            </div>
          </div>
        )}

        {isEditing && (
          <div className="flex items-center justify-between p-4 bg-violet-950/30 border border-violet-850 rounded-xl">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-violet-400" />
              <div className="text-sm text-violet-250">
                You are currently editing invoice <strong className="text-white font-mono">{invoice.invoiceNumber}</strong>
              </div>
            </div>
            <Button size="sm" variant="ghost" className="text-xs h-7 text-slate-400 hover:text-white" onClick={onSaveSuccess}>
              Exit Edit Mode
            </Button>
          </div>
        )}

        {/* 1. Header Info */}
        <Card className="glass-panel">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <Label>Invoice #</Label>
              <Input 
                value={invoice.invoiceNumber}
                onChange={(e) => setInvoice(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                className="font-mono"
              />
            </div>
            <div>
              <Label>Issue Date</Label>
              <Input 
                type="date"
                value={invoice.invoiceDate}
                onChange={(e) => setInvoice(prev => ({ ...prev, invoiceDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input 
                type="date"
                value={invoice.dueDate}
                onChange={(e) => setInvoice(prev => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>Currency</Label>
              <Select 
                value={invoice.currency}
                onChange={(e) => setInvoice(prev => ({ ...prev, currency: e.target.value }))}
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD ($)</option>
                <option value="INR">INR (₹)</option>
                <option value="AUD">AUD ($)</option>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* 1.5 Template Selector */}
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Design Layout Theme</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="w-full sm:w-1/2">
                <Label>Select Template</Label>
                <Select
                  value={invoice.selectedTemplate || 'default'}
                  onChange={(e) => setInvoice(prev => ({ ...prev, selectedTemplate: e.target.value }))}
                >
                  <option value="default">Minimal Violet (Default)</option>
                  <option value="corporate">Corporate Indigo</option>
                  <option value="creative">Creative Split Columns</option>
                  <option value="compact">Slate Compact</option>
                  <option value="retro">Retro Editorial</option>
                  <option value="bold">Bold Stripe</option>
                  <option value="tech">Tech Monospace</option>
                  <option value="classic">Classic Ruler</option>
                  <option value="borderless">Borderless Minimal</option>
                  <option value="dark">Charcoal Dark Mode</option>
                </Select>
              </div>
              <div className="text-xs text-slate-400 leading-relaxed pl-1">
                Instantly restyles the live preview canvas and the generated vector PDF.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Sender Details */}
        <Card className="glass-panel">
          <CardHeader className="pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Sender (Company Info)</CardTitle>
            
            {/* Logo Upload & Profile Save */}
            <div className="flex items-center gap-2">
              {currentUser && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1 border-violet-850 hover:bg-violet-600 hover:text-white"
                  onClick={handleSaveDefaultProfile}
                  title="Save company details as default for new invoices"
                >
                  Save as Default
                </Button>
              )}

              {invoice.senderInfo.logoUrl ? (
                <div className="flex items-center gap-1.5 border border-slate-700 bg-slate-950 px-2.5 py-1 rounded-md">
                  <span className="text-xs text-slate-400 truncate max-w-[80px]">Logo Attached</span>
                  <button type="button" onClick={handleRemoveLogo} className="text-rose-500 hover:text-rose-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-1 bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all border border-slate-700">
                  <Upload className="w-3.5 h-3.5" />
                  Upload Logo
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </label>
              )}
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Company Name</Label>
              <Input 
                placeholder="Google DeepMind"
                value={invoice.senderInfo.name}
                onChange={(e) => handleSenderChange('name', e.target.value)}
              />
            </div>
            <div>
              <Label>Company Email</Label>
              <Input 
                type="email"
                placeholder="billing@deepmind.com"
                value={invoice.senderInfo.email}
                onChange={(e) => handleSenderChange('email', e.target.value)}
              />
            </div>
            <div>
              <Label>Company Address</Label>
              <Input 
                placeholder="6 Pancras Square, London"
                value={invoice.senderInfo.address}
                onChange={(e) => handleSenderChange('address', e.target.value)}
              />
            </div>
            <div>
              <Label>Company Phone</Label>
              <Input 
                placeholder="+44 20 7031 3000"
                value={invoice.senderInfo.phone}
                onChange={(e) => handleSenderChange('phone', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 3. Client Details */}
        <Card className="glass-panel">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Bill To (Client Info)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Client Name</Label>
              <Input 
                placeholder="Alphabet Inc."
                value={invoice.clientInfo.name}
                onChange={(e) => handleClientChange('name', e.target.value)}
              />
            </div>
            <div>
              <Label>Client Email</Label>
              <Input 
                type="email"
                placeholder="accounts@abc.xyz"
                value={invoice.clientInfo.email}
                onChange={(e) => handleClientChange('email', e.target.value)}
              />
            </div>
            <div>
              <Label>Client Address</Label>
              <Input 
                placeholder="1600 Amphitheatre Pkwy, Mountain View"
                value={invoice.clientInfo.address}
                onChange={(e) => handleClientChange('address', e.target.value)}
              />
            </div>
            <div>
              <Label>Client Phone</Label>
              <Input 
                placeholder="+1 650-253-0000"
                value={invoice.clientInfo.phone}
                onChange={(e) => handleClientChange('phone', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 4. Line Items */}
        <Card className="glass-panel">
          <CardHeader className="pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Invoice Items</CardTitle>
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={handleAddItem}>
              <Plus className="w-4 h-4" /> Add Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {invoice.items.map((item, index) => (
              <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 bg-slate-950/60 rounded-lg border border-slate-800 relative group">
                <div className="sm:col-span-5">
                  <Label>Item Description</Label>
                  <Input 
                    placeholder="e.g. Design Consulting"
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                  />
                  <Input 
                    placeholder="Sub-details (optional)"
                    className="mt-1 text-xs text-slate-400 h-8"
                    value={item.details || ''}
                    onChange={(e) => handleItemChange(index, 'details', e.target.value)}
                  />
                </div>
                <div className="col-span-2 sm:col-span-2">
                  <Label>Qty</Label>
                  <Input 
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                  />
                </div>
                <div className="col-span-3 sm:col-span-3">
                  <Label>Rate</Label>
                  <Input 
                    type="number"
                    min="0"
                    placeholder="0"
                    value={item.rate}
                    onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                  />
                </div>
                <div className="col-span-2 sm:col-span-2 flex flex-col justify-between items-end">
                  <Label className="w-full text-right sm:pr-2">Amount</Label>
                  <div className="flex items-center justify-between w-full h-10 pr-1">
                    <span className="text-sm font-semibold text-slate-200 select-none block w-full text-right pr-2">
                      {formatCurrency(item.quantity * item.rate)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="text-slate-500 hover:text-rose-500 p-1 rounded hover:bg-slate-900 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 5. Pricing Extras & Payments */}
        <Card className="glass-panel">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Terms & Adjustments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tax Rate (%)</Label>
                <Input 
                  type="number" 
                  min="0" 
                  max="100"
                  value={invoice.taxRate} 
                  onChange={(e) => setInvoice(prev => ({ ...prev, taxRate: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))}
                />
              </div>
              <div>
                <Label>Discount (%)</Label>
                <Input 
                  type="number" 
                  min="0" 
                  max="100"
                  value={invoice.discountRate} 
                  onChange={(e) => setInvoice(prev => ({ ...prev, discountRate: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Payment Method</Label>
                <Input 
                  placeholder="e.g. Bank Transfer, Stripe" 
                  value={invoice.paymentDetails.method} 
                  onChange={(e) => handlePaymentChange('method', e.target.value)}
                />
              </div>
              <div>
                <Label>Payment Terms</Label>
                <Input 
                  placeholder="e.g. Due on Receipt, Net 30" 
                  value={invoice.paymentDetails.terms} 
                  onChange={(e) => handlePaymentChange('terms', e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Client Notes</Label>
              <Textarea 
                value={invoice.notes} 
                onChange={(e) => setInvoice(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any message, notes or bank routing details to print on invoice"
              />
            </div>
          </CardContent>
        </Card>

        {/* Action Panel */}
        <div className="flex flex-wrap gap-3">
          <Button 
            className="flex-1 min-w-[120px] gap-2 h-11"
            isLoading={isSaving}
            onClick={() => handleSaveInvoice(false)}
          >
            <Save className="w-4 h-4" />
            {isEditing ? 'Update Invoice' : 'Save Invoice'}
          </Button>

          {isEditing && (
            <Button 
              variant="outline"
              className="flex-1 min-w-[120px] gap-2 h-11"
              isLoading={isSaving}
              onClick={() => handleSaveInvoice(true)}
            >
              <Copy className="w-4 h-4" />
              Save As New Copy
            </Button>
          )}

          <Button 
            variant="secondary"
            className="flex-1 min-w-[120px] gap-2 h-11 text-slate-200"
            isLoading={isGeneratingPdf}
            onClick={handleDownloadPDF}
          >
            <Download className="w-4 h-4" /> Export PDF
          </Button>
          
          <Button 
            variant="ghost" 
            className="text-slate-400 hover:text-white"
            onClick={handleReset}
          >
            <RefreshCw className="w-4 h-4 mr-1.5" /> Clear
          </Button>
        </div>

      </div>

      {/* Native Ad Banner and Divider */}
      {!currentUser?.isPremium && (
        <div className="py-4 border-t border-b border-slate-850/80 my-4">
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center mb-2">Sponsor Feedback & Offers</div>
          <NativeAdBanner isPremium={currentUser?.isPremium} />
        </div>
      )}

      {/* Right Pane - Live Preview Sheet (Full Width Stack) */}
      <div className="w-full relative">
        <div className="space-y-4">
          <div className="flex items-center justify-between select-none">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Invoice Preview
            </span>
            <span className="text-xs text-slate-500">Scale matches target A4 export layout</span>
          </div>

          {/* Simulated Paper A4 sheet */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 shadow-2xl bg-slate-900/40 p-4">
            {(() => {
              const template = invoice.selectedTemplate || 'default';
              const styles = getTemplateStyles(template);
              
              return (
                <div 
                  id="invoice-preview-sheet"
                  className={`w-[595px] min-h-[842px] ${styles.bgColor} ${styles.textColor} ${styles.containerPadding} ${styles.topStripe} shadow-inner mx-auto scale-95 origin-top transition-transform duration-250 select-none text-left`}
                  style={{ fontFamily: styles.fontFamily }}
                >
                  
                  {template === 'creative' ? (
                    /* 3. Creative Split Columns template */
                    <div className="flex h-full gap-6 text-slate-800">
                      {/* Left Column Sidebar */}
                      <div className="w-[38%] border-r border-slate-100 pr-5 flex flex-col justify-between" style={{ minHeight: '740px' }}>
                        <div>
                          {invoice.senderInfo.logoUrl ? (
                            <img 
                              src={invoice.senderInfo.logoUrl} 
                              alt="Logo" 
                              className="max-h-12 max-w-[120px] object-contain mb-6 block"
                            />
                          ) : (
                            <div className="h-10 w-24 bg-slate-50 border border-dashed border-slate-200 rounded flex items-center justify-center text-[9px] text-slate-400 font-bold mb-6 uppercase tracking-wider">Logo Area</div>
                          )}

                          <h4 className="text-[8px] font-bold text-slate-400 uppercase tracking-widest pb-1 mb-2 border-b border-slate-100">Bill To</h4>
                          <h3 className="text-xs font-bold text-slate-800 m-0">{invoice.clientInfo.name || 'Client Name'}</h3>
                          <p className="text-[9px] text-slate-500 m-0.5">{invoice.clientInfo.email || 'client@email.com'}</p>
                          <p className="text-[9px] text-slate-500 m-0.5">{invoice.clientInfo.address || 'Address Line'}</p>
                          <p className="text-[9px] text-slate-500 m-0.5">{invoice.clientInfo.phone || ''}</p>

                          <h4 className="text-[8px] font-bold text-slate-400 uppercase tracking-widest pb-1 mt-6 mb-2 border-b border-slate-100">Payment Details</h4>
                          <p className="text-[9px] text-slate-700 m-0.5">Currency: <strong>{invoice.currency}</strong></p>
                          <p className="text-[9px] text-slate-500 m-0.5">Method: {invoice.paymentDetails.method || 'Bank Transfer'}</p>
                          <p className="text-[9px] text-slate-500 m-0.5">Terms: {invoice.paymentDetails.terms || 'Net 14'}</p>
                        </div>

                        <div className="mt-8 pt-4 border-t border-slate-100">
                          {invoice.notes && (
                            <>
                              <h4 className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Notes</h4>
                              <p className="text-[9px] text-slate-500 leading-relaxed m-0 whitespace-pre-wrap">{invoice.notes}</p>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right Column Content */}
                      <div className="w-[62%] flex flex-col justify-between" style={{ minHeight: '740px' }}>
                        <div>
                          <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-100">
                            <div>
                              <h2 className="text-sm font-bold text-violet-900 leading-tight m-0">{invoice.senderInfo.name || 'Company Name'}</h2>
                              <p className="text-[9px] text-slate-500 m-0.5">{invoice.senderInfo.email || ''}</p>
                              <p className="text-[9px] text-slate-500 m-0.5">{invoice.senderInfo.address || ''}</p>
                              <p className="text-[9px] text-slate-500 m-0.5">{invoice.senderInfo.phone || ''}</p>
                            </div>
                            <div className="text-right">
                              <h1 className="text-lg font-black text-slate-800 tracking-wider m-0 uppercase">INVOICE</h1>
                              <p className="text-[11px] font-mono font-bold text-slate-600 m-0.5"># {invoice.invoiceNumber}</p>
                              <p className="text-[8px] text-slate-500 m-0.5">Issue: {invoice.invoiceDate}</p>
                              <p className="text-[8px] text-slate-500 m-0.5">Due: {invoice.dueDate}</p>
                            </div>
                          </div>

                          {/* Table */}
                          <table className="w-full border-collapse mb-6">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50">
                                <th className="text-[9px] text-left font-bold text-slate-500 p-2">Description</th>
                                <th className="text-[9px] text-center font-bold text-slate-500 p-2 w-8">Qty</th>
                                <th className="text-[9px] text-right font-bold text-slate-500 p-2 w-16">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {invoice.items.map((item, idx) => (
                                <tr key={idx} className="border-b border-slate-100">
                                  <td className="p-2 text-[10px] text-slate-800">
                                    <strong className="block">{item.description || 'Item'}</strong>
                                    {item.details && <span className="text-[8px] text-slate-400 block mt-0.5">{item.details}</span>}
                                  </td>
                                  <td className="p-2 text-[10px] text-center text-slate-650">{item.quantity}</td>
                                  <td className="p-2 text-[10px] text-right text-slate-800 font-bold">{formatCurrency(item.quantity * item.rate)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Totals */}
                        <div className="text-right text-xs pt-4 border-t border-slate-100">
                          <div className="flex justify-between py-1 border-b border-slate-50">
                            <span className="text-slate-400">Subtotal:</span>
                            <span className="font-semibold text-slate-700">{formatCurrency(totals.subtotal)}</span>
                          </div>
                          {totals.taxAmount > 0 && (
                            <div className="flex justify-between py-1 border-b border-slate-50">
                              <span className="text-slate-400">Tax ({invoice.taxRate}%):</span>
                              <span className="text-slate-600">{formatCurrency(totals.taxAmount)}</span>
                            </div>
                          )}
                          {totals.discountAmount > 0 && (
                            <div className="flex justify-between py-1 border-b border-slate-50">
                              <span className="text-slate-400">Discount ({invoice.discountRate}%):</span>
                              <span className="text-rose-600">-{formatCurrency(totals.discountAmount)}</span>
                            </div>
                          )}
                          <div className="flex justify-between py-2 mt-2 border-t border-slate-900 text-sm font-extrabold text-slate-800">
                            <span>Total:</span>
                            <span className="text-violet-900 font-black">{formatCurrency(totals.grandTotal)}</span>
                          </div>
                        </div>
                      </div>
                      {!currentUser?.isPremium && (
                        <div className="absolute bottom-6 left-6 text-[10px] font-black tracking-widest text-slate-300 opacity-30 uppercase rotate-[-15deg] select-none pointer-events-none">BillStacker</div>
                      )}
                    </div>
                  ) : (
                    /* Standard layout dynamically customized with themes */
                    <>
                      {/* Header section */}
                      <div className={`flex justify-between items-start border-b-2 ${styles.borderColor} pb-6 mb-6`}>
                        <div>
                          {invoice.senderInfo.logoUrl ? (
                            <img 
                              src={invoice.senderInfo.logoUrl} 
                              alt="Logo" 
                              className="max-h-12 max-w-[120px] object-contain mb-3 block"
                            />
                          ) : (
                            <div className={`h-10 w-24 border border-dashed rounded flex items-center justify-center text-[10px] font-bold mb-3 uppercase tracking-wider ${
                              template === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-600' : 'bg-slate-100 border-slate-300 text-slate-400'
                            }`}>Logo Area</div>
                          )}
                          <h2 className={`text-lg font-bold leading-tight m-0 ${styles.primaryColor}`}>{invoice.senderInfo.name || 'Company Name'}</h2>
                          <p className="text-[10px] opacity-75 m-0.5">{invoice.senderInfo.email || 'billing@company.com'}</p>
                          <p className="text-[10px] opacity-75 m-0.5">{invoice.senderInfo.address || 'Address Line'}</p>
                          <p className="text-[10px] opacity-75 m-0.5">{invoice.senderInfo.phone || 'Phone Number'}</p>
                        </div>
                        <div className="text-right">
                          <h1 className={`text-2xl font-black tracking-wider m-0 uppercase ${styles.titleColor}`}>Invoice</h1>
                          <p className="text-xs font-bold mt-1 mb-3 opacity-90"># {invoice.invoiceNumber || 'INV-0000'}</p>
                          <p className="text-[10px] opacity-75 m-0.5">Date: {invoice.invoiceDate}</p>
                          <p className="text-[10px] opacity-75 m-0.5">Due Date: {invoice.dueDate}</p>
                          <div className={`mt-2 inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${styles.badgeBg} ${styles.badgeTextColor}`}>
                            {invoice.status}
                          </div>
                        </div>
                      </div>

                      {/* Billing section */}
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-[45%]">
                          <h4 className="text-[9px] font-bold opacity-60 uppercase tracking-widest border-b pb-1 mb-2" style={{ borderColor: 'inherit' }}>Bill To</h4>
                          <h3 className="text-sm font-semibold m-0">{invoice.clientInfo.name || 'Client Name'}</h3>
                          <p className="text-[10px] opacity-75 m-0.5">{invoice.clientInfo.email || 'client@email.com'}</p>
                          <p className="text-[10px] opacity-75 m-0.5">{invoice.clientInfo.address || 'Client Address'}</p>
                          <p className="text-[10px] opacity-75 m-0.5">{invoice.clientInfo.phone || 'Client Phone'}</p>
                        </div>
                        <div className="w-[45%] text-right">
                          <h4 className="text-[9px] font-bold opacity-60 uppercase tracking-widest border-b pb-1 mb-2" style={{ borderColor: 'inherit' }}>Payment Info</h4>
                          <p className="text-[10px] opacity-90 m-0.5">Currency: <strong>{invoice.currency}</strong></p>
                          <p className="text-[10px] opacity-75 m-0.5">Method: {invoice.paymentDetails.method || 'Bank Transfer'}</p>
                          <p className="text-[10px] opacity-75 m-0.5">Terms: {invoice.paymentDetails.terms || 'Net 14'}</p>
                        </div>
                      </div>

                      {/* Items Table */}
                      <table className="w-full border-collapse mb-6">
                        <thead>
                          <tr className={`border-b-2 ${styles.borderColor} ${styles.tableHeaderBg}`}>
                            <th className={`text-[10px] text-left font-bold p-2.5 ${styles.tableHeaderTextColor}`}>Description</th>
                            <th className={`text-[10px] text-center font-bold p-2.5 w-12 ${styles.tableHeaderTextColor}`}>Qty</th>
                            <th className={`text-[10px] text-right font-bold p-2.5 w-24 ${styles.tableHeaderTextColor}`}>Rate</th>
                            <th className={`text-[10px] text-right font-bold p-2.5 w-24 ${styles.tableHeaderTextColor}`}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {invoice.items.map((item, idx) => (
                            <tr key={idx} className={`border-b ${styles.borderColor}`}>
                              <td className="p-2.5 text-xs">
                                <strong className="block">{item.description || 'Untitled Item'}</strong>
                                {item.details && <span className="text-[10px] opacity-60 block mt-0.5">{item.details}</span>}
                              </td>
                              <td className="p-2.5 text-xs text-center opacity-85">{item.quantity}</td>
                              <td className="p-2.5 text-xs text-right opacity-85">{formatCurrency(item.rate)}</td>
                              <td className="p-2.5 text-xs text-right font-bold">{formatCurrency(item.quantity * item.rate)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Summary section */}
                      <div className="flex justify-between items-start">
                        <div className="w-[50%]">
                          {invoice.notes && (
                            <>
                              <h4 className="text-[9px] font-bold opacity-60 uppercase tracking-widest mb-1.5">Notes</h4>
                              <p className="text-[10px] opacity-75 leading-relaxed m-0 whitespace-pre-wrap">{invoice.notes}</p>
                            </>
                          )}
                        </div>
                        <div className="w-[40%] text-right text-xs">
                          <div className="flex justify-between py-1 border-b border-slate-50/10">
                            <span className="opacity-75">Subtotal:</span>
                            <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
                          </div>
                          {totals.taxAmount > 0 && (
                            <div className="flex justify-between py-1 border-b border-slate-50/10">
                              <span className="opacity-75">Tax ({invoice.taxRate}%):</span>
                              <span>{formatCurrency(totals.taxAmount)}</span>
                            </div>
                          )}
                          {totals.discountAmount > 0 && (
                            <div className="flex justify-between py-1 border-b border-slate-50/10">
                              <span className="opacity-75">Discount ({invoice.discountRate}%):</span>
                              <span className="text-rose-500 font-bold">-{formatCurrency(totals.discountAmount)}</span>
                            </div>
                          )}
                          <div className={`flex justify-between py-2 mt-2 border-t-2 ${styles.totalsBorderColor} text-sm font-extrabold`}>
                            <span>Grand Total:</span>
                            <span className={`font-black ${styles.totalsTextColor}`}>{formatCurrency(totals.grandTotal)}</span>
                          </div>
                        </div>
                      </div>

                      {!currentUser?.isPremium && (
                        <div className={`mt-8 pt-3 border-t border-dashed text-center text-[9px] select-none pointer-events-none opacity-60 w-full ${styles.borderColor} ${styles.primaryColor}`}>
                          Powered by <span className="font-bold">BillStacker</span> • Free Invoice Suite
                        </div>
                      )}
                    </>
                  )}
                  
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Footer Banner Ad */}
      {!currentUser?.isPremium && (
      <div className="py-4 border-t border-b border-slate-850/80 my-4">
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center mb-2">Sponsor Feedback & Offers</div>
        <NativeAdBanner isPremium={currentUser?.isPremium} />
      </div>
    )}
      <div className="pt-6 border-t border-slate-850/60 mt-12 w-full">
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
    </div>
  );
}

// Simple internal copy icon for button since lucide Copy might not be imported or we can use another icon.
function Copy(props) {
  return (
    <svg 
      {...props} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
    </svg>
  );
}
