import React, { useState, useEffect } from 'react';
import { ToastProvider, useToast } from './components/ui/toast';
import Dashboard from './components/Dashboard';
import InvoiceBuilder from './components/InvoiceBuilder';
import PdfMerger from './components/PdfMerger';
import PdfReducer from './components/PdfReducer';
import Profile from './components/Profile';
import LandingPage from './components/LandingPage';
import ImageToPdf from './components/ImageToPdf';
import AuthGateway from './components/AuthGateway';
import AdminDashboard from './components/AdminDashboard';
import Blog from './components/Blog';
import SupportFeedback from './components/SupportFeedback';
import { Button } from './components/ui/button';
import { 
  onAuthStateChange, 
  signOutUser,
  dbGetDefaultProfile,
  dbSaveDefaultProfile,
  isMock
} from './firebase';
import { 
  LayoutDashboard, 
  FileText, 
  Combine, 
  Sparkles, 
  Layers,
  Menu,
  X,
  Github,
  LogOut,
  LogIn,
  User,
  Home,
  Image as ImageIcon,
  BookOpen,
  MessageSquare,
  ChevronDown
} from 'lucide-react';

const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%237c3aed'><circle cx='12' cy='8' r='4'/><path d='M12 14c-6.1 0-8 4-8 4h16s-1.9-4-8-4z'/></svg>";

