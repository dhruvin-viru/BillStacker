import React, { useState, useEffect } from 'react';
import { dbGetReviews, dbSaveReview, isMock, dbGetBlogPosts } from '../firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { useToast } from './ui/toast';
import AdBanner from './AdBanner';
import { 
  Sparkles, 
  FileText, 
  Layers, 
  Zap, 
  Image as ImageIcon, 
  Star, 
  ArrowRight, 
  ShieldCheck, 
  Check, 
  Send,
  MessageSquareQuote,
  Calendar,
  BookOpen
} from 'lucide-react';

export default function LandingPage({ currentUser, onSelectTab, onOpenAuth }) {
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  
  // Blog states
  const [blogs, setBlogs] = useState([]);
  const [loadingBlogs, setLoadingBlogs] = useState(true);
  const [selectedBlog, setSelectedBlog] = useState(null);

  const { toast } = useToast();

  const loadReviews = async () => {
    try {
      setLoadingReviews(true);
      const data = await dbGetReviews();
      if (data) {
        setReviews(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReviews(false);
    }
  };

  const loadBlogs = async () => {
    try {
      setLoadingBlogs(true);
      const data = await dbGetBlogPosts(false) || []; // false = published only
      setBlogs(data.slice(0, 3)); // show top 3 recent blogs
    } catch (err) {
      console.error('Failed to load home page blog posts:', err);
    } finally {
      setLoadingBlogs(false);
    }
  };

  useEffect(() => {
    loadReviews();
    loadBlogs();
  }, []);

  const handleAddReview = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!comment.trim()) {
      toast({
        title: 'Error',
        description: 'Please write a comment before submitting.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setSubmittingReview(true);
      const reviewData = {
        userId: currentUser.uid,
        userName: currentUser.displayName || 'Anonymous Member',
        userPhoto: currentUser.photoURL || 'https://avatar.iran.liara.run/public/30',
        rating: rating,
        comment: comment.trim()
      };
      
      await dbSaveReview(reviewData);
      toast({
        title: 'Thank you!',
        description: 'Your testimonial has been posted successfully.',
        variant: 'success'
      });
      setComment('');
      setRating(5);
      await loadReviews();
    } catch (err) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="space-y-20 pb-20 relative">
      {/* Decorative Blur Orbs */}
      <div className="absolute top-10 right-10 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-[800px] left-10 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Hero Section */}
      <section className="text-center pt-10 sm:pt-16 max-w-4xl mx-auto space-y-6 px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-violet-600/10 text-violet-400 border border-violet-500/20 shadow-md">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Supercharged PDF & Invoice Workspace</span>
        </div>
        
        <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight">
          Modern Document Tools <br/>
          <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
            Built for High-Growth Teams
          </span>
        </h1>
        
        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto font-medium">
          Create premium styled client invoices, compile multi-page image streams, merge documents instantly, and compress files to any size with ease.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Button 
            onClick={() => onSelectTab('builder')}
            className="w-full sm:w-auto h-12 px-6 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-violet-900/35 border-0 rounded-xl"
          >
            Create Invoices
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button 
            variant="outline"
            onClick={() => onSelectTab('merger')}
            className="w-full sm:w-auto h-12 px-6 border-slate-800 hover:bg-slate-900/50 hover:text-white text-slate-330 font-semibold rounded-xl"
          >
            Merge & Compress PDFs
          </Button>
        </div>
      </section>

      {/* Core Features Bento Grid */}
      <section className="space-y-6 px-4">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Full-Featured Utility Workspace</h2>
          <p className="text-sm text-slate-400">Everything you need to handle documents, billing, and conversions instantly.</p>
        </div>

        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
          {/* Invoice Builder */}
          <Card className="glass-card hover-glow border border-slate-900 hover:border-slate-800 transition-all duration-300 group cursor-pointer" onClick={() => onSelectTab('builder')}>
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-lg bg-violet-600/10 text-violet-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg font-bold text-white pt-2">Invoice Builder</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400 leading-relaxed">
                Choose from 10 dynamic designer templates. Add watermark tags, customize defaults, and generate A4 invoices.
              </p>
            </CardContent>
          </Card>

          {/* PDF Merger */}
          <Card className="glass-card hover-glow border border-slate-900 hover:border-slate-800 transition-all duration-300 group cursor-pointer" onClick={() => onSelectTab('merger')}>
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-600/10 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg font-bold text-white pt-2">PDF Merger</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400 leading-relaxed">
                Combine up to 10 PDF documents. Review metadata details, and compress the merged result with a single click.
              </p>
            </CardContent>
          </Card>

          {/* PDF Reducer */}
          <Card className="glass-card hover-glow border border-slate-900 hover:border-slate-800 transition-all duration-300 group cursor-pointer" onClick={() => onSelectTab('reducer')}>
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-lg bg-amber-600/10 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Zap className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg font-bold text-white pt-2">PDF Reducer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400 leading-relaxed">
                Compress bulky files instantly. Enjoy automatic target-size downscaling and re-download options in memory.
              </p>
            </CardContent>
          </Card>

          {/* Image to PDF */}
          <Card className="glass-card hover-glow border border-slate-900 hover:border-slate-800 transition-all duration-300 group cursor-pointer" onClick={() => onSelectTab('image-to-pdf')}>
            <CardHeader className="pb-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-600/10 text-emerald-450 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ImageIcon className="w-5 h-5" />
              </div>
              <CardTitle className="text-lg font-bold text-white pt-2">Image to PDF</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-slate-400 leading-relaxed">
                Upload PNG/JPG images, drag to reorder pages, apply custom margins or landscape layouts, and compile.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Premium Trial Banner */}
      <section className="px-4 max-w-4xl mx-auto">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-violet-950/20 to-indigo-950/20 border border-violet-500/30 p-8 shadow-xl shadow-violet-950/10 text-center space-y-4">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-500 text-white shadow-md">
            <Sparkles className="w-3.5 h-3.5" />
            Promo Active: 100% Free
          </div>
          
          <h2 className="text-2xl sm:text-3xl font-black text-white">Unlock All Premium Features</h2>
          <p className="text-sm text-slate-300 max-w-2xl mx-auto leading-relaxed">
            We are celebrating our platform launch! For the next 2 months, every single user receives access to all <strong>Pro features</strong> (including premium styles, PDF operations, and image compilations) completely free of charge. No credit card or payments are required, and all documents are exported with zero advertisements or watermark tags.
          </p>
          
          <div className="pt-2">
            <Button 
              onClick={() => onSelectTab('builder')}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs h-11 px-8 rounded-xl shadow-lg shadow-violet-900/35 border-0"
            >
              Start Creating Now
            </Button>
          </div>
        </div>
      </section>

      {/* Recent Blog Posts Section */}
      <section className="space-y-6 px-4 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 border-b border-slate-900 pb-4">
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-violet-400" />
              Recent Updates & Guides
            </h2>
            <p className="text-sm text-slate-450">Read announcements and tutorials directly from our development logs.</p>
          </div>
          <Button
            onClick={() => onSelectTab('blog')}
            variant="outline"
            className="border-slate-800 hover:bg-slate-900 text-slate-300 hover:text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 h-9 shrink-0"
          >
            Visit Blog Hub
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        {loadingBlogs ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading articles...</div>
        ) : blogs.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-550 rounded-2xl border border-dashed border-slate-850 bg-slate-900/5">
            No updates posted yet. Check back soon!
          </div>
        ) : (
          <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
            {blogs.map((blog) => (
              <Card 
                key={blog.id} 
                className="glass-card hover:border-violet-500/40 border-slate-850 hover:bg-slate-900/20 transition-all duration-300 cursor-pointer group flex flex-col justify-between"
                onClick={() => setSelectedBlog(blog)}
              >
                {/* Cover thumbnail */}
                <div className="aspect-[16/10] w-full bg-slate-950 border-b border-slate-850 relative overflow-hidden rounded-t-2xl">
                  <img 
                    src={blog.imageUrl || 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&auto=format&fit=crop&q=60'} 
                    alt={blog.title}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&auto=format&fit=crop&q=60'; }}
                  />
                </div>

                <CardHeader className="space-y-2 pb-2 pt-4">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-555 font-semibold uppercase tracking-wider">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    {new Date(blog.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <CardTitle className="text-base font-bold text-white group-hover:text-violet-455 transition-colors line-clamp-2">
                    {blog.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-slate-450 leading-relaxed line-clamp-3">
                    {blog.body}
                  </p>
                  <div className="flex items-center gap-1 text-[10px] text-violet-450 font-bold uppercase tracking-wider">
                    Read Article
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Testimonials & Reviews */}
      <section className="max-w-4xl mx-auto space-y-8 px-4">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">What Creators Say</h2>
          <p className="text-sm text-slate-400">Real feedback from professionals using our document toolkit.</p>
        </div>

        {/* Review Grid */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
          {loadingReviews ? (
            <div className="col-span-full py-8 text-center text-xs text-slate-500">Loading reviews...</div>
          ) : reviews.length === 0 ? (
            <div className="col-span-full py-8 text-center text-xs text-slate-500">No reviews yet. Be the first to add one!</div>
          ) : (
            reviews.slice(0, 6).map((rev) => (
              <Card key={rev.id} className="glass-card border border-slate-900 p-4 space-y-2.5 flex flex-col justify-between">
                <p className="text-xs text-slate-300 leading-relaxed italic">
                  "{rev.comment}"
                </p>
                <div className="flex items-center justify-between border-t border-slate-900/60 pt-2.5">
                  <div className="flex items-center gap-2">
                    <img 
                      src={rev.userPhoto} 
                      alt={rev.userName} 
                      className="w-7 h-7 rounded-full border border-slate-800"
                      onError={(e) => { e.target.src = 'https://avatar.iran.liara.run/public/30'; }}
                    />
                    <div className="text-[10px] font-bold text-white truncate max-w-[100px]">{rev.userName}</div>
                  </div>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        className={`w-3 h-3 ${i < rev.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-700'}`} 
                      />
                    ))}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Add Review Box */}
        <Card className="glass-panel border border-slate-900 max-w-xl mx-auto p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-violet-600/5 rounded-full blur-2xl pointer-events-none" />
          
          <CardHeader className="p-0 pb-3 flex flex-row items-center gap-3">
            <MessageSquareQuote className="w-5 h-5 text-violet-400" />
            <div>
              <CardTitle className="text-base font-bold text-white">Leave Your Review</CardTitle>
              <CardDescription className="text-[11px] text-slate-505">Share your platform experience with other users</CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-0 pt-1">
            {currentUser ? (
              <form onSubmit={handleAddReview} className="space-y-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400">Rating:</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setRating(num)}
                        className="p-0.5 rounded focus:outline-none hover:scale-110 transition-transform"
                      >
                        <Star 
                          className={`w-5 h-5 ${
                            num <= rating 
                              ? 'text-amber-400 fill-amber-400' 
                              : 'text-slate-700 hover:text-amber-300'
                          }`} 
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <textarea
                    rows={3}
                    placeholder="Describe what you built or converted using BillStacker..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    maxLength={200}
                    className="w-full text-xs p-2.5 rounded-lg bg-slate-950/60 border border-slate-850 text-slate-200 placeholder:text-slate-650 focus:border-violet-500/50 outline-none resize-none"
                    required
                  />
                  <div className="text-right text-[9px] text-slate-500">Max 200 characters</div>
                </div>

                <Button
                  type="submit"
                  disabled={submittingReview}
                  className="w-full h-9 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-lg border-0 shadow-md shadow-violet-900/30"
                >
                  {submittingReview ? (
                    'Submitting...'
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1.5" /> Submit Testimonial
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <div className="text-center py-4 bg-slate-950/30 border border-dashed border-slate-850 rounded-xl space-y-3">
                <p className="text-xs text-slate-450">You must be logged in to share a review.</p>
                <Button 
                  onClick={onOpenAuth}
                  size="sm"
                  className="h-8.5 bg-violet-600 hover:bg-violet-550 text-white font-bold text-xs px-4"
                >
                  Sign In to Write Review
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Adsterra Banners Removed */}

      {/* Blog Reader Modal Dialog */}
      {selectedBlog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 font-sans">
          <div className="relative w-full max-w-2xl max-h-[85vh] bg-slate-900 border border-slate-850 rounded-3xl overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-855 flex justify-between items-start gap-4">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-black tracking-wider">
                  {new Date(selectedBlog.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white mt-1 leading-tight">{selectedBlog.title}</h2>
              </div>
              <button 
                onClick={() => setSelectedBlog(null)}
                className="p-1.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white transition-all shrink-0"
              >
                <span className="text-xs font-bold px-1">✕</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-4">
              {/* Cover image banner */}
              <div className="w-full aspect-[21/9] rounded-xl overflow-hidden border border-slate-800 relative shrink-0">
                <img 
                  src={selectedBlog.imageUrl || 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&auto=format&fit=crop&q=60'} 
                  alt={selectedBlog.title} 
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&auto=format&fit=crop&q=60'; }}
                />
              </div>
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{selectedBlog.body}</p>
            </div>
            <div className="p-4 bg-slate-950/40 border-t border-slate-855 flex justify-end">
              <Button 
                onClick={() => setSelectedBlog(null)}
                className="bg-slate-900 border border-slate-800 hover:bg-slate-855 text-slate-350 text-xs font-semibold px-5 rounded-xl"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
