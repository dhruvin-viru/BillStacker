import React, { useState, useEffect } from 'react';
import { ToastProvider, useToast } from './components/ui/toast';
import Dashboard from './components/Dashboard';
import InvoiceBuilder from './components/InvoiceBuilder';
import PdfMerger from './components/PdfMerger';
import PdfReducer from './components/PdfReducer';
import Profile from './components/Profile';
import { Button } from './components/ui/button';
import { 
  onAuthStateChange, 
  signInWithGoogle, 
  signOutUser,
  dbGetDefaultProfile
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
  User
} from 'lucide-react';

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editInvoice, setEditInvoice] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { toast } = useToast();

  // Listen to Auth State Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      if (user) {
        try {
          const profile = await dbGetDefaultProfile(user.uid);
          setCurrentUser({
            ...user,
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            isPremium: !!profile?.isPremium
          });
        } catch (e) {
          setCurrentUser(user);
        }
      } else {
        setCurrentUser(null);
      }
      setAuthLoading(false);
      // If user logs in/out, trigger a reload of dashboard invoices
      setRefreshTrigger(prev => prev + 1);
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

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
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'builder', label: 'Invoice Builder', icon: FileText },
    { id: 'merger', label: 'PDF Merger', icon: Combine },
    { id: 'reducer', label: 'PDF Reducer', icon: Sparkles },
    { id: 'profile', label: 'User Profile', icon: User },
  ];

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      
      {/* 1. Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-66 bg-slate-900 border-r border-slate-850 p-5 shrink-0 sticky top-0 h-screen select-none justify-between">
        
        <div className="space-y-8 flex-1 flex flex-col min-h-0">
          {/* Brand/Logo */}
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-800/40">
            <div className="p-2 bg-gradient-to-tr from-violet-600 to-indigo-500 rounded-xl text-white shadow-lg shadow-violet-900/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-wider text-white">BillStacker</h1>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest bg-slate-950/60 px-1.5 py-0.5 rounded-md border border-slate-800">SaaS Suite</span>
            </div>
          </div>

          {/* Navigation list */}
          <nav className="space-y-1.5 flex-1 overflow-y-auto pr-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (item.id !== 'builder') setEditInvoice(null); // Clear editing if leaving builder
                  }}
                  className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                    isActive 
                      ? 'bg-violet-600/10 border-l-4 border-violet-500 text-violet-400 font-bold' 
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Account Panel & Footer */}
        <div className="space-y-4 pt-4 border-t border-slate-800/50 mt-4 shrink-0">
          
          {/* Auth block */}
          {authLoading ? (
            <div className="h-12 flex items-center justify-center">
              <div className="w-4 h-4 border-t border-r border-violet-500 rounded-full animate-spin" />
            </div>
          ) : currentUser ? (
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/40 border border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                {currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt="User" 
                    className="w-8 h-8 rounded-full border border-violet-650 shrink-0" 
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-violet-600/20 text-violet-450 border border-violet-850 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0 text-left">
                  <div className="text-xs font-semibold text-white truncate">{currentUser.displayName || 'Member'}</div>
                  <div className="text-[10px] text-slate-500 truncate">{currentUser.email || ''}</div>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-rose-450 hover:bg-slate-850 rounded-md transition-all shrink-0"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Button 
              onClick={handleLogin}
              variant="outline" 
              className="w-full justify-center gap-2 text-xs font-semibold border-slate-700 bg-slate-950/40 hover:bg-violet-600 hover:text-white"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign in with Google
            </Button>
          )}

          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>v1.0.0 &copy; 2026</span>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              <Github className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </aside>

      {/* 2. Responsive Mobile Header & Drawer */}
      <div className="md:hidden w-full flex flex-col min-h-screen">
        <header className="flex items-center justify-between px-4 h-16 bg-slate-900 border-b border-slate-850 sticky top-0 z-40 select-none">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-violet-600 rounded-lg text-white">
              <Layers className="w-4 h-4" />
            </div>
            <h1 className="text-base font-extrabold text-white">BillStacker</h1>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 text-slate-400 hover:text-white rounded bg-slate-800 border border-slate-700"
          >
            <Menu className="w-5 h-5" />
          </button>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            {/* Backdrop overlay */}
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            
            {/* Drawer sheet */}
            <div className="relative flex flex-col w-72 max-w-xs bg-slate-900 h-full p-6 shadow-2xl border-r border-slate-800 z-10 animate-in slide-in-from-left duration-250 justify-between">
              <div className="flex flex-col min-h-0 flex-1">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800/40 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-violet-600 rounded-lg text-white">
                      <Layers className="w-4 h-4" />
                    </div>
                    <h2 className="text-base font-black text-white">BillStacker</h2>
                  </div>
                  <button 
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-white rounded bg-slate-850"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="space-y-1.5 flex-1 overflow-y-auto">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          setMobileMenuOpen(false);
                          if (item.id !== 'builder') setEditInvoice(null);
                        }}
                        className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                          isActive 
                            ? 'bg-violet-600/10 border-l-4 border-violet-500 text-violet-400 font-bold' 
                            : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Mobile Account Panel */}
              <div className="space-y-4 pt-4 border-t border-slate-800/50 mt-4 shrink-0">
                {currentUser ? (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/40 border border-slate-800">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {currentUser.photoURL ? (
                        <img src={currentUser.photoURL} alt="User" className="w-7 h-7 rounded-full" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-violet-600/20 text-violet-450 flex items-center justify-center"><User className="w-3.5 h-3.5" /></div>
                      )}
                      <div className="min-w-0 text-left">
                        <div className="text-xs font-semibold text-white truncate">{currentUser.displayName || 'Member'}</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-450"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <Button 
                    onClick={() => {
                      handleLogin();
                      setMobileMenuOpen(false);
                    }}
                    variant="outline" 
                    className="w-full justify-center gap-2 text-xs font-semibold border-slate-700 bg-slate-950/40"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    Sign in with Google
                  </Button>
                )}

                <div className="text-xs text-slate-500 flex items-center justify-between">
                  <span>BillStacker SaaS Suite</span>
                  <span>v1.0.0</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Main Workspace Area */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {/* Active tab routing */}
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
          <PdfMerger />
        )}
        
        {activeTab === 'reducer' && (
          <PdfReducer />
        )}

        {activeTab === 'profile' && (
          <Profile 
            currentUser={currentUser} 
            onProfileUpdate={(profileData) => {
              setCurrentUser(prev => ({
                ...prev,
                isPremium: !!profileData?.isPremium
              }));
            }}
          />
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
