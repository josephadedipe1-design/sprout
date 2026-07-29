'use client';

import Link from 'next/link';
import { Leaf, MailCheck, ArrowLeft } from 'lucide-react';

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md text-center">
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand)' }}>
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold" style={{ color: 'var(--brand)' }}>Sprout</span>
        </Link>

        <div className="card-sprout p-8">
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-5" style={{ background: 'var(--brand-light)' }}>
            <MailCheck className="w-8 h-8" style={{ color: 'var(--brand)' }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#2a1f18' }}>Verify your email</h2>
          <p className="text-sm leading-relaxed mb-5" style={{ color: '#7a6055' }}>
            We&apos;ve sent a confirmation link to your email. Click the link to activate your account, then log in to join the Sprout community.
          </p>
          <p className="text-xs mb-6" style={{ color: '#b8a090' }}>
            Didn&apos;t get the email? Check your spam folder, or try signing up again.
          </p>
          <Link href="/" className="btn-brand w-full inline-flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
