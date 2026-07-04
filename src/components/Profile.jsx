import React, { useState, useEffect } from 'react';
import { 
  dbSaveDefaultProfile, 
  dbGetDefaultProfile, 
  dbGetInvoices,
  signInWithGoogle,
  signOutUser
} from '../firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label, Input } from './ui/input';
import { Button } from './ui/button';
import { useToast } from './ui/toast';
import { 
  User, 
  Mail, 
  Building, 
  CreditCard, 
  DollarSign, 
  FileText, 
  LogOut, 
  ShieldCheck, 
  Save, 
  LogIn 
} from 'lucide-react';

export default function Profile({ currentUser, onProfileUpdate }) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ count: 0, revenue: 0 });
  const [profile, setProfile] = useState({
    senderInfo: {
      name: '',
      email: '',
      address: '',
      phone: '',
      logoUrl: ''
    },
    currency: 'USD',
    paymentDetails: {
      method: '',
      terms: ''
    },
    isPremium: false
  });
  const [exchangeRates, setExchangeRates] = useState({ USD: 1, INR: 83.3, EUR: 0.92 });
  const { toast } = useToast();

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
        console.warn('[ExchangeRates] Failed to load latest rates, using local fallback:', err);
      }
    };
    fetchRates();
  }, []);

  const getConversionFactor = (fromCurrency, toCurrency) => {
    if (fromCurrency === toCurrency) return 1;
    const fromRate = exchangeRates[fromCurrency] || 1;
    const toRate = exchangeRates[toCurrency] || 1;
    return toRate / fromRate;
  };

  // Load User Stats & Profile
  useEffect(() => {
    const loadUserData = async () => {
      if (!currentUser) return;
      try {
        setLoading(true);

        // Fetch default profile settings
        const defaultProfile = await dbGetDefaultProfile(currentUser.uid);
        if (defaultProfile) {
          setProfile({
            senderInfo: {
              name: defaultProfile.senderInfo?.name || '',
              email: defaultProfile.senderInfo?.email || '',
              address: defaultProfile.senderInfo?.address || '',
              phone: defaultProfile.senderInfo?.phone || '',
              logoUrl: defaultProfile.senderInfo?.logoUrl || ''
            },
            currency: defaultProfile.currency || 'USD',
            paymentDetails: {
              method: defaultProfile.paymentDetails?.method || '',
              terms: defaultProfile.paymentDetails?.terms || ''
            },
            isPremium: !!defaultProfile.isPremium
          });
        }

        // Fetch invoice stats
        const invoices = await dbGetInvoices(currentUser.uid);
        if (invoices) {
          const rev = invoices.reduce((sum, inv) => sum + (Number(inv.totals?.grandTotal) || 0), 0);
          setStats({ count: invoices.length, revenue: rev });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [currentUser]);

  // Handle Input Changes
  const handleSenderChange = (field, val) => {
    setProfile(prev => ({
      ...prev,
      senderInfo: { ...prev.senderInfo, [field]: val }
    }));
  };

  const handlePaymentChange = (field, val) => {
    setProfile(prev => ({
      ...prev,
      paymentDetails: { ...prev.paymentDetails, [field]: val }
    }));
  };

  // Save profile changes
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      setLoading(true);
      await dbSaveDefaultProfile(currentUser.uid, profile);
      if (onProfileUpdate) onProfileUpdate(profile);
      toast({
        title: 'Settings Updated',
        description: 'Your default company and payment details have been saved.',
        variant: 'success'
      });
    } catch (err) {
      toast({
        title: 'Save Failed',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Toggle Premium / Membership (local mock simulation)
  const handleTogglePremium = async () => {
    if (!currentUser) return;
    const nextPremium = !profile.isPremium;
    try {
      setLoading(true);
      const updatedProfile = {
        ...profile,
        isPremium: nextPremium
      };
      await dbSaveDefaultProfile(currentUser.uid, updatedProfile);
      setProfile(updatedProfile);
      if (onProfileUpdate) onProfileUpdate(updatedProfile);

      toast({
        title: nextPremium ? 'Upgraded to Premium!' : 'Downgraded to Free Plan',
        description: nextPremium 
          ? 'Upgrade complete! Watermarks and advertisements have been removed.' 
          : 'You are now on the free tier. Watermarks and advertisements will be restored.',
        variant: nextPremium ? 'success' : 'default'
      });
    } catch (err) {
      toast({
        title: 'Subscription Update Failed',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle Authentication trigger
  const handleLogin = async () => {
    try {
      await signInWithGoogle();
      toast({
        title: 'Login Success',
        description: 'Successfully authenticated with Google.',
        variant: 'success'
      });
    } catch (err) {
      toast({
        title: 'Authentication Failed',
        description: err.message,
        variant: 'destructive'
      });
    }
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
      toast({
        title: 'Logged Out',
        description: 'Your account has been signed out.',
      });
    } catch (err) {
      toast({
        title: 'Logout Failed',
        description: err.message,
        variant: 'destructive'
      });
    }
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: profile.currency || 'USD',
    }).format(val || 0);
  };

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto py-8 text-center animate-in fade-in duration-300">
        <Card className="glass-panel p-6 space-y-6 bg-slate-900/50 border border-slate-850">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-violet-600/10 text-violet-400 flex items-center justify-center border border-violet-900/30">
            <User className="w-8 h-8" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold">You are in Guest Mode</CardTitle>
            <CardDescription className="text-slate-400 mt-2">
              Sign in with Google to sync your invoices, save custom settings, and configure default profiles.
            </CardDescription>
          </div>

          <div className="pt-2">
            <Button onClick={handleLogin} className="w-full h-11 gap-2 font-semibold shadow-lg">
              <LogIn className="w-4 h-4" />
              Sign in with Google
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in-50 duration-300">
      
      {/* Account Info Header */}
      <div className={`flex flex-col sm:flex-row items-center justify-between p-6 rounded-2xl gap-4 border transition-all duration-300 ${
        profile.isPremium 
          ? 'bg-gradient-to-r from-slate-900 via-violet-950/20 to-indigo-950/20 border-violet-500/40 shadow-xl shadow-violet-950/10' 
          : 'bg-slate-900/40 border-slate-800'
      }`}>
        <div className="flex items-center gap-4 text-center sm:text-left flex-col sm:flex-row">
          {currentUser.photoURL ? (
            <img src={currentUser.photoURL} alt="Avatar" className={`w-16 h-16 rounded-full border-2 shadow-md ${
              profile.isPremium ? 'border-amber-400' : 'border-violet-500'
            }`} />
          ) : (
            <div className={`w-16 h-16 rounded-full border flex items-center justify-center ${
              profile.isPremium ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-violet-600/20 text-violet-400 border-violet-500/30'
            }`}>
              <User className="w-8 h-8" />
            </div>
          )}
          <div>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <h1 className="text-xl font-extrabold text-white leading-none">{currentUser.displayName || 'Member'}</h1>
              {profile.isPremium ? (
                <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-md shadow-amber-500/25">
                  PRO MEMBER
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  FREE TIER
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 flex items-center justify-center sm:justify-start gap-1 mt-1.5 leading-none">
              <Mail className="w-3.5 h-3.5" />
              {currentUser.email}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {profile.isPremium ? (
            <Button 
              type="button"
              onClick={handleTogglePremium} 
              variant="outline"
              className="text-xs h-10 border-slate-700 hover:bg-slate-800 text-slate-300 w-full sm:w-auto"
            >
              Downgrade Plan
            </Button>
          ) : (
            <Button 
              type="button"
              onClick={handleTogglePremium} 
              className="text-xs h-10 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 font-bold shadow-lg shadow-violet-900/35 w-full sm:w-auto shrink-0 border-0"
            >
              {profile.currency === 'INR' 
                ? 'Upgrade to Premium (₹99)' 
                : profile.currency === 'EUR' 
                ? 'Upgrade to Premium (€9)' 
                : 'Upgrade to Premium ($9)'
              }
            </Button>
          )}
          
          <Button onClick={handleLogout} variant="ghost" className="text-slate-400 hover:text-rose-500 gap-1.5 h-10 w-full sm:w-auto">
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Cloud Performance metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glass-panel border border-slate-850">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 bg-violet-600/10 text-violet-400 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Cloud Invoices</span>
              <div className="text-xl font-extrabold text-white mt-0.5">{stats.count}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border border-slate-850">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 bg-emerald-600/10 text-emerald-400 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Billed Amount</span>
              <div className="text-xl font-extrabold text-white mt-0.5">{formatCurrency(stats.revenue)}</div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border border-slate-850">
          <CardContent className="pt-6 flex items-center gap-4">
            <div className="p-3 bg-cyan-600/10 text-cyan-400 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Database Status</span>
              <div className="text-sm font-bold text-emerald-450 mt-1 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                Live Sync Connected
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Default Settings Editor Form */}
      <form onSubmit={handleSaveProfile}>
        <Card className="glass-panel border border-slate-850">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Building className="w-5 h-5 text-violet-400" />
              Default Company Profile Settings
            </CardTitle>
            <CardDescription>
              These options will auto-fill automatically when creating new invoices in the builder.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            
            {/* Sender details inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Company Name</Label>
                <Input 
                  placeholder="e.g. Acme Corp" 
                  value={profile.senderInfo.name} 
                  onChange={(e) => handleSenderChange('name', e.target.value)}
                />
              </div>
              <div>
                <Label>Billing Email</Label>
                <Input 
                  type="email" 
                  placeholder="e.g. accounting@acme.com" 
                  value={profile.senderInfo.email} 
                  onChange={(e) => handleSenderChange('email', e.target.value)}
                />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input 
                  placeholder="e.g. +1 555-0199" 
                  value={profile.senderInfo.phone} 
                  onChange={(e) => handleSenderChange('phone', e.target.value)}
                />
              </div>
              <div>
                <Label>Default Currency</Label>
                <select 
                  value={profile.currency} 
                  onChange={(e) => setProfile(prev => ({ ...prev, currency: e.target.value }))}
                  className="flex h-10 w-full rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-violet-500"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="AUD">AUD ($)</option>
                </select>
              </div>
            </div>

            <div>
              <Label>Company Address</Label>
              <Input 
                placeholder="e.g. 123 Business Rd, Suite 100, New York, NY" 
                value={profile.senderInfo.address} 
                onChange={(e) => handleSenderChange('address', e.target.value)}
              />
            </div>

            {/* Payment defaults */}
            <div className="border-t border-slate-800 pt-6 space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-violet-400" />
                Default Payment Settings
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Payment Method</Label>
                  <Input 
                    placeholder="e.g. Direct Bank Transfer, PayPal" 
                    value={profile.paymentDetails.method} 
                    onChange={(e) => handlePaymentChange('method', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Payment Terms</Label>
                  <Input 
                    placeholder="e.g. Net 14 days, Due on Receipt" 
                    value={profile.paymentDetails.terms} 
                    onChange={(e) => handlePaymentChange('terms', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <Button type="submit" isLoading={loading} className="gap-2 px-6">
                <Save className="w-4 h-4" />
                Save Profile Configuration
              </Button>
            </div>

          </CardContent>
        </Card>
      </form>

    </div>
  );
}
