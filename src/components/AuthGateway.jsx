import React, { useState } from 'react';
import { signUpWithEmail, signInWithEmail, signInWithGoogle } from '../firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label, Input } from './ui/input';
import { Button } from './ui/button';
import { useToast } from './ui/toast';
import { LogIn, UserPlus, Phone, Mail, Lock, User, Info, Chrome, Eye, EyeOff } from 'lucide-react';

export default function AuthGateway({ onAuthSuccess }) {
  const [mode, setMode] = useState('signin'); // 'signin' or 'signup'
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('male'); // 'male' or 'female'
  const [showPassword, setShowPassword] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
      toast({
        title: 'Welcome Back!',
        description: 'Successfully authenticated with Google.',
        variant: 'success'
      });
      if (onAuthSuccess) onAuthSuccess();
    } catch (err) {
      toast({
        title: 'Authentication Failed',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields.',
        variant: 'destructive'
      });
      return;
    }

    if (mode === 'signup' && !name) {
      toast({
        title: 'Error',
        description: 'Name is required for registration.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);
      if (mode === 'signin') {
        await signInWithEmail(email, password);
        toast({
          title: 'Welcome Back!',
          description: 'Logged in successfully.',
          variant: 'success'
        });
      } else {
        await signUpWithEmail(email, password, name, phone, gender);
        toast({
          title: 'Account Created!',
          description: `Welcome to BillStacker, ${name}!`,
          variant: 'success'
        });
      }
      if (onAuthSuccess) onAuthSuccess();
    } catch (err) {
      toast({
        title: 'Authentication Failed',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.1),transparent_40%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.05),transparent_40%)] pointer-events-none" />

      <Card className="w-full max-w-md glass-panel relative overflow-hidden border border-slate-800/80 shadow-2xl">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-violet-500 to-transparent" />
        
        <CardHeader className="text-center pb-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-violet-500/20">
            <span className="text-white font-extrabold text-xl font-mono">B</span>
          </div>
          <CardTitle className="text-2xl font-extrabold text-white">
            {mode === 'signin' ? 'Sign In to BillStacker' : 'Create an Account'}
          </CardTitle>
          <CardDescription className="text-slate-400 text-sm">
            {mode === 'signin' 
              ? 'Access your cloud invoices and premium PDF tools' 
              : 'Sign up to sync configurations and customize billing templates'
            }
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'signup' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-slate-355 text-xs font-semibold">Full Name *</Label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="e.g. Dhruvin Viradiya"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 h-10.5 bg-slate-950/60 border-slate-800 text-slate-100 placeholder:text-slate-650 focus:border-violet-500/50"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-slate-355 text-xs font-semibold">Phone Number (Optional)</Label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="e.g. +91 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-10 h-10.5 bg-slate-950/60 border-slate-800 text-slate-100 placeholder:text-slate-655 focus:border-violet-500/50"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-355 text-xs font-semibold">Gender *</Label>
                  <div className="grid grid-cols-2 gap-3.5">
                    <button
                      type="button"
                      onClick={() => setGender('male')}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                        gender === 'male'
                          ? 'bg-violet-600/10 border-violet-500 text-violet-400 shadow-md shadow-violet-500/5'
                          : 'bg-slate-950/30 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${gender === 'male' ? 'bg-violet-400' : 'bg-slate-600'}`} />
                      Male
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('female')}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                        gender === 'female'
                          ? 'bg-violet-600/10 border-violet-500 text-violet-400 shadow-md shadow-violet-500/5'
                          : 'bg-slate-950/30 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${gender === 'female' ? 'bg-violet-400' : 'bg-slate-600'}`} />
                      Female
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-355 text-xs font-semibold">Email Address *</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-10.5 bg-slate-950/60 border-slate-800 text-slate-100 placeholder:text-slate-655 focus:border-violet-500/50"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-slate-355 text-xs font-semibold">Password *</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-10.5 bg-slate-950/60 border-slate-800 text-slate-100 placeholder:text-slate-655 focus:border-violet-500/50"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-violet-900/35 border-0"
            >
              {loading ? (
                'Processing...'
              ) : mode === 'signin' ? (
                <>
                  <LogIn className="w-4 h-4 mr-2" /> Sign In
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" /> Create Account
                </>
              )}
            </Button>
          </form>

          <div className="relative my-5 flex items-center justify-center">
            <div className="absolute inset-x-0 h-[1px] bg-slate-800" />
            <span className="relative px-3.5 bg-slate-950 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
              Or continue with
            </span>
          </div>

          <Button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            variant="outline"
            className="w-full h-10.5 border-slate-850 hover:bg-slate-900 text-slate-300 font-semibold text-xs transition-colors shrink-0"
          >
            <Chrome className="w-4 h-4 mr-2 text-violet-400" />
            Sign in with Google
          </Button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className="text-xs text-violet-400 hover:text-violet-300 font-medium underline underline-offset-4"
            >
              {mode === 'signin' 
                ? "Don't have an account? Create one" 
                : 'Already have an account? Sign in'
              }
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
