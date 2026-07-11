import React, { useState, useEffect } from 'react';
import { BookOpen, Calendar, ArrowRight, X, Clock, ArrowLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import AdBanner from './AdBanner';
import NativeAdBanner from './NativeAdBanner';
import { dbGetBlogPosts } from '../firebase';

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&auto=format&fit=crop&q=60';

export default function Blog({ currentUser }) {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBlog, setSelectedBlog] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchPublicBlogs() {
      try {
        setLoading(true);
        setError(null);
        const data = await dbGetBlogPosts(false) || []; // false = published only
        setBlogs(data);
      } catch (err) {
        console.error('Failed to load public blog posts:', err);
        setError(err.message || err.toString());
      } finally {
        setLoading(false);
      }
    }
    fetchPublicBlogs();
  }, []);

  // SEO Update Handler
  useEffect(() => {
    if (selectedBlog) {
      document.title = `${selectedBlog.title} | BillStacker Blog`;
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        document.head.appendChild(metaDesc);
      }
      metaDesc.content = selectedBlog.body.substring(0, 155).replace(/\r?\n|\r/g, " ") + '...';
      
      // Push human-readable URL slug to the browser address bar for SEO
      window.history.pushState({ blogId: selectedBlog.id }, '', `/blog/${selectedBlog.slug}`);
    } else {
      document.title = 'BillStacker Blog - Platform Updates & Guides';
      let metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.content = 'Read the latest guides, releases, and articles from the BillStacker development team.';
      }
      
      // Restore URL back to main blog category root
      window.history.pushState({}, '', '/blog');
    }
  }, [selectedBlog]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const getReadingTime = (text) => {
    if (!text) return '1 min read';
    const wordsPerMinute = 200;
    const noOfWords = text.split(/\s+/).length;
    const minutes = Math.ceil(noOfWords / wordsPerMinute);
    return `${minutes} min read`;
  };

  // 1. Article Details Page View
  if (selectedBlog) {
    const recommendedPosts = blogs.filter(b => b.id !== selectedBlog.id).slice(0, 3);
    
    return (
      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 animate-in fade-in duration-300 font-sans">
        {/* Back navigation bar */}
        <div className="pb-6">
          <button
            onClick={() => setSelectedBlog(null)}
            className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog Hub
          </button>
        </div>

        {/* Content columns */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Article column */}
          <article className="lg:col-span-8 space-y-6 bg-slate-900/40 p-5 sm:p-8 rounded-3xl border border-slate-850 shadow-xl">
            {/* Header info */}
            <header className="space-y-4">
              <div className="flex items-center gap-4 text-[10px] sm:text-xs text-violet-400 font-black uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  {formatDate(selectedBlog.createdAt)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  {getReadingTime(selectedBlog.body)}
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight tracking-tight">
                {selectedBlog.title}
              </h1>
            </header>

            {/* Cover image banner */}
            <div className="aspect-[21/9] w-full rounded-2xl overflow-hidden border border-slate-850 relative">
              <img 
                src={selectedBlog.imageUrl || DEFAULT_COVER} 
                alt={selectedBlog.title} 
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => { e.target.src = DEFAULT_COVER; }}
              />
            </div>

            {/* Content text */}
            <div className="text-slate-300 text-sm sm:text-base leading-relaxed whitespace-pre-wrap pt-2">
              {selectedBlog.body}
            </div>
            
            {/* Contextual Native Ad Banner */}
            <div className="mt-8 pt-6 border-t border-slate-850/60">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Recommended Articles & Sponsor Updates</div>
              <NativeAdBanner isPremium={currentUser?.isPremium} />
            </div>
          </article>

          {/* Sidebar Navigation for other articles */}
          <aside className="lg:col-span-4 space-y-5">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-slate-850 pb-3">
              <BookOpen className="w-4 h-4 text-violet-400" />
              More Updates
            </h3>
            
            {recommendedPosts.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No other articles available.</p>
            ) : (
              <div className="space-y-4">
                {recommendedPosts.map((post) => (
                  <Card 
                    key={post.id}
                    onClick={() => setSelectedBlog(post)}
                    className="glass-card hover:border-violet-500/30 border-slate-850 hover:bg-slate-900/30 cursor-pointer p-4 transition-all duration-200 group"
                  >
                    <div className="space-y-2">
                      <div className="text-[9px] text-slate-555 font-bold uppercase flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-655" />
                        {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <h4 className="text-xs font-bold text-white group-hover:text-violet-405 transition-colors line-clamp-2">
                        {post.title}
                      </h4>
                      <div className="text-[10px] text-violet-450 font-semibold uppercase tracking-wider pt-1 flex items-center gap-0.5">
                        Read
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* Adsterra Sidebar Rectangle Banner (300x250) */}
            <AdBanner 
              adKey="8537b1d72065bea231c5c45ad26ab48b" 
              format="iframe" 
              width={300} 
              height={250} 
              className="mt-6 border border-slate-850/80 bg-slate-950/20" 
              isPremium={currentUser?.isPremium}
            />
          </aside>
        </div>
      </div>
    );
  }

  // 2. Hub Main Grid List View
  return (
    <div className="space-y-8 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 animate-in fade-in duration-300 font-sans">
      
      {/* Blog Hub Hero */}
      <div className="relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-850 p-8 sm:p-12 text-center space-y-4 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl" />
        
        <div className="inline-flex p-3 bg-violet-600/10 text-violet-400 rounded-2xl border border-violet-500/20 shadow-lg">
          <BookOpen className="w-6 h-6" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Platform News & Updates</h1>
        <p className="text-slate-450 max-w-md mx-auto text-sm leading-relaxed">
          Stay up to date with the latest features, releases, and guides for secure invoice management on BillStacker.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-950/20 border border-rose-900/40 text-rose-350 rounded-2xl text-xs space-y-1">
          <div className="font-extrabold uppercase tracking-wider text-rose-455">Database Connection Warning</div>
          <p>Failed to load published posts: <strong>{error}</strong></p>
          <p className="text-[10px] text-slate-550 leading-relaxed pt-1">
            This is caused by your Firestore security settings. Ensure that the 'blogs' collection has read permissions enabled for all users.
          </p>
        </div>
      )}

      {/* Grid List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-t-2 border-r-2 border-violet-500 rounded-full animate-spin" />
        </div>
      ) : blogs.length === 0 ? (
        <div className="p-16 text-center text-slate-500 rounded-2xl border border-dashed border-slate-850 bg-slate-900/10">
          <BookOpen className="w-10 h-10 mx-auto text-slate-700 mb-3" />
          <h3 className="text-lg font-bold text-white">No articles published yet</h3>
          <p className="text-xs text-slate-500 mt-1">Check back later for platform announcements and tutorials.</p>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {blogs.map((blog) => (
            <Card 
              key={blog.id} 
              className="glass-card hover:border-violet-500/40 border-slate-850 hover:bg-slate-900/30 transition-all duration-350 cursor-pointer group flex flex-col justify-between"
              onClick={() => setSelectedBlog(blog)}
            >
              {/* Cover thumbnail if available */}
              <div className="aspect-[16/10] w-full bg-slate-950 border-b border-slate-850 relative overflow-hidden rounded-t-2xl">
                <img 
                  src={blog.imageUrl || DEFAULT_COVER} 
                  alt={blog.title}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => { e.target.src = DEFAULT_COVER; }}
                />
              </div>

              <CardHeader className="space-y-2 pb-2 pt-4">
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-600" />
                    {formatDate(blog.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-600" />
                    {getReadingTime(blog.body)}
                  </span>
                </div>
                <CardTitle className="text-base font-bold text-white group-hover:text-violet-400 transition-colors leading-snug line-clamp-2">
                  {blog.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-1 flex-1 flex flex-col justify-between">
                <p className="text-xs text-slate-450 leading-relaxed line-clamp-3">
                  {blog.body}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-violet-455 font-bold uppercase tracking-wider pt-2 group-hover:translate-x-0.5 transition-transform">
                  Read Article
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Blog Hub Footer Ads */}
      <div className="pt-6 border-t border-slate-850/60 mt-12">
        {/* Large screen: 728x90 Leaderboard banner */}
        <AdBanner 
          adKey="fc0ded85e24429b5a4db05e69a625aee" 
          format="iframe" 
          width={728} 
          height={90} 
          className="hidden md:flex mx-auto" 
          isPremium={currentUser?.isPremium}
        />
        {/* Small screen: 320x50 Mobile banner */}
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
