import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  ArrowLeft, 
  ShieldCheck,
  TrendingUp,
  UserCheck,
  FileSpreadsheet,
  CreditCard,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  FileText,
  MessageSquare,
  Key,
  Mail,
  Check
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { useToast } from './ui/toast';
import { 
  dbGetAllProfiles, 
  dbToggleUserTier, 
  dbGetAllInvoices,
  dbGetBlogPosts,
  dbSaveBlogPost,
  dbDeleteBlogPost,
  dbToggleUserBan,
  dbGetAllFeedbacks,
  dbResolveFeedback,
  dbSendPasswordReset,
  dbSeedSampleData
} from '../firebase';

export default function AdminDashboard({ currentUser, onBackToPlatform }) {
  const { toast } = useToast();
  const [activeAdminTab, setActiveAdminTab] = useState('dashboard');
  const [loadingStats, setLoadingStats] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    premiumUsers: 0,
    freeUsers: 0,
    totalInvoices: 0,
    estimatedMRR: 0
  });

  // Users list states
  const [usersList, setUsersList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Blog CMS states
  const [blogsList, setBlogsList] = useState([]);
  const [loadingBlogs, setLoadingBlogs] = useState(false);
  const [blogEditorOpen, setBlogEditorOpen] = useState(false);
  const [currentBlog, setCurrentBlog] = useState({
    id: '',
    title: '',
    slug: '',
    published: false,
    imageUrl: '',
    body: ''
  });

  // Feedback tickets states
  const [feedbacksList, setFeedbacksList] = useState([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);
  const [errorFeedbacks, setErrorFeedbacks] = useState(null);

  // Password Reset Modal states
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  // Query Permission Error states
  const [errorStats, setErrorStats] = useState(null);
  const [errorUsers, setErrorUsers] = useState(null);
  const [errorBlogs, setErrorBlogs] = useState(null);

  const adminTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'blog', label: 'Blog CMS', icon: BookOpen },
    { id: 'tickets', label: 'Support Tickets', icon: MessageSquare }
  ];

  // Fetch Dashboard Stats dynamically
  async function fetchPlatformStats() {
    try {
      setLoadingStats(true);
      setErrorStats(null);
      const [profiles, invoices] = await Promise.all([
        dbGetAllProfiles() || [],
        dbGetAllInvoices() || []
      ]);

      const total = profiles.length;
      const premium = profiles.filter(p => p.isPremium).length;
      const free = total - premium;

      // Calculate MRR: INR Premium at 99 INR (~$1.20), others at $9.00
      let mrr = 0;
      profiles.forEach(p => {
        if (p.isPremium) {
          if (p.currency === 'INR') mrr += 1.20;
          else mrr += 9.00;
        }
      });

      setStats({
        totalUsers: total,
        premiumUsers: premium,
        freeUsers: free,
        totalInvoices: invoices.length,
        estimatedMRR: mrr
      });
    } catch (err) {
      console.error('Failed to load admin stats:', err);
      setErrorStats(err.message || err.toString());
    } finally {
      setLoadingStats(false);
    }
  }

  // Fetch Users List
  async function fetchUsers() {
    try {
      setLoadingUsers(true);
      setErrorUsers(null);
      const data = await dbGetAllProfiles() || [];
      const sorted = data.sort((a, b) => {
        if (a.isAdmin && !b.isAdmin) return -1;
        if (!a.isAdmin && b.isAdmin) return 1;
        return new Date(b.joinedDate || 0) - new Date(a.joinedDate || 0);
      });
      setUsersList(sorted);
    } catch (err) {
      console.error(err);
      setErrorUsers(err.message || err.toString());
      toast({
        title: 'Error Loading Users',
        description: 'Failed to fetch registered user profiles.',
        variant: 'destructive'
      });
    } finally {
      setLoadingUsers(false);
    }
  }

  // Fetch Blog Posts
  async function fetchBlogs() {
    try {
      setLoadingBlogs(true);
      setErrorBlogs(null);
      const data = await dbGetBlogPosts(true) || []; // includeDrafts = true
      setBlogsList(data);
    } catch (err) {
      console.error(err);
      setErrorBlogs(err.message || err.toString());
      toast({
        title: 'Error Loading Blogs',
        description: 'Failed to fetch platform blog posts.',
        variant: 'destructive'
      });
    } finally {
      setLoadingBlogs(false);
    }
  }

  // Fetch Feedback Tickets
  async function fetchFeedbacks() {
    try {
      setLoadingFeedbacks(true);
      setErrorFeedbacks(null);
      const data = await dbGetAllFeedbacks() || [];
      setFeedbacksList(data);
    } catch (err) {
      console.error(err);
      setErrorFeedbacks(err.message || err.toString());
      toast({
        title: 'Error Loading Tickets',
        description: 'Failed to fetch support feedback tickets.',
        variant: 'destructive'
      });
    } finally {
      setLoadingFeedbacks(false);
    }
  }

  // Resolve support ticket
  const handleResolveTicket = async (ticketId) => {
    try {
      await dbResolveFeedback(ticketId);
      setFeedbacksList(prev => prev.map(f => f.id === ticketId ? { ...f, status: 'Solved', resolvedAt: new Date().toISOString() } : f));
      toast({
        title: 'Ticket Solved',
        description: 'Feedback ticket marked as resolved.',
        variant: 'success'
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Action Failed',
        description: 'Could not update ticket status.',
        variant: 'destructive'
      });
    }
  };

  // Trigger Admin Password Reset
  const handleAdminResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast({
        title: 'Validation Error',
        description: 'Password must be at least 6 characters.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setResettingPassword(true);
      // Attempt backend Admin SDK direct update first
      const response = await fetch('/api/admin/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: resetUser.id, newPassword })
      });

      const resData = await response.json();

      if (response.ok) {
        toast({
          title: 'Password Updated',
          description: `Password for ${resetUser.name} has been updated directly.`,
          variant: 'success'
        });
        setPasswordModalOpen(false);
        setNewPassword('');
      } else {
        // Direct admin SDK not active, fallback to trigger reset email!
        console.warn('Backend admin SDK failed or inactive:', resData.error);
        toast({
          title: 'Admin SDK Inactive',
          description: 'Direct update failed. Triggering recovery email...',
          variant: 'warning'
        });

        await dbSendPasswordReset(resetUser.email);
        toast({
          title: 'Recovery Email Sent',
          description: `Password reset email successfully sent to ${resetUser.email}.`,
          variant: 'success'
        });
        setPasswordModalOpen(false);
        setNewPassword('');
      }
    } catch (err) {
      // Catch exceptions and try client recovery email
      console.error('Direct change error, trying email fallback:', err);
      try {
        await dbSendPasswordReset(resetUser.email);
        toast({
          title: 'Recovery Email Sent',
          description: `Direct change unavailable. Password reset link sent to ${resetUser.email}.`,
          variant: 'success'
        });
        setPasswordModalOpen(false);
        setNewPassword('');
      } catch (emailErr) {
        toast({
          title: 'Action Failed',
          description: emailErr.message,
          variant: 'destructive'
        });
      }
    } finally {
      setResettingPassword(false);
    }
  };

  const [seeding, setSeeding] = useState(false);
  
  const handleSeedData = async () => {
    try {
      setSeeding(true);
      await dbSeedSampleData();
      toast({
        title: 'Seeding Complete',
        description: 'Successfully populated Firestore with sample blogs and support tickets.',
        variant: 'success'
      });
      if (activeAdminTab === 'dashboard') {
        fetchPlatformStats();
      } else if (activeAdminTab === 'users') {
        fetchUsers();
      } else if (activeAdminTab === 'blog') {
        fetchBlogs();
      } else if (activeAdminTab === 'tickets') {
        fetchFeedbacks();
      }
    } catch (err) {
      toast({
        title: 'Seeding Failed',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    if (activeAdminTab === 'dashboard') {
      fetchPlatformStats();
    } else if (activeAdminTab === 'users') {
      fetchUsers();
    } else if (activeAdminTab === 'blog') {
      fetchBlogs();
    } else if (activeAdminTab === 'tickets') {
      fetchFeedbacks();
    }
  }, [activeAdminTab]);

  // Toggle user tier
  const handleToggleTier = async (userId, currentPremiumState, userName) => {
    try {
      const targetState = !currentPremiumState;
      await dbToggleUserTier(userId, targetState);
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, isPremium: targetState } : u));
      toast({
        title: 'Subscription Tier Altered',
        description: `Successfully toggled ${userName || 'User'} to ${targetState ? 'Premium (PRO)' : 'Free'}.`,
        variant: 'success'
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Tier Adjustment Failed',
        description: `Could not alter subscription settings for ${userName || 'user'}.`,
        variant: 'destructive'
      });
    }
  };

  // Toggle user ban state
  const handleToggleBan = async (userId, currentBanState, userName) => {
    try {
      const targetState = !currentBanState;
      if (targetState) {
        if (!window.confirm(`Are you sure you want to suspend/ban user "${userName}"? They will be blocked from accessing the platform immediately.`)) return;
      }
      
      await dbToggleUserBan(userId, targetState);
      setUsersList(prev => prev.map(u => u.id === userId ? { ...u, isBanned: targetState } : u));
      toast({
        title: targetState ? 'User Account Suspended' : 'User Account Re-activated',
        description: `Successfully toggled ban state for ${userName || 'User'}.`,
        variant: targetState ? 'destructive' : 'success'
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Action Failed',
        description: `Could not alter access rules for ${userName || 'user'}.`,
        variant: 'destructive'
      });
    }
  };

  // Blog CRUD Handlers
  const handleCreateNewBlog = () => {
    setCurrentBlog({
      id: '',
      title: '',
      slug: '',
      published: false,
      imageUrl: '',
      body: ''
    });
    setBlogEditorOpen(true);
  };

  const handleEditBlog = (blog) => {
    setCurrentBlog(blog);
    setBlogEditorOpen(true);
  };

  const handleDeleteBlog = async (blogId, blogTitle) => {
    if (!window.confirm(`Are you sure you want to delete the blog post "${blogTitle}"?`)) return;
    try {
      await dbDeleteBlogPost(blogId);
      setBlogsList(prev => prev.filter(b => b.id !== blogId));
      toast({
        title: 'Post Deleted',
        description: `Successfully deleted "${blogTitle}".`,
        variant: 'success'
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Delete Failed',
        description: 'Failed to delete blog post.',
        variant: 'destructive'
      });
    }
  };

  const handleSaveBlog = async (e, forcePublish = null) => {
    e.preventDefault();
    if (!currentBlog.title || !currentBlog.slug || !currentBlog.body) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all fields.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const isPublishState = forcePublish !== null ? forcePublish : currentBlog.published;
      const updatedBlog = {
        ...currentBlog,
        published: isPublishState
      };
      
      const saved = await dbSaveBlogPost(updatedBlog);
      
      if (currentBlog.id) {
        setBlogsList(prev => prev.map(b => b.id === currentBlog.id ? saved : b));
      } else {
        setBlogsList(prev => [saved, ...prev]);
      }

      toast({
        title: isPublishState ? 'Post Published' : 'Draft Saved',
        description: `Successfully saved "${currentBlog.title}".`,
        variant: 'success'
      });
      setBlogEditorOpen(false);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Save Failed',
        description: 'Failed to save blog post.',
        variant: 'destructive'
      });
    }
  };

  // Slug Auto-Generation
  const handleTitleChange = (val) => {
    const generatedSlug = val
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    
    setCurrentBlog(prev => ({
      ...prev,
      title: val,
      slug: prev.id ? prev.slug : generatedSlug
    }));
  };

  // Format Date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  // Filter users
  const filteredUsers = usersList.filter(user => {
    const name = (user.senderInfo?.name || '').toLowerCase();
    const email = (user.senderInfo?.email || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return name.includes(query) || email.includes(query);
  });

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-950 text-slate-100 font-sans">
      
      {/* Admin Sidebar Layout */}
      <aside className="w-full lg:w-64 bg-slate-900 border-r border-slate-850 p-5 flex flex-col justify-between shrink-0 font-sans select-none">
        <div className="space-y-6">
          
          {/* Header Brand */}
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800/40">
            <div className="p-2 bg-gradient-to-tr from-violet-600 to-fuchsia-500 rounded-xl text-white shadow-lg shadow-violet-900/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-wide">Admin Console</h1>
              <span className="text-[10px] text-violet-400 font-semibold tracking-wider uppercase">BillStacker Manager</span>
            </div>
          </div>

          {/* Admin Navigation */}
          <nav className="space-y-1.5">
            {adminTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeAdminTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveAdminTab(tab.id);
                    setBlogEditorOpen(false);
                  }}
                  className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                    isActive 
                      ? 'bg-violet-600/10 text-violet-400 font-bold border-l-4 border-violet-500' 
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Back Button */}
        <div className="pt-4 border-t border-slate-800/50 mt-6 lg:mt-0">
          <Button 
            onClick={onBackToPlatform}
            variant="outline"
            className="w-full gap-2 border-slate-700 bg-slate-950/40 hover:bg-slate-850 text-slate-350 hover:text-white text-xs font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Platform
          </Button>
        </div>
      </aside>

      {/* Main Admin Content pane */}
      <main className="flex-1 p-6 lg:p-10 overflow-y-auto max-w-7xl mx-auto w-full">
        
        {/* Dynamic header title */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-850 mb-8">
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              {activeAdminTab === 'dashboard' && 'System Analytics'}
              {activeAdminTab === 'users' && 'User Account Management'}
              {activeAdminTab === 'blog' && (blogEditorOpen ? 'Compose Blog Post' : 'Content Management (CMS)')}
              {activeAdminTab === 'tickets' && 'Support Tickets & Feedback'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {activeAdminTab === 'dashboard' && 'Monitor platform stats and registration logs.'}
              {activeAdminTab === 'users' && 'View, search, and upgrade platform users.'}
              {activeAdminTab === 'blog' && (blogEditorOpen ? 'Write details and save or publish immediately.' : 'Compose, edit, and publish blog announcements.')}
              {activeAdminTab === 'tickets' && 'Audit and resolve user feedback requests.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSeedData}
              disabled={seeding}
              variant="outline"
              className="border-violet-855 hover:bg-violet-950/20 text-violet-400 text-[11px] font-black uppercase px-3.5 py-1.5 h-auto rounded-xl flex items-center gap-1.5 shrink-0"
            >
              {seeding ? 'Seeding...' : 'Seed Sample Data'}
            </Button>
            <div className="flex items-center gap-2 text-xs bg-violet-950/30 border border-violet-800/40 text-violet-450 px-3 py-1.5 rounded-full font-medium shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse shrink-0" />
              Secure Session Verified
            </div>
          </div>
        </div>

        {/* Tab Routing */}
        
        {/* Tab 1: Dashboard Analytics */}
        {activeAdminTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {errorStats && (
              <div className="p-4 bg-rose-950/20 border border-rose-900/40 text-rose-350 rounded-2xl text-xs space-y-1">
                <div className="font-extrabold uppercase tracking-wider text-rose-400">Firestore Access Blocked</div>
                <p>Failed to retrieve system metrics: <strong>{errorStats}</strong></p>
                <p className="text-[10px] text-slate-500 leading-relaxed pt-1">
                  This error occurs because the client SDK is blocked by your Firestore Security Rules. Ensure you have deployed rules that allow listing profiles, invoices, and blogs.
                </p>
              </div>
            )}
            {loadingStats ? (
              <div className="flex items-center justify-center h-48">
                <div className="w-6 h-6 border-t-2 border-r-2 border-violet-500 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="glass-card relative overflow-hidden group border-slate-850">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-violet-650/10 rounded-full blur-2xl group-hover:bg-violet-600/20 transition-all" />
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400">Total Registered Users</CardTitle>
                    <div className="p-2 rounded-lg bg-violet-600/10 text-violet-400">
                      <Users className="h-4 w-4" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-black text-white">{stats.totalUsers}</div>
                    <p className="text-xs text-slate-500 mt-1">Total profiles registered</p>
                  </CardContent>
                </Card>

                <Card className="glass-card relative overflow-hidden group border-slate-850">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-650/10 rounded-full blur-2xl group-hover:bg-emerald-650/20 transition-all" />
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400">PRO Premium Accounts</CardTitle>
                    <div className="p-2 rounded-lg bg-emerald-600/10 text-emerald-450">
                      <UserCheck className="h-4 w-4" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-black text-white">{stats.premiumUsers}</div>
                    <p className="text-xs text-emerald-500 mt-1">
                      {stats.totalUsers > 0 
                        ? `${Math.round((stats.premiumUsers / stats.totalUsers) * 100)}% conversion rate`
                        : '0% conversion'}
                    </p>
                  </CardContent>
                </Card>

                <Card className="glass-card relative overflow-hidden group border-slate-850">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-650/10 rounded-full blur-2xl group-hover:bg-blue-600/20 transition-all" />
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400">Platform Invoices</CardTitle>
                    <div className="p-2 rounded-lg bg-blue-600/10 text-blue-400">
                      <FileSpreadsheet className="h-4 w-4" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-black text-white">{stats.totalInvoices}</div>
                    <p className="text-xs text-slate-505 mt-1">Compiled platform receipts</p>
                  </CardContent>
                </Card>

                <Card className="glass-card relative overflow-hidden group border-slate-850">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-650/10 rounded-full blur-2xl group-hover:bg-amber-650/20 transition-all" />
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400">Estimated MRR</CardTitle>
                    <div className="p-2 rounded-lg bg-amber-600/10 text-amber-500">
                      <CreditCard className="h-4 w-4" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-black text-white">${stats.estimatedMRR.toFixed(2)}</div>
                    <p className="text-xs text-slate-500 mt-1">Est. monthly recurring revenue</p>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card className="glass-card p-6 border-slate-850">
              <h3 className="text-lg font-bold text-white mb-2">Platform Administration Logs</h3>
              <p className="text-sm text-slate-400 mb-4">You are authorized to audit users and manage the public CMS. Changes applied here immediately sync to Firestore/Local Storage.</p>
              <div className="flex gap-4">
                <Button 
                  onClick={() => setActiveAdminTab('users')}
                  className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-4 py-2 text-xs rounded-xl border-0"
                >
                  Manage Users
                </Button>
                <Button 
                  onClick={() => setActiveAdminTab('blog')}
                  className="bg-slate-900 border border-slate-800 hover:bg-slate-855 text-slate-300 font-bold px-4 py-2 text-xs rounded-xl"
                >
                  Publish Blog Posts
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Tab 2: Users Management */}
        {activeAdminTab === 'users' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {errorUsers && (
              <div className="p-4 bg-rose-950/20 border border-rose-900/40 text-rose-350 rounded-2xl text-xs space-y-1">
                <div className="font-extrabold uppercase tracking-wider text-rose-400">Firestore Access Blocked</div>
                <p>Failed to retrieve registered users: <strong>{errorUsers}</strong></p>
                <p className="text-[10px] text-slate-500 leading-relaxed pt-1">
                  This error occurs because the client SDK is blocked by your Firestore Security Rules. Ensure you have deployed rules that allow authenticated users to list the /profiles collection.
                </p>
              </div>
            )}
            {/* Search filter bar */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center bg-slate-900/40 p-4 rounded-xl border border-slate-850">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search users by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10.5 pl-10 pr-4 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 focus:border-violet-500/50 outline-none text-sm"
                />
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <Button 
                onClick={fetchUsers}
                variant="outline"
                className="border-slate-800 bg-slate-950/40 hover:bg-slate-850 text-xs font-semibold h-10.5 px-4 rounded-xl"
              >
                Refresh List
              </Button>
            </div>

            {/* Users Table Card */}
            <Card className="glass-card overflow-hidden border-slate-850">
              {loadingUsers ? (
                <div className="flex items-center justify-center h-64">
                  <div className="w-6 h-6 border-t-2 border-r-2 border-violet-500 rounded-full animate-spin" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-12 text-center text-slate-500 space-y-2">
                  <Users className="w-8 h-8 mx-auto text-slate-750" />
                  <p className="text-sm font-semibold">No registered users found</p>
                  <p className="text-xs">Adjust your search filter or add mock accounts.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 bg-slate-900/30 text-slate-400 text-xs uppercase font-bold tracking-wider">
                        <th className="p-4 pl-6">Name</th>
                        <th className="p-4">Email</th>
                        <th className="p-4">Joined Date</th>
                        <th className="p-4">Subscription Tier</th>
                        <th className="p-4 pr-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/40 text-sm">
                      {filteredUsers.map((user) => {
                        const name = user.senderInfo?.name || 'Anonymous User';
                        const email = user.senderInfo?.email || 'N/A';
                        return (
                          <tr key={user.id} className="hover:bg-slate-900/20 transition-colors">
                            <td className="p-4 pl-6 font-semibold text-white">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span>{name}</span>
                                {user.isAdmin && (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-violet-650/20 text-violet-400 border border-violet-500/20">
                                    Admin
                                  </span>
                                )}
                                {user.isBanned && (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-rose-600/20 text-rose-450 border border-rose-500/20 shadow-sm animate-pulse">
                                    Banned
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-slate-350">{email}</td>
                            <td className="p-4 text-slate-400 font-mono text-xs">{formatDate(user.joinedDate)}</td>
                            <td className="p-4">
                              {user.isPremium ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-md">
                                  PRO Premium
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-slate-800 text-slate-400 border border-slate-700/50">
                                  Free Tier
                                </span>
                              )}
                            </td>
                            <td className="p-4 pr-6 text-right">
                              <div className="flex items-center justify-end gap-2.5">
                                <Button
                                  onClick={() => {
                                    setResetUser({ id: user.id, name, email });
                                    setPasswordModalOpen(true);
                                  }}
                                  variant="outline"
                                  className="text-[10px] uppercase font-black px-3.5 py-1.5 h-auto rounded-lg bg-slate-950/40 border border-slate-800 text-slate-300 hover:bg-slate-850 hover:text-white flex items-center gap-1"
                                >
                                  <Key className="w-3 h-3" />
                                  Password
                                </Button>

                                <Button
                                  onClick={() => handleToggleTier(user.id, !!user.isPremium, name)}
                                  variant="outline"
                                  disabled={user.isBanned}
                                  className={`text-[10px] uppercase font-black px-3.5 py-1.5 h-auto rounded-lg transition-all active:scale-95 border-0 ${
                                    user.isPremium 
                                      ? 'bg-rose-955/25 hover:bg-rose-900/20 text-rose-450 disabled:opacity-40' 
                                      : 'bg-emerald-955/25 hover:bg-emerald-900/20 text-emerald-450 disabled:opacity-40'
                                  }`}
                                >
                                  {user.isPremium ? 'Demote to Free' : 'Promote to PRO'}
                                </Button>

                                {user.id !== currentUser?.uid && !user.isAdmin && (
                                  <Button
                                    onClick={() => handleToggleBan(user.id, !!user.isBanned, name)}
                                    variant="outline"
                                    className={`text-[10px] uppercase font-black px-3.5 py-1.5 h-auto rounded-lg transition-all active:scale-95 border-0 ${
                                      user.isBanned
                                        ? 'bg-emerald-950/20 text-emerald-400 hover:bg-emerald-950/40'
                                        : 'bg-rose-950/20 text-rose-400 hover:bg-rose-900/20'
                                    }`}
                                  >
                                    {user.isBanned ? 'Unban' : 'Ban'}
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Tab 3: Blog CMS (Phase 3) */}
        {activeAdminTab === 'blog' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {errorBlogs && (
              <div className="p-4 bg-rose-950/20 border border-rose-900/40 text-rose-350 rounded-2xl text-xs space-y-1">
                <div className="font-extrabold uppercase tracking-wider text-rose-400">Firestore Access Blocked</div>
                <p>Failed to retrieve blog posts: <strong>{errorBlogs}</strong></p>
                <p className="text-[10px] text-slate-500 leading-relaxed pt-1">
                  This error occurs because the client SDK is blocked by your Firestore Security Rules. Ensure you have deployed rules that allow authenticated users to list the /blogs collection.
                </p>
              </div>
            )}
            {blogEditorOpen ? (
              /* Editor Form Panel */
              <Card className="glass-card border-slate-850 p-6">
                <form onSubmit={handleSaveBlog} className="space-y-5">
                  <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-3">
                    {currentBlog.id ? 'Modify Blog Post' : 'Compose Blog Post'}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">Post Title *</label>
                      <input
                        type="text"
                        placeholder="e.g. Scaling Web Application Performance"
                        value={currentBlog.title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        className="w-full h-11 px-4 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 focus:border-violet-500/50 outline-none text-sm"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">Slug Path *</label>
                      <input
                        type="text"
                        placeholder="e.g. scaling-web-app-performance"
                        value={currentBlog.slug}
                        onChange={(e) => setCurrentBlog(prev => ({ ...prev, slug: e.target.value }))}
                        className="w-full h-11 px-4 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 focus:border-violet-500/50 outline-none text-sm font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Cover Image URL</label>
                    <input
                      type="url"
                      placeholder="e.g. https://images.unsplash.com/photo-1554224155-8d04cb21cd6c"
                      value={currentBlog.imageUrl || ''}
                      onChange={(e) => setCurrentBlog(prev => ({ ...prev, imageUrl: e.target.value }))}
                      className="w-full h-11 px-4 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 focus:border-violet-500/50 outline-none text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-400 uppercase">Body Content (Markdown Supported) *</label>
                      <span className="text-[10px] text-slate-500 font-semibold uppercase">Use raw markdown spacing</span>
                    </div>
                    <textarea
                      placeholder="Write your article details here. Markdown headers, lists, code snippets, and links will render natively..."
                      value={currentBlog.body}
                      onChange={(e) => setCurrentBlog(prev => ({ ...prev, body: e.target.value }))}
                      rows={12}
                      className="w-full p-4 bg-slate-955 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 focus:border-violet-500/50 outline-none text-sm font-mono leading-relaxed"
                      required
                    />
                  </div>

                  <div className="flex items-center justify-between bg-slate-900/30 p-4 rounded-xl border border-slate-800/80">
                    <div>
                      <div className="text-xs font-bold text-white uppercase">Visibility Settings</div>
                      <p className="text-[10px] text-slate-500 mt-0.5">Toggle whether the post is visible on the public feed immediately.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentBlog(prev => ({ ...prev, published: !prev.published }))}
                      className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold uppercase transition-all select-none ${
                        currentBlog.published
                          ? 'bg-emerald-950/40 border-emerald-500 text-emerald-450 shadow-md shadow-emerald-500/5'
                          : 'bg-slate-950/30 border-slate-800 text-slate-400'
                      }`}
                    >
                      <CheckCircle className={`w-3.5 h-3.5 ${currentBlog.published ? 'text-emerald-400' : 'text-slate-600'}`} />
                      {currentBlog.published ? 'Published' : 'Save as Draft'}
                    </button>
                  </div>

                  <div className="flex gap-3 justify-end pt-3 border-t border-slate-800">
                    <Button
                      type="button"
                      onClick={() => setBlogEditorOpen(false)}
                      variant="outline"
                      className="border-slate-800 bg-slate-950/40 hover:bg-slate-850 text-xs font-semibold px-5 py-2.5 h-auto rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={(e) => handleSaveBlog(e, false)}
                      className="bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-300 text-xs font-bold px-5 py-2.5 h-auto rounded-xl"
                    >
                      Save Draft
                    </Button>
                    <Button
                      type="submit"
                      className="bg-violet-600 hover:bg-violet-750 text-white text-xs font-bold px-5 py-2.5 h-auto rounded-xl border-0"
                    >
                      Publish Post
                    </Button>
                  </div>
                </form>
              </Card>
            ) : (
              /* CMS List Panel */
              <>
                <div className="flex justify-between items-center bg-slate-900/40 p-4 rounded-xl border border-slate-850">
                  <span className="text-sm font-semibold text-slate-450">Platform articles list</span>
                  <Button
                    onClick={handleCreateNewBlog}
                    className="bg-violet-650 hover:bg-violet-750 text-white font-bold text-xs h-9 px-4 rounded-xl border-0 flex items-center gap-1.5 shadow-md shadow-violet-900/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Compose Post
                  </Button>
                </div>

                <Card className="glass-card overflow-hidden border-slate-850">
                  {loadingBlogs ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="w-6 h-6 border-t-2 border-r-2 border-violet-500 rounded-full animate-spin" />
                    </div>
                  ) : blogsList.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 space-y-2">
                      <BookOpen className="w-8 h-8 mx-auto text-slate-700" />
                      <p className="text-sm font-semibold">No blog posts found</p>
                      <p className="text-xs">Click "Compose Post" to create your first platform article.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-850 bg-slate-900/30 text-slate-400 text-xs uppercase font-bold tracking-wider">
                            <th className="p-4 pl-6">Post Details</th>
                            <th className="p-4">Slug Path</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Updated Date</th>
                            <th className="p-4 pr-6 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850/40 text-sm">
                          {blogsList.map((blog) => (
                            <tr key={blog.id} className="hover:bg-slate-900/20 transition-colors">
                              <td className="p-4 pl-6 font-semibold text-white">
                                <div>{blog.title}</div>
                                <div className="text-[10px] text-slate-500 truncate max-w-xs font-normal mt-0.5">{blog.body}</div>
                              </td>
                              <td className="p-4 text-slate-450 font-mono text-xs">/blog/{blog.slug}</td>
                              <td className="p-4">
                                {blog.published ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-950/40 border border-emerald-800/60 text-emerald-450">
                                    Published
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-800 text-slate-400 border border-slate-700/50">
                                    Draft
                                  </span>
                                )}
                              </td>
                              <td className="p-4 text-slate-400 text-xs">{formatDate(blog.updatedAt)}</td>
                              <td className="p-4 pr-6 text-right">
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    onClick={() => handleEditBlog(blog)}
                                    variant="outline"
                                    className="p-1.5 h-8 w-8 rounded-lg border-slate-800 hover:bg-slate-850 hover:text-white"
                                    title="Edit Article"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    onClick={() => handleDeleteBlog(blog.id, blog.title)}
                                    variant="outline"
                                    className="p-1.5 h-8 w-8 rounded-lg border-slate-800 hover:bg-rose-950/20 text-slate-400 hover:text-rose-400 hover:border-rose-900/50"
                                    title="Delete Article"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </>
            )}
          </div>
        )}

        {/* Tab 4: Support Tickets (Inquiries) */}
        {activeAdminTab === 'tickets' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {errorFeedbacks && (
              <div className="p-4 bg-rose-950/20 border border-rose-900/40 text-rose-350 rounded-2xl text-xs space-y-1">
                <div className="font-extrabold uppercase tracking-wider text-rose-450">Firestore Access Blocked</div>
                <p>Failed to retrieve feedbacks: <strong>{errorFeedbacks}</strong></p>
                <p className="text-[10px] text-slate-500 leading-relaxed pt-1">
                  This error occurs because the client SDK is blocked by your Firestore Security Rules. Ensure you have deployed rules that allow listing the /feedback collection.
                </p>
              </div>
            )}
            
            <Card className="glass-card overflow-hidden border-slate-850">
              {loadingFeedbacks ? (
                <div className="flex items-center justify-center h-64">
                  <div className="w-6 h-6 border-t-2 border-r-2 border-violet-500 rounded-full animate-spin" />
                </div>
              ) : feedbacksList.length === 0 ? (
                <div className="p-12 text-center text-slate-500 space-y-2">
                  <MessageSquare className="w-8 h-8 mx-auto text-slate-750" />
                  <p className="text-sm font-semibold">No feedback tickets found</p>
                  <p className="text-xs">Any user bug reports or feature queries will show up here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 bg-slate-900/30 text-slate-400 text-xs uppercase font-bold tracking-wider">
                        <th className="p-4 pl-6">Contact / User</th>
                        <th className="p-4">Type</th>
                        <th className="p-4">Message</th>
                        <th className="p-4">Submitted Date</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 pr-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/40 text-sm">
                      {feedbacksList.map((ticket) => (
                        <tr key={ticket.id} className="hover:bg-slate-900/20 transition-colors">
                          <td className="p-4 pl-6 font-semibold text-white">
                            <div>{ticket.userName || 'Anonymous'}</div>
                            <div className="text-[10px] text-slate-500 font-normal mt-0.5">{ticket.userEmail}</div>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-violet-600/10 text-violet-400 border border-violet-500/20">
                              {ticket.type}
                            </span>
                          </td>
                          <td className="p-4 text-slate-300 max-w-sm">
                            <p className="line-clamp-3 text-xs leading-relaxed">{ticket.message}</p>
                          </td>
                          <td className="p-4 text-slate-400 font-mono text-xs">{formatDate(ticket.createdAt)}</td>
                          <td className="p-4">
                            {ticket.status === 'Solved' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black text-emerald-400 uppercase bg-emerald-950/20 border border-emerald-900/30 shadow-md">
                                <Check className="w-2.5 h-2.5" /> Solved
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black text-amber-450 uppercase bg-amber-950/20 border border-amber-900/30 animate-pulse">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="p-4 pr-6 text-right">
                            {ticket.status === 'Pending' ? (
                              <Button
                                onClick={() => handleResolveTicket(ticket.id)}
                                variant="outline"
                                className="text-[10px] uppercase font-black px-3.5 py-1.5 h-auto rounded-lg bg-emerald-950/20 text-emerald-400 hover:bg-emerald-950/40 border-0"
                              >
                                Mark Solved
                              </Button>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-semibold uppercase">Closed</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Global Password Reset Modal */}
        {passwordModalOpen && resetUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-slate-900 border border-slate-850 rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-slate-850 flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-white">Reset User Password</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Changing credentials for {resetUser.name}</p>
                </div>
                <button
                  onClick={() => {
                    setPasswordModalOpen(false);
                    setNewPassword('');
                    setShowResetPassword(false);
                  }}
                  className="p-1.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white shrink-0"
                >
                  <span className="text-xs px-1 font-bold">✕</span>
                </button>
              </div>

              <form onSubmit={handleAdminResetPassword} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Target Account Email</label>
                  <input
                    type="text"
                    value={resetUser.email}
                    disabled
                    className="w-full h-11 px-4 bg-slate-950/40 border border-slate-850 rounded-xl text-slate-550 outline-none text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">New Password *</label>
                  <div className="relative">
                    <input
                      type={showResetPassword ? "text" : "password"}
                      placeholder="Enter new 6+ character password..."
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full h-11 pl-4 pr-12 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-655 focus:border-violet-500/50 outline-none text-xs"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-slate-500 hover:text-white select-none transition-colors"
                    >
                      {showResetPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={resettingPassword}
                  className="w-full h-11 bg-violet-600 hover:bg-violet-550 text-white font-bold text-xs rounded-xl border-0 shadow-lg shadow-violet-900/30 flex items-center justify-center gap-1.5"
                >
                  {resettingPassword ? 'Updating Password...' : 'Save New Password'}
                </Button>

                <div className="border-t border-slate-850/60 pt-4 mt-2">
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">Alternative Option</div>
                  <Button
                    type="button"
                    onClick={async () => {
                      try {
                        setResettingPassword(true);
                        await dbSendPasswordReset(resetUser.email);
                        toast({
                          title: 'Recovery Link Dispatched',
                          description: `A password reset link was sent to ${resetUser.email}.`,
                          variant: 'success'
                        });
                        setPasswordModalOpen(false);
                        setNewPassword('');
                        setShowResetPassword(false);
                      } catch (err) {
                        toast({
                          title: 'Send Link Failed',
                          description: err.message,
                          variant: 'destructive'
                        });
                      } finally {
                        setResettingPassword(false);
                      }
                    }}
                    disabled={resettingPassword}
                    variant="outline"
                    className="w-full h-10 border-slate-800 hover:bg-slate-850 text-slate-300 hover:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Send Reset Link Email to User
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
