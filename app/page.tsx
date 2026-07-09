'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Leaf, MapPin, Users, ShieldCheck, X, CheckCircle, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'signup' | 'login'>('signup');

  // ── Login state ───────────────────────────────────────────────────────────
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message === 'Invalid login credentials'
        ? 'Incorrect email or password. Please try again.'
        : authError.message);
      setLoading(false);
    } else {
      router.push('/app');
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotLoading(false);
    if (resetError) { setForgotError(resetError.message); return; }
    setForgotSent(true);
  }

  function openForgot() {
    setForgotEmail(email);
    setForgotSent(false);
    setForgotError('');
    setShowForgot(true);
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* Left panel — desktop only */}
      <div
        className="hidden lg:flex flex-col justify-between w-[60%] flex-shrink-0 p-16 text-white"
        style={{ background: 'linear-gradient(145deg, #7D3C1A 0%, #4A1E0A 100%)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight">Sprout</span>
        </div>

        <div>
          <h1 className="text-4xl font-extrabold leading-tight mb-5">
            Your local parenting village is waiting.
          </h1>
          <p className="text-white/70 text-lg leading-relaxed mb-10">
            Connect with parents nearby, find meetups, get honest advice — and know you&apos;re never doing this alone.
          </p>

          <div className="space-y-5">
            {[
              { icon: MapPin, title: 'Hyper-local.', desc: 'Everything within 2 miles of you — posts, meetups, listings and parents.' },
              { icon: Users, title: 'Real connections.', desc: 'Match with parents at exactly the same stage as you.' },
              { icon: ShieldCheck, title: 'Safe and private.', desc: 'Only your area is ever shown — never your full address.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)' }}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-white/85 text-base leading-relaxed pt-2.5">
                  <span className="font-bold text-white">{title}</span> {desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/40 text-sm">© 2026 Sprout. All rights reserved.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="lg:hidden flex items-center gap-2 mb-10">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--brand)' }}>
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold" style={{ color: 'var(--brand)' }}>Sprout</span>
        </div>

        <div className="w-full max-w-[400px]">
          {/* Tab switcher */}
          <div className="flex rounded-2xl p-1 mb-8" style={{ background: '#f0ece8' }}>
            <button
              onClick={() => setActiveTab('signup')}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all"
              style={{
                background: activeTab === 'signup' ? 'white' : 'transparent',
                color: activeTab === 'signup' ? '#2a1f18' : '#9a8070',
                boxShadow: activeTab === 'signup' ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
              }}
            >
              Join free
            </button>
            <button
              onClick={() => { setActiveTab('login'); setError(''); }}
              className="flex-1 py-2.5 text-sm font-semibold rounded-xl transition-all"
              style={{
                background: activeTab === 'login' ? 'white' : 'transparent',
                color: activeTab === 'login' ? '#2a1f18' : '#9a8070',
                boxShadow: activeTab === 'login' ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
              }}
            >
              Log in
            </button>
          </div>

          {/* ── Join free tab ── */}
          {activeTab === 'signup' && (
            <>
              <h2 className="text-3xl font-extrabold mb-1.5" style={{ color: '#1a1208' }}>Create your account</h2>
              <p className="mb-8 text-base" style={{ color: '#8a7a6a' }}>Join parents near you — it&apos;s completely free.</p>

              <div className="space-y-4">
                {[
                  { icon: MapPin, title: 'Hyper-local community', desc: 'Posts, meetups and parents within 2 miles of you.' },
                  { icon: Users, title: 'Real connections', desc: 'Match with parents at exactly the same stage.' },
                  { icon: ShieldCheck, title: 'Safe and private', desc: 'Only your area is ever shown — never your address.' },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex items-start gap-3 p-3.5 rounded-xl" style={{ background: '#faf8f6', border: '1px solid var(--border-color)' }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand-light)' }}>
                      <Icon className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#2a1f18' }}>{title}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#9a8070' }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                href="/signup"
                className="btn-brand w-full text-base py-3.5 mt-8 flex items-center justify-center gap-2"
              >
                Get started <ArrowRight className="w-4 h-4" />
              </Link>

              <p className="mt-5 text-center text-xs" style={{ color: '#b8a090' }}>
                By joining you agree to our{' '}
                <a href="/terms" target="_blank" className="underline" style={{ color: '#9a8070' }}>Terms</a>{' '}
                and{' '}
                <a href="/privacy" target="_blank" className="underline" style={{ color: '#9a8070' }}>Privacy Policy</a>.
              </p>
            </>
          )}

          {/* ── Log in tab ── */}
          {activeTab === 'login' && (
            <>
              <h2 className="text-3xl font-extrabold mb-1.5" style={{ color: '#1a1208' }}>Good to have you back</h2>
              <p className="mb-8 text-base" style={{ color: '#8a7a6a' }}>Log in to see what&apos;s happening in your village today.</p>

              <form onSubmit={handleLogin} className="space-y-5">
                {error && (
                  <div className="p-3 rounded-xl text-sm font-medium" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#3a2820' }}>Email Address</label>
                  <div className="relative">
                    <input
                      className="input-sprout pr-11"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#c4a090' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/></svg>
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#3a2820' }}>Password</label>
                  <div className="relative">
                    <input
                      className="input-sprout pr-11"
                      type={showPw ? 'text' : 'password'}
                      placeholder="Your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: '#9a7060' }}
                      onClick={() => setShowPw(!showPw)}
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex justify-end mt-2">
                    <button type="button" onClick={openForgot} className="text-sm font-semibold" style={{ color: 'var(--brand)' }}>
                      Forgot your password?
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-brand w-full text-base py-3.5 mt-1"
                  disabled={loading}
                  style={{ opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? 'Logging in…' : 'Log in'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Forgot password modal */}
      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: 'white' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <h2 className="text-base font-bold" style={{ color: '#2a1f18' }}>Reset your password</h2>
              <button onClick={() => setShowForgot(false)} style={{ color: '#9a8070' }}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5">
              {forgotSent ? (
                <div className="text-center py-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#ECFDF5' }}>
                    <CheckCircle className="w-6 h-6" style={{ color: '#059669' }} />
                  </div>
                  <p className="text-sm font-semibold mb-1" style={{ color: '#2a1f18' }}>Check your email</p>
                  <p className="text-sm" style={{ color: '#9a8070' }}>
                    We&apos;ve sent a reset link to <strong>{forgotEmail}</strong>. Click the link to set a new password.
                  </p>
                  <button onClick={() => setShowForgot(false)} className="btn-brand w-full mt-5 text-sm py-3">Done</button>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4">
                  <p className="text-sm" style={{ color: '#9a8070' }}>Enter your email address and we&apos;ll send you a link to reset your password.</p>
                  {forgotError && (
                    <div className="p-3 rounded-xl text-sm" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
                      {forgotError}
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#3a2820' }}>Email Address</label>
                    <input
                      className="input-sprout"
                      type="email"
                      placeholder="you@example.com"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn-brand w-full text-sm py-3" disabled={forgotLoading}>
                    {forgotLoading ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
