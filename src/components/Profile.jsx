import React, { useState, useEffect } from 'react';
import { 
  dbSaveDefaultProfile, 
  dbGetDefaultProfile, 
  dbGetInvoices,
  signInWithGoogle,
  signOutUser,
  dbUpdateAvatar
} from '../firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label, Input } from './ui/input';
import { Button } from './ui/button';
import { useToast } from './ui/toast';
import SupportFeedback from './SupportFeedback';
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
  LogIn,
  Camera
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
    isPremium: false,
    photoURL: ''
  });
  const [exchangeRates, setExchangeRates] = useState({ USD: 1, INR: 83.3, EUR: 0.92 });
  const [botUsername, setBotUsername] = useState('BillStackerBot');
  const { toast } = useToast();

  const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237c3aed'><circle cx='12' cy='8' r='4'/><path d='M12 14c-6.1 0-8 4-8 4h16s-1.9-4-8-4z'/></svg>";

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid File',
        description: 'Please upload an image file.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      
      const compressAvatar = (imgFile) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.width = 120;
              canvas.height = 120;
              const size = Math.min(img.width, img.height);
              ctx.drawImage(
                img,
                (img.width - size) / 2, (img.height - size) / 2, size, size,
                0, 0, 120, 120
              );
              resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = () => reject(new Error('Failed to load image element.'));
            img.src = event.target?.result;
          };
          reader.onerror = () => reject(new Error('Failed to read file.'));
          reader.readAsDataURL(imgFile);
        });
      };

      const base64Avatar = await compressAvatar(file);
      await dbUpdateAvatar(currentUser.uid, base64Avatar);

      toast({
        title: 'Avatar Updated',
        description: 'Your profile picture has been updated successfully.',
        variant: 'success'
      });
      
      setProfile(prev => ({ ...prev, photoURL: base64Avatar }));
      if (onProfileUpdate) onProfileUpdate({ ...profile, isPremium: profile.isPremium, photoURL: base64Avatar });
    } catch (err) {
      toast({
        title: 'Upload Failed',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
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
        console.warn('[ExchangeRates] Failed to load latest rates, using local fallback:', err);
      }
    };
    fetchRates();
  }, []);

  // Fetch Telegram Bot Username info
  useEffect(() => {
    const fetchBotInfo = async () => {
      try {
        const res = await fetch('/api/telegram-info');
        const data = await res.json();
        if (data && data.username) {
          setBotUsername(data.username);
        }
      } catch (err) {
        console.warn('Failed to load telegram bot info:', err);
      }
    };
    fetchBotInfo();
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
            isPremium: !!defaultProfile.isPremium,
            photoURL: defaultProfile.photoURL || ''
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

  // Toggle Premium / Membership via Paytm gateway
  const handleTogglePremium = async () => {
    if (!currentUser) return;
    
    // Downgrade path for sandbox testing
    if (profile.isPremium) {
      try {
        setLoading(true);
        const updatedProfile = {
          ...profile,
          isPremium: false
        };
        await dbSaveDefaultProfile(currentUser.uid, updatedProfile);
        setProfile(updatedProfile);
        if (onProfileUpdate) onProfileUpdate(updatedProfile);

        toast({
          title: 'Downgraded to Free Plan',
          description: 'You have returned to the free tier. Watermarks and advertisements will be restored.',
        });
      } catch (err) {
        toast({
          title: 'Update Failed',
          description: err.message,
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    // Determine price dynamically based on currency settings
    const paymentAmount = profile.currency === 'INR' ? 99 : 9;
    const paymentCurrency = profile.currency || 'USD';

    try {
      setLoading(true);

      // 1. Call backend to initiate Paytm session and obtain txnToken
      const initRes = await fetch('/api/paytm/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: paymentAmount,
          currency: paymentCurrency,
          userId: currentUser.uid
        })
      });

      if (!initRes.ok) {
        const errData = await initRes.json();
        throw new Error(errData.error || 'Failed to initiate payment.');
      }

      const paymentData = await initRes.json();
      const { txnToken, orderId, amount: returnedAmount, mid, isMock } = paymentData;

      // 2. If it is a mock token, skip Paytm JS loading and complete instantly
      if (isMock) {
        console.log('[Paytm Checkout] Mock transaction completed successfully.');
        const updatedProfile = {
          ...profile,
          isPremium: true,
          subscriptionPaymentId: 'MOCK_PAYTM_' + orderId
        };
        await dbSaveDefaultProfile(currentUser.uid, updatedProfile);
        setProfile(updatedProfile);
        if (onProfileUpdate) onProfileUpdate(updatedProfile);

        toast({
          title: paymentData.warning ? 'Sandbox Simulator Active' : 'Upgrade Successful!',
          description: paymentData.warning 
            ? `${paymentData.warning} Your account has been simulated as Premium.`
            : `Welcome to Premium! Mock Order ID: ${orderId}`,
          variant: paymentData.warning ? 'default' : 'success'
        });
        setLoading(false);
        return;
      }

      // 3. Launch Paytm JS Checkout popup
      const config = {
        "root": "",
        "flow": "DEFAULT",
        "merchantName": "BillStacker",
        "merchant": {
          "name": "BillStacker"
        },
        "data": {
          "orderId": orderId,
          "token": txnToken,
          "tokenType": "TXN_TOKEN",
          "amount": returnedAmount
        },
        "handler": {
          "transactionStatus": async function(data) {
            console.log("[Paytm JS Callback Data]:", data);
            if (data && (data.STATUS === 'TXN_SUCCESS' || data.resultInfo?.resultStatus === 'TXN_SUCCESS')) {
              try {
                setLoading(true);
                const updatedProfile = {
                  ...profile,
                  isPremium: true,
                  subscriptionPaymentId: data.TXNID || data.orderId || orderId
                };
                await dbSaveDefaultProfile(currentUser.uid, updatedProfile);
                setProfile(updatedProfile);
                if (onProfileUpdate) onProfileUpdate(updatedProfile);

                toast({
                  title: 'Upgrade Successful!',
                  description: `Welcome to BillStacker Premium! Transaction ID: ${data.TXNID || orderId}`,
                  variant: 'success'
                });
              } catch (err) {
                toast({
                  title: 'Upgrade Save Failed',
                  description: err.message,
                  variant: 'destructive'
                });
              } finally {
                setLoading(false);
              }
            } else {
              toast({
                title: 'Transaction Failed',
                description: data.RESPMSG || 'Payment unsuccessful.',
                variant: 'destructive'
              });
            }
          },
          "notifyMerchant": function(eventName, notifyData) {
            console.log("[Paytm JS Notification]:", eventName, notifyData);
          }
        }
      };

      if (window.Paytm && window.Paytm.CheckoutJS) {
        window.Paytm.CheckoutJS.init(config).then(function onSuccess() {
          window.Paytm.CheckoutJS.invoke();
        }).catch(function onError(err) {
          toast({
            title: 'Paytm Load Error',
            description: err.message || 'Paytm modal failed to load.',
            variant: 'destructive'
          });
        });
      } else {
        throw new Error('Paytm JS SDK not ready. Please check your internet connection and try again.');
      }

    } catch (err) {
      toast({
        title: 'Upgrade Failed',
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
    <div className="max-w-4xl mx-auto px-4 py-2 space-y-6 animate-in fade-in-50 duration-300">
      
      {/* Account Info Header */}
      <div className={`flex flex-col sm:flex-row items-center justify-between p-6 rounded-2xl gap-4 border transition-all duration-300 ${
        profile.isPremium 
          ? 'bg-gradient-to-r from-slate-900 via-violet-950/20 to-indigo-950/20 border-violet-500/40 shadow-xl shadow-violet-950/10' 
          : 'bg-slate-900/40 border-slate-800'
      }`}>
        <div className="flex items-center gap-4 text-center sm:text-left flex-col sm:flex-row">
          <div className="relative group cursor-pointer w-16 h-16 shrink-0">
            <img 
              src={profile.photoURL || currentUser.photoURL || DEFAULT_AVATAR} 
              alt="Avatar" 
              className={`w-16 h-16 rounded-full border-2 object-cover shadow-md transition-all group-hover:brightness-50 ${
                profile.isPremium ? 'border-amber-400' : 'border-violet-500'
              }`}
              onError={(e) => {
                e.target.src = DEFAULT_AVATAR;
              }}
            />
            <label 
              htmlFor="avatar-file-input" 
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              title="Change Profile Photo"
            >
              <Camera className="w-5 h-5 text-white" />
            </label>
            <input 
              type="file" 
              id="avatar-file-input" 
              accept="image/*" 
              onChange={handleAvatarChange} 
              className="hidden" 
            />
          </div>
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

      {/* Telegram Bot Integration Card */}
      <Card className="glass-panel border border-slate-850 bg-slate-900/40">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <svg className="w-5 h-5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
            Telegram Bot Integration
          </CardTitle>
          <CardDescription>
            Connect your BillStacker account to track invoices, check billing summaries, and receive updates directly on Telegram.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profile.telegramChatId ? (
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-xl bg-sky-950/20 border border-sky-500/30 gap-4 text-center sm:text-left">
              <div className="flex items-center gap-3 flex-col sm:flex-row">
                <span className="w-3 h-3 rounded-full bg-sky-400 inline-block animate-pulse shrink-0" />
                <div>
                  <div className="text-sm font-bold text-white">Bot Connected Successfully</div>
                  <div className="text-xs text-sky-300/80 mt-0.5">Linked Chat ID: {profile.telegramChatId}</div>
                </div>
              </div>
              <Button 
                type="button" 
                onClick={() => window.open(`https://t.me/${botUsername}`, '_blank')}
                className="text-xs h-9 bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 border-0 shadow-md shadow-sky-900/30"
              >
                Open Chat in Telegram
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800 gap-4 text-center sm:text-left">
              <div>
                <div className="text-sm font-bold text-slate-300">Status: Not Linked</div>
                <div className="text-xs text-slate-500 mt-1">Connect your account to enable commands like `/invoices` and `/stats` directly in Telegram.</div>
              </div>
              <Button 
                type="button" 
                onClick={() => {
                  window.open(`https://t.me/${botUsername}?start=${currentUser.uid}`, '_blank');
                }}
                className="text-xs h-9 bg-sky-600 hover:bg-sky-500 text-white font-bold px-4 border-0 shadow-lg shadow-sky-900/30 flex items-center gap-2"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.27-2.03-.49-.82-.27-1.47-.42-1.41-.88.03-.24.37-.48 1.02-.73 3.98-1.73 6.64-2.88 7.99-3.45 3.8-1.61 4.59-1.89 5.1-.19.01.01.01.02.02.04z" />
                </svg>
                Connect Telegram Bot
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* Support & Feedback Section */}
      <div className="mt-8 border-t border-slate-850 pt-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-violet-650/10 text-violet-400 rounded-xl">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white tracking-tight">Help, Support & Feedback</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Submit tickets directly to platform administrators and monitor active responses.</p>
            </div>
          </div>
          <SupportFeedback currentUser={currentUser} />
        </div>
      </div>

    </div>
  );
}