function AppContent() {
  const [activeTab, setActiveTab] = useState('home');
  const [editInvoice, setEditInvoice] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toolsDropdownOpen, setToolsDropdownOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isBanned, setIsBanned] = useState(false);
  const { toast } = useToast();

  // Listen to Auth State Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      if (user) {
        try {
          let profile = await dbGetDefaultProfile(user.uid);
          
          if (profile?.isBanned) {
            setIsBanned(true);
            setCurrentUser(null);
            await signOutUser();
            setAuthLoading(false);
            return;
          }
          setIsBanned(false);

          const isEmailAdmin = user.email?.toLowerCase() === 'admin@billstacker.com';

          if (!profile) {
            profile = {
              senderInfo: { name: user.displayName || 'Admin', email: user.email || '' },
              currency: 'USD',
              isPremium: true,
              isAdmin: isEmailAdmin,
              joinedDate: new Date().toISOString()
            };
            await dbSaveDefaultProfile(user.uid, profile);
          } else if (isEmailAdmin && !profile.isAdmin) {
            // Self-healing database check: Promote admin email to isAdmin
            profile.isAdmin = true;
            await dbSaveDefaultProfile(user.uid, profile);
          }

          setCurrentUser({
            ...user,
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: profile?.photoURL || user.photoURL,
            isPremium: !!profile?.isPremium,
            isAdmin: !!profile?.isAdmin
          });
        } catch (e) {
          const adminFlag = user.email?.toLowerCase() === 'admin@billstacker.com';
          setCurrentUser({
            ...user,
            isAdmin: adminFlag
          });
        }
      } else {
        setCurrentUser(null);
        setIsBanned(false);
      }
      setAuthLoading(false);
      // If user logs in/out, trigger a reload of dashboard invoices
      setRefreshTrigger(prev => prev + 1);
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Pathname routing listener & Guard for /admin
  useEffect(() => {
    const handlePathRouting = () => {
      const path = window.location.pathname;
      if (path === '/admin') {
        if (authLoading) return; // wait for auth to finish loading
        
        if (currentUser) {
          if (currentUser.isAdmin) {
            setActiveTab('admin');
          } else {
            window.history.replaceState({}, document.title, '/');
            toast({
              title: 'Access Denied',
              description: 'You do not have administrative privileges.',
              variant: 'destructive'
            });
            setActiveTab('home');
          }
        } else {
          window.history.replaceState({}, document.title, '/');
          toast({
            title: 'Access Denied',
            description: 'Please sign in with an administrator account.',
            variant: 'destructive'
          });
          setActiveTab('auth');
        }
      } else if (path === '/dashboard') {
        setActiveTab('dashboard');
      } else if (path === '/invoice-builder') {
        setActiveTab('builder');
      } else if (path === '/pdf-merger') {
        setActiveTab('merger');
      } else if (path === '/image-to-pdf') {
        setActiveTab('image-to-pdf');
      } else if (path.startsWith('/blog')) {
        setActiveTab('blog');
      } else if (path === '/profile') {
        setActiveTab('profile');
      } else if (path === '/' || path === '') {
        setActiveTab('home');
      }
    };

    handlePathRouting();
    window.addEventListener('popstate', handlePathRouting);
    return () => window.removeEventListener('popstate', handlePathRouting);
  }, [authLoading, currentUser]);

  // Synchronize browser URL bar when activeTab state changes
  useEffect(() => {
    const currentPath = window.location.pathname;
    let targetPath = '/';
    
    if (activeTab === 'dashboard') targetPath = '/dashboard';
    else if (activeTab === 'builder') targetPath = '/invoice-builder';
    else if (activeTab === 'merger') targetPath = '/pdf-merger';
    else if (activeTab === 'image-to-pdf') targetPath = '/image-to-pdf';
    else if (activeTab === 'blog') {
      if (currentPath.startsWith('/blog')) return;
      targetPath = '/blog';
    }
    else if (activeTab === 'profile') targetPath = '/profile';
    else if (activeTab === 'admin') targetPath = '/admin';
    else if (activeTab === 'auth') targetPath = '/auth';

    if (currentPath !== targetPath) {
      window.history.pushState({ tab: activeTab }, '', targetPath);
    }
  }, [activeTab]);

  // Conditionally inject or remove Social Bar ad script based on premium status
  useEffect(() => {
    const existingScript = document.getElementById('social-bar-ad-script');
    
    if (currentUser?.isPremium) {
      if (existingScript) {
        existingScript.remove();
        console.log('[Ad Blocker] Premium tier active. Social Bar ad removed.');
      }
      return;
    }

    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'social-bar-ad-script';
      script.src = 'https://pl30272501.effectivecpmnetwork.com/c3/2e/f8/c32ef8ac7b9166573fd59697df02f9f2.js';
      script.async = true;
      document.body.appendChild(script);
      console.log('[Ad Engine] Free tier active. Social Bar ad initialized.');
    }
  }, [currentUser]);

  // Handle URL Payment Callbacks
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const orderId = params.get('orderId');
    const txnId = params.get('txnId');
    const errMsg = params.get('msg');

    if (paymentStatus && currentUser) {
      // Clear URL parameters immediately to prevent triggering on page refresh
      window.history.replaceState({}, document.title, window.location.pathname);

      if (paymentStatus === 'success') {
        const upgradeUser = async () => {
          try {
            const profile = await dbGetDefaultProfile(currentUser.uid) || {};
            const updatedProfile = {
              ...profile,
              isPremium: true,
              subscriptionPaymentId: txnId || orderId
            };
            await dbSaveDefaultProfile(currentUser.uid, updatedProfile);
            
            // Sync local currentUser state
            setCurrentUser(prev => ({
              ...prev,
              isPremium: true
            }));

            toast({
              title: 'Upgrade Successful!',
              description: `Welcome to Premium! Transaction ID: ${txnId || orderId}`,
              variant: 'success'
            });
            setActiveTab('profile'); // Switch to profile to see status update
          } catch (e) {
            console.error(e);
            toast({
              title: 'Upgrade Save Failed',
              description: e.message || 'Failed to save premium status.',
              variant: 'destructive'
            });
          }
        };
        upgradeUser();
      } else if (paymentStatus === 'failed') {
        toast({
          title: 'Upgrade Failed',
          description: errMsg || 'Payment was unsuccessful. Please try again.',
          variant: 'destructive'
        });
        setActiveTab('profile');
      }
    }
  }, [currentUser]);

  // Handle Login Click
  const handleLogin = async () => {
    try {
      const user = await signInWithGoogle();
      toast({
        title: 'Sign In Successful',
        description: `Welcome back, ${user.displayName || 'Member'}!`,
        variant: 'success'
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Authentication Failed',
        description: err.message || 'Could not complete Google Sign-In.',
        variant: 'destructive'
      });
    }
  };

  // Handle Logout Click
  const handleLogout = async () => {
    try {
      await signOutUser();
      setEditInvoice(null);
      toast({
        title: 'Signed Out',
        description: 'You have logged out of your cloud account.',
      });
    } catch (err) {
      toast({
        title: 'Sign Out Failed',
        description: err.message,
        variant: 'destructive'
      });
    }
  };

  // Edit Invoice transition
  const handleEditInvoice = (invoice) => {
    setEditInvoice(invoice);
    setActiveTab('builder');
    setMobileMenuOpen(false);
  };

  // Reset Edit state and switch tab
  const handleSaveSuccess = () => {
    setEditInvoice(null);
    setRefreshTrigger(prev => prev + 1); // Refresh dashboard statistics
    setActiveTab('dashboard');
  };

  // Menu items config
  const menuItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'builder', label: 'Invoice Builder', icon: FileText },
    { id: 'tools', label: 'PDF Tools', icon: ChevronDown, isDropdown: true },
    { id: 'blog', label: 'Blog', icon: BookOpen },
  ];

  const toolItems = [
    { id: 'merger', label: 'PDF Merger', icon: Combine },
    { id: 'image-to-pdf', label: 'Image to PDF', icon: ImageIcon },
  ];

  if (isBanned) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none font-sans">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-900/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-md w-full glass-card border border-rose-900/40 p-8 rounded-3xl space-y-6 shadow-2xl relative overflow-hidden">
          <div className="w-16 h-16 bg-rose-950/40 text-rose-500 border border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto shadow-lg animate-bounce">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-white">Access Suspended</h2>
            <p className="text-slate-400 text-xs leading-relaxed">
              Your account has been deactivated by the platform administrators. If you believe this is an error, please reach out to platform support.
            </p>
          </div>

          <Button 
            onClick={() => setIsBanned(false)}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-11 rounded-xl transition-all border-0 shadow-lg shadow-rose-900/30"
          >
            Acknowledge & Sign Out
          </Button>
        </div>
      </div>
    );
  }

  if (activeTab === 'admin') {
    return (
      <AdminDashboard 
        currentUser={currentUser} 
        onBackToPlatform={() => {
          window.history.pushState({}, document.title, '/');
          setActiveTab('home');
        }}
      />
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-violet-600/35 selection:text-white">
      
      {/* 1. Universal Top Header Navbar */}
      <header className="w-full border-b border-slate-850 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Brand/Logo & App Name */}
          <div 
            onClick={() => {
              setActiveTab('home');
              setEditInvoice(null);
            }}
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 active:scale-98 transition-all shrink-0"
          >
            <div className="p-1.5 bg-gradient-to-tr from-violet-600 to-indigo-500 rounded-lg text-white shadow-md shadow-violet-900/20">
              <Layers className="w-4.5 h-4.5" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-black text-white tracking-wide">BillStacker</span>
              <span className="hidden sm:inline-flex text-[9px] text-slate-500 font-bold uppercase tracking-wider bg-slate-950 px-1 py-0.5 rounded border border-slate-800/80">SaaS</span>
            </div>
          </div>

          {/* Desktop Nav Items (lg and above) */}
          <nav className="hidden lg:flex items-center gap-1.5">
            {menuItems.map((item) => {
              if (item.isDropdown) {
                const isActive = ['merger', 'image-to-pdf'].includes(activeTab);
                return (
                  <div key={item.id} className="relative">
                    <button
                      onClick={() => setToolsDropdownOpen(!toolsDropdownOpen)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                        isActive 
                          ? 'bg-violet-600/10 text-violet-400 font-bold border-b-2 border-violet-500 rounded-b-none' 
                          : 'text-slate-400 hover:text-white hover:bg-slate-850/40'
                      }`}
                    >
                      {item.label}
                      <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${toolsDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {/* Floating Dropdown Panel */}
                    {toolsDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setToolsDropdownOpen(false)} />
                        <div className="absolute left-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-xl p-1.5 z-50 animate-in fade-in duration-200">
                          {toolItems.map((tool) => {
                            const isToolActive = activeTab === tool.id;
                            const ToolIcon = tool.icon;
                            return (
                              <button
                                key={tool.id}
                                onClick={() => {
                                  setActiveTab(tool.id);
                                  setEditInvoice(null);
                                  setToolsDropdownOpen(false);
                                }}
                                className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-xs font-bold transition-all text-left ${
                                  isToolActive
                                    ? 'bg-violet-650/10 text-violet-400'
                                    : 'text-slate-400 hover:bg-slate-850 hover:text-white'
                                }`}
                              >
                                <ToolIcon className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                                {tool.label}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                );
              }

              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (item.id !== 'builder') setEditInvoice(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-violet-600/10 text-violet-400 font-bold border-b-2 border-violet-500 rounded-b-none' 
                      : 'text-slate-400 hover:text-white hover:bg-slate-850/40'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* User Account / Upgrade / Auth Section */}
          <div className="flex items-center gap-3 shrink-0">
            {currentUser?.isPremium && (
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-md">
                PRO
              </span>
            )}
            {!isMock && (
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-950/40 border border-emerald-800/60 text-emerald-450">
                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                Synced
              </span>
            )}

            {/* Admin Dashboard shortcut if admin */}
            {currentUser?.email === 'admin@billstacker.com' && activeTab !== 'admin' && (
              <Button
                onClick={() => setActiveTab('admin')}
                variant="outline"
                className="h-8 text-[10px] font-black uppercase border-violet-800/40 text-violet-400 hover:bg-violet-950/20 px-3 rounded-lg"
              >
                Admin Panel
              </Button>
            )}

            {authLoading ? (
              <div className="w-4 h-4 border-t border-r border-violet-500 rounded-full animate-spin" />
            ) : currentUser ? (
              <div className="flex items-center gap-2.5">
                <div 
                  onClick={() => setActiveTab('profile')} 
                  className="hidden sm:flex items-center gap-2 cursor-pointer p-1 rounded-lg hover:bg-slate-850/40 transition-colors"
                >
                  <img 
                    src={currentUser.photoURL || DEFAULT_AVATAR} 
                    alt="User" 
                    className="w-7 h-7 rounded-full border border-violet-650 object-cover shrink-0" 
                    onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
                  />
                  <span className="text-xs font-semibold text-white max-w-[90px] truncate">{currentUser.displayName || 'Member'}</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-455 hover:bg-slate-850 rounded-lg transition-all"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Button 
                onClick={() => setActiveTab('auth')}
                variant="outline" 
                className="h-8 text-[11px] font-black uppercase px-4 border-slate-700 bg-slate-950/40 hover:bg-violet-600 hover:text-white rounded-lg"
              >
                Sign In
              </Button>
            )}

            {/* Mobile menu toggle button */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-850 border border-slate-800/80 transition-all cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

        </div>

        {/* 1b. Mobile Navigation Drawer Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-850 bg-slate-900/95 backdrop-blur-md animate-in slide-in-from-top duration-250 py-3 px-4 space-y-1.5">
            <button
              onClick={() => { setActiveTab('home'); setMobileMenuOpen(false); }}
              className={`flex items-center gap-3 w-full px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'home' ? 'bg-violet-600/10 text-violet-405' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Home className="w-4 h-4 text-slate-500" />
              Home
            </button>
            <button
              onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
              className={`flex items-center gap-3 w-full px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'dashboard' ? 'bg-violet-600/10 text-violet-405' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 text-slate-500" />
              Dashboard
            </button>

            {/* Sub-tools category */}
            <div className="text-[10px] text-slate-600 font-bold uppercase tracking-widest px-4 pt-1.5 border-t border-slate-800/40">Invoice Utilities</div>
            {toolItems.map((tool) => {
              const ToolIcon = tool.icon;
              return (
                <button
                  key={tool.id}
                  onClick={() => {
                    setActiveTab(tool.id);
                    setEditInvoice(null);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 w-full px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all pl-6 ${
                    activeTab === tool.id ? 'bg-violet-600/10 text-violet-405' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ToolIcon className="w-3.5 h-3.5 text-slate-500" />
                  {tool.label}
                </button>
              );
            })}

            <div className="border-t border-slate-800/40 pt-1.5" />
            <button
              onClick={() => { setActiveTab('blog'); setMobileMenuOpen(false); }}
              className={`flex items-center gap-3 w-full px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'blog' ? 'bg-violet-600/10 text-violet-405' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-4 h-4 text-slate-500" />
              Blog
            </button>
            <button
              onClick={() => { setActiveTab('profile'); setMobileMenuOpen(false); }}
              className={`flex items-center gap-3 w-full px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'profile' ? 'bg-violet-600/10 text-violet-405' : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-4 h-4 text-slate-500" />
              Profile Settings
            </button>
          </div>
        )}
      </header>

      {/* 2. Main content view area (Full width container) */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Active tab routing */}
        {activeTab === 'home' && (
          <LandingPage 
            currentUser={currentUser}
            onSelectTab={(tab) => {
              setActiveTab(tab);
            }}
            onOpenAuth={() => {
              setActiveTab('auth');
            }}
          />
        )}

        {activeTab === 'auth' && (
          <AuthGateway 
            onAuthSuccess={() => {
              setActiveTab('profile');
            }}
          />
        )}

        {activeTab === 'image-to-pdf' && (
          <ImageToPdf 
            currentUser={currentUser}
          />
        )}

        {activeTab === 'dashboard' && (
          <Dashboard 
            currentUser={currentUser}
            onEditInvoice={handleEditInvoice} 
            triggerRefreshTab={refreshTrigger} 
          />
        )}
        
        {activeTab === 'builder' && (
          <InvoiceBuilder 
            currentUser={currentUser}
            editInvoiceData={editInvoice} 
            onSaveSuccess={handleSaveSuccess} 
          />
        )}
        
        {activeTab === 'merger' && (
          <PdfMerger currentUser={currentUser} />
        )}

        {activeTab === 'profile' && (
          <Profile 
            currentUser={currentUser} 
            onProfileUpdate={(profileData) => {
              setCurrentUser(prev => ({
                ...prev,
                isPremium: !!profileData?.isPremium,
                photoURL: profileData?.photoURL || prev?.photoURL
              }));
            }}
          />
        )}

        {activeTab === 'blog' && (
          <Blog currentUser={currentUser} />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
