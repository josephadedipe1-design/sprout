'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Leaf, MapPin, Users, MessageCircle, ShoppingBag, CalendarDays,
  Mail, Loader2, CheckCircle2, Heart, ArrowRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { sendNotificationEmail } from '@/lib/notifications';

const FEATURES = [
  {
    Icon: Users,
    title: 'Connect with local parents',
    desc: 'Meet families within 2 miles of you — at exactly the same stage.',
  },
  {
    Icon: MessageCircle,
    title: 'Community feed',
    desc: 'Ask questions, share tips, and get honest advice from parents nearby.',
  },
  {
    Icon: ShoppingBag,
    title: 'Marketplace',
    desc: 'Buy, sell, and give away baby and child items locally — no postage, no fuss.',
  },
  {
    Icon: CalendarDays,
    title: 'Meetups',
    desc: 'Discover and join parent meetups happening in your neighbourhood.',
  },
];

const SESSION_KEY = 'sprout_coming_soon_submitted';

export default function ComingSoonPage() {
  const [email, setEmail] = useState('');
  const [postcode, setPostcode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitted || submitting) return;

    const cleanEmail = email.trim().toLowerCase();
    const cleanPostcode = postcode.trim().toUpperCase();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!cleanPostcode || !/^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/.test(cleanPostcode)) {
      setError('Please enter a full postcode — e.g. ME1 1AA.');
      return;
    }

    setSubmitting(true);
    setError('');

    const outcode = cleanPostcode.split(/\s/)[0].toUpperCase();

    try {
      const { error: insertError } = await supabase.from('waitlist').insert({
        email: cleanEmail,
        postcode: cleanPostcode,
        postcode_prefix: outcode,
      });

      if (insertError) {
        // Unique constraint or similar — treat as already on the list
        if (insertError.code === '23505') {
          setSubmitted(true);
          try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
        } else {
          throw insertError;
        }
      } else {
        setSubmitted(true);
        try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
        sendNotificationEmail({ type: 'waitlist', emailData: { email: cleanEmail, postcode: cleanPostcode } });
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Hero */}
      <header
        className="px-6 pt-12 pb-10 text-center"
        style={{ background: 'linear-gradient(180deg, #FFF5EF 0%, #f4f3f0 100%)' }}
      >
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--brand)' }}>
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-bold" style={{ color: 'var(--brand)' }}>Sprout</span>
        </div>

        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-sm font-semibold"
          style={{ background: 'white', border: '1px solid #e8c9b4', color: 'var(--brand)' }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--brand)' }} />
          Launching 1 September
        </div>

        <h1
          className="text-3xl sm:text-4xl font-extrabold leading-tight mb-4 max-w-xl mx-auto"
          style={{ color: '#1a1208' }}
        >
          Your local parenting village is coming to Medway
        </h1>

        <p className="text-base leading-relaxed max-w-md mx-auto" style={{ color: '#7a6055' }}>
          Connect with parents nearby, find meetups, share advice, and buy and sell locally — all in one place, built just for families.
        </p>
      </header>

      {/* Email capture */}
      <section className="px-6 -mt-6 pb-12">
        <div className="max-w-md mx-auto">
          {submitted ? (
            <div className="card-sprout p-8 text-center">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4" style={{ background: '#d6ede3' }}>
                <CheckCircle2 className="w-8 h-8" style={{ color: '#2d7a52' }} />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: '#2a1f18' }}>You&apos;re on the list!</h2>
              <p className="text-sm leading-relaxed" style={{ color: '#7a6055' }}>
                We&apos;ll email you at <strong style={{ color: '#2a1f18' }}>{email}</strong> as soon as Sprout launches in Medway on 1 September.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="card-sprout p-6 sm:p-8">
              <h2 className="text-xl font-bold mb-1.5" style={{ color: '#2a1f18' }}>Join the waitlist</h2>
              <p className="text-sm mb-5" style={{ color: '#9a8070' }}>
                Be first to know when we go live. No spam — just your launch invite.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#4a3328' }}>Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#b8a090' }} />
                    <input
                      type="email"
                      className="input-sprout"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError(''); }}
                      autoComplete="email"
                      style={{ paddingLeft: '2.5rem' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#4a3328' }}>Your postcode</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#b8a090' }} />
                    <input
                      type="text"
                      className="input-sprout uppercase"
                      placeholder="e.g. ME1 1AA"
                      value={postcode}
                      onChange={e => { setPostcode(e.target.value.toUpperCase()); setError(''); }}
                      autoComplete="postal-code"
                      style={{ paddingLeft: '2.5rem' }}
                    />
                  </div>
                </div>
              </div>

              {error && (
                <p className="text-xs font-medium mt-3" style={{ color: '#b45309' }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn-brand w-full mt-5 py-3.5 text-base"
                style={{ opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</>
                ) : (
                  <>Join the waitlist <ArrowRight className="w-4 h-4" /></>
                )}
              </button>

              <p className="text-xs text-center mt-4" style={{ color: '#b8a090' }}>
                By joining you agree to our{' '}
                <Link href="/terms" className="underline" style={{ color: '#9a8070' }}>Terms</Link>{' '}
                and{' '}
                <Link href="/privacy" className="underline" style={{ color: '#9a8070' }}>Privacy Policy</Link>.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* What is Sprout */}
      <section className="px-6 py-12" style={{ background: 'white' }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2" style={{ color: '#2a1f18' }}>What is Sprout?</h2>
          <p className="text-sm text-center mb-8 max-w-md mx-auto" style={{ color: '#9a8070' }}>
            Everything parents need, all in one hyper-local app.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map(({ Icon, title, desc }) => (
              <div
                key={title}
                className="flex items-start gap-3 p-4 rounded-2xl"
                style={{ background: '#faf8f6', border: '1px solid var(--border-color)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand-light)' }}>
                  <Icon className="w-5 h-5" style={{ color: 'var(--brand)' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#2a1f18' }}>{title}</p>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#9a8070' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Founder note */}
      <section className="px-6 py-12" style={{ background: 'var(--brand-light)' }}>
        <div className="max-w-md mx-auto text-center">
          <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-4" style={{ background: 'white' }}>
            <Heart className="w-6 h-6" style={{ color: 'var(--brand)' }} fill="var(--brand)" />
          </div>
          <p className="text-lg font-semibold mb-3" style={{ color: '#2a1f18' }}>
            Built by a Medway parent, for Medway parents
          </p>
          <p className="text-sm leading-relaxed" style={{ color: '#7a6055' }}>
            I started Sprout because parenting can feel isolating — especially when you&apos;re new to an area. I wanted a simple way to find other families nearby, ask honest questions, and build a real village. That&apos;s what Sprout is: your neighbourhood, for parents.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 mt-auto" style={{ background: 'white', borderTop: '1px solid var(--border-color)' }}>
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand)' }}>
              <Leaf className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm" style={{ color: 'var(--brand)' }}>Sprout</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            <Link href="/terms" className="transition-colors hover:opacity-70" style={{ color: '#7a6055' }}>Terms</Link>
            <Link href="/privacy" className="transition-colors hover:opacity-70" style={{ color: '#7a6055' }}>Privacy</Link>
            <Link href="/safety" className="transition-colors hover:opacity-70" style={{ color: '#7a6055' }}>Safety</Link>
            <a
              href="https://instagram.com/sprout.medway"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 transition-colors hover:opacity-70"
              style={{ color: '#7a6055' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
              Instagram
            </a>
          </div>

          <p className="text-xs text-center mt-6" style={{ color: '#b8a090' }}>
            &copy; 2026 Sprout. Made with care in Medway.
          </p>
        </div>
      </footer>
    </div>
  );
}
