import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Button } from './ui/button';
import { useToast } from './ui/toast';
import { MessageSquare, Send, CheckCircle, Clock, Info, ShieldQuestion } from 'lucide-react';
import { dbSubmitFeedback, dbGetAllFeedbacks } from '../firebase';

export default function SupportFeedback({ currentUser }) {
  const { toast } = useToast();
  const [feedbackType, setFeedbackType] = useState('Bug Report');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [submitting, setSubmitting] = useState(false);
  const [myTickets, setMyTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setEmail(currentUser.email || '');
      loadMyTickets();
    }
  }, [currentUser]);

  const loadMyTickets = async () => {
    if (!currentUser) return;
    try {
      setLoadingTickets(true);
      const all = await dbGetAllFeedbacks() || [];
      const mine = all.filter(f => f.userId === currentUser.uid);
      setMyTickets(mine);
    } catch (err) {
      console.error('Failed to load feedback tickets:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      toast({
        title: 'Error',
        description: 'Please write a message before submitting.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setSubmitting(true);
      const data = {
        userId: currentUser?.uid || 'guest_user',
        userName: currentUser?.displayName || 'Anonymous Guest',
        userEmail: email || 'N/A',
        type: feedbackType,
        message: message.trim()
      };

      await dbSubmitFeedback(data);
      toast({
        title: 'Ticket Submitted',
        description: 'Our development team has received your inquiry.',
        variant: 'success'
      });
      setMessage('');
      loadMyTickets();
    } catch (err) {
      toast({
        title: 'Submission Failed',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 animate-in fade-in duration-300 font-sans">
      {/* Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-850 p-8 sm:p-10 text-center space-y-3 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="inline-flex p-3 bg-violet-650/15 text-violet-400 rounded-2xl border border-violet-500/20 shadow-lg">
          <MessageSquare className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Support & User Feedback</h1>
        <p className="text-slate-400 max-w-md mx-auto text-xs leading-relaxed">
          Report bugs, suggest layout templates, or ask billing questions. Our engineering team reviews submissions daily.
        </p>
      </div>

      <div className="grid gap-8 grid-cols-1 lg:grid-cols-5">
        {/* Submission Form */}
        <Card className="glass-card border-slate-850 p-5 sm:p-6 lg:col-span-3 h-fit relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-600/5 rounded-full blur-2xl pointer-events-none" />
          
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-lg font-bold text-white">Create New Inquiry</CardTitle>
            <CardDescription className="text-xs text-slate-500">Please provide detailed details about your inquiry.</CardDescription>
          </CardHeader>

          <CardContent className="p-0 pt-2">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Inquiry Type</label>
                  <select
                    value={feedbackType}
                    onChange={(e) => setFeedbackType(e.target.value)}
                    className="w-full h-11 px-3 bg-slate-950/60 border border-slate-850 rounded-xl text-slate-100 focus:border-violet-500/50 outline-none text-xs"
                  >
                    <option value="Bug Report">Bug Report</option>
                    <option value="Feature Request">Feature Request</option>
                    <option value="Payment Issue">Payment Issue</option>
                    <option value="Inquiry">General Inquiry</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Contact Email</label>
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-11 px-4 bg-slate-950/60 border border-slate-850 rounded-xl text-slate-100 placeholder:text-slate-700 focus:border-violet-500/50 outline-none text-xs"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase">Describe Your Inquiry</label>
                <textarea
                  rows={6}
                  placeholder="Describe your issue or layout request. Be as specific as possible (e.g. browser versions, document size)..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={1000}
                  className="w-full text-xs p-3.5 rounded-xl bg-slate-950/60 border border-slate-855 text-slate-200 placeholder:text-slate-700 focus:border-violet-500/50 outline-none resize-none"
                  required
                />
                <div className="text-right text-[10px] text-slate-500">Max 1000 characters</div>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-11 bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs rounded-xl border-0 shadow-lg shadow-violet-900/30 flex items-center justify-center gap-1.5"
              >
                {submitting ? (
                  'Submitting Ticket...'
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Submit Support Ticket
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Previous Tickets sidebar list */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldQuestion className="w-4 h-4 text-violet-400" />
            Your Support Tickets
          </h3>
          
          {loadingTickets ? (
            <div className="py-8 text-center text-xs text-slate-500">Loading tickets...</div>
          ) : !currentUser ? (
            <div className="p-5 text-center text-xs text-slate-550 rounded-2xl border border-dashed border-slate-850 bg-slate-900/5">
              Sign in to view and track your submitted tickets.
            </div>
          ) : myTickets.length === 0 ? (
            <div className="p-5 text-center text-xs text-slate-550 rounded-2xl border border-dashed border-slate-850 bg-slate-900/5">
              You haven't submitted any tickets yet.
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[480px] overflow-y-auto pr-1">
              {myTickets.map((ticket) => (
                <Card key={ticket.id} className="glass-card border-slate-850 p-4 space-y-3 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-violet-600/10 text-violet-400 border border-violet-500/20">
                        {ticket.type}
                      </span>
                      {ticket.status === 'Solved' ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-450 uppercase bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-900/30">
                          <CheckCircle className="w-2.5 h-2.5" /> Solved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-450 uppercase bg-amber-950/20 px-2 py-0.5 rounded border border-amber-900/30">
                          <Clock className="w-2.5 h-2.5" /> Pending
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed break-words line-clamp-3">
                      "{ticket.message}"
                    </p>
                  </div>

                  <div className="flex items-center gap-1 text-[9px] text-slate-500 border-t border-slate-850/60 pt-2">
                    <Info className="w-3 h-3 text-slate-550 shrink-0" />
                    <span>Submitted {new Date(ticket.createdAt).toLocaleDateString()}</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
