import Link from 'next/link';
import { Leaf, ArrowLeft, MessageCircle, Mail, BookOpen, Flag } from 'lucide-react';

const FAQS = [
  {
    q: 'How do I change my neighborhood or postcode?',
    a: 'Go to your Profile (bottom nav), tap "Edit profile", and update your postcode or neighborhood. Your feed and matching will update immediately.',
  },
  {
    q: 'Why can\'t I see my feed posts?',
    a: 'Make sure you\'ve completed your profile setup — specifically your postcode. Posts are shown to parents in the same local area. If your postcode is blank, the feed may appear empty.',
  },
  {
    q: 'How do I delete a marketplace listing I\'ve posted?',
    a: 'Open the Marketplace tab, hover over your listing, and tap the red trash icon. Alternatively, tap the listing to open it and use the delete option at the bottom.',
  },
  {
    q: 'My connection request isn\'t showing for the other person.',
    a: 'Connection requests appear in the "Requests" tab of My Village. If they haven\'t responded, you can cancel the request and try again, or message them directly if you\'re already connected.',
  },
  {
    q: 'How do I report another user?',
    a: 'Tap the ⋯ (three dots) on any post to report it. For account-level reports, use the form below. We review all reports within 24 hours.',
  },
  {
    q: 'Can I use Sprout anonymously?',
    a: 'When creating a post, you can toggle "Post anonymously" — your name won\'t be shown. Your profile and messages are always tied to your account for safety.',
  },
  {
    q: 'How do I reset my password?',
    a: 'On the login screen, tap "Forgot your password?" and enter your email. You\'ll receive a reset link within a few minutes. Check your spam folder if it doesn\'t arrive.',
  },
  {
    q: 'Can I turn off email notifications?',
    a: 'In-app notifications can be managed in Settings → Notifications. Email notification preferences can be managed from the link in any email we send you.',
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="max-w-2xl mx-auto px-5 py-10 pb-16">
        <div className="flex items-center gap-3 mb-10">
          <Link href="/" className="w-9 h-9 rounded-xl border flex items-center justify-center hover:opacity-70 transition-opacity" style={{ borderColor: 'var(--border-color)', background: 'white', color: '#5a4035' }}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand)' }}>
              <Leaf className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg" style={{ color: 'var(--brand)' }}>Sprout</span>
          </div>
        </div>

        <h1 className="text-3xl font-extrabold mb-2" style={{ color: '#2a1f18' }}>Help & Support</h1>
        <p className="text-base mb-8" style={{ color: '#9a8070' }}>Find answers to common questions, or get in touch with our team.</p>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3 mb-10">
          {[
            { icon: BookOpen, title: 'Community Guidelines', href: '/guidelines', color: '#059669', bg: '#ECFDF5' },
            { icon: Flag, title: 'Report a Problem', href: '#report', color: '#dc2626', bg: '#FEF2F2' },
            { icon: Mail, title: 'Email Support', href: 'mailto:hello@sprout.app', color: '#2563eb', bg: '#EFF4FF' },
            { icon: MessageCircle, title: 'Privacy Policy', href: '/privacy', color: '#7D3C1A', bg: '#FFF5EF' },
          ].map(({ icon: Icon, title, href, color, bg }) => (
            <Link key={title} href={href} className="card-sprout p-4 flex items-center gap-3 transition-opacity hover:opacity-80">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <span className="text-sm font-semibold" style={{ color: '#2a1f18' }}>{title}</span>
            </Link>
          ))}
        </div>

        {/* FAQ */}
        <h2 className="text-xl font-bold mb-4" style={{ color: '#2a1f18' }}>Frequently Asked Questions</h2>
        <div className="space-y-3 mb-12">
          {FAQS.map(({ q, a }) => (
            <div key={q} className="card-sprout p-5">
              <p className="text-sm font-semibold mb-1.5" style={{ color: '#2a1f18' }}>{q}</p>
              <p className="text-sm" style={{ color: '#5a4035', lineHeight: 1.65 }}>{a}</p>
            </div>
          ))}
        </div>

        {/* Report form anchor */}
        <div id="report" className="card-sprout p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#FEF2F2' }}>
              <Flag className="w-5 h-5" style={{ color: '#dc2626' }} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: '#2a1f18' }}>Report a Problem</h2>
              <p className="text-xs" style={{ color: '#9a8070' }}>We review all reports within 24 hours</p>
            </div>
          </div>
          <p className="text-sm mb-4" style={{ color: '#5a4035' }}>
            To report abusive content, a safety concern, or a technical issue, email us directly at{' '}
            <a href="mailto:report@sprout.app" className="font-semibold underline" style={{ color: 'var(--brand)' }}>report@sprout.app</a>{' '}
            with as much detail as possible (screenshots help). For urgent safety concerns, please also contact your local authorities.
          </p>
          <a
            href="mailto:report@sprout.app"
            className="btn-brand text-sm inline-flex"
          >
            Send a report
          </a>
        </div>
      </div>
    </div>
  );
}
