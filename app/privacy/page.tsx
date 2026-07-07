import Link from 'next/link';
import { Leaf, ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
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

        <h1 className="text-3xl font-extrabold mb-2" style={{ color: '#2a1f18' }}>Privacy Policy</h1>
        <p className="text-sm mb-8" style={{ color: '#9a8070' }}>Last updated: July 2026</p>

        <div className="space-y-8 text-sm leading-relaxed" style={{ color: '#4a3828' }}>
          {[
            {
              title: '1. Information We Collect',
              body: `When you create a Sprout account, we collect your email address, name, general location (neighbourhood and postcode prefix — never your full address), parenting stage, and interests. We also collect the content you post, messages you send, and marketplace listings you create. We do not collect or store your precise GPS coordinates.`,
            },
            {
              title: '2. How We Use Your Information',
              body: `We use your information to provide and improve the Sprout service, show you relevant local parents and community posts, and send you notifications about activity relevant to you (likes, comments, connection requests). We do not sell your personal data to third parties.`,
            },
            {
              title: '3. Local Community Visibility',
              body: `Your neighbourhood and first part of your postcode are shown to other Sprout members in your area so they can find parents near them. Your full postcode, email address, and precise location are never visible to other members. You can control your neighbourhood visibility in Settings → Privacy.`,
            },
            {
              title: '4. Data Retention',
              body: `We retain your data for as long as your account is active. When you delete your account, your profile, posts, messages, and marketplace listings are permanently deleted within 30 days. Some anonymised, aggregated data may be retained for product analytics.`,
            },
            {
              title: '5. Cookies',
              body: `Sprout uses cookies and local storage to keep you logged in and remember your preferences. We use Supabase for authentication, which sets a session cookie. We do not use advertising or tracking cookies.`,
            },
            {
              title: '6. Third-Party Services',
              body: `Sprout is built on Supabase (database and authentication) and hosted on Netlify. These providers process data on our behalf under their own privacy policies and security standards. Profile photos may be served via Pexels (stock images) or Supabase Storage.`,
            },
            {
              title: '7. Your Rights',
              body: `You have the right to access, correct, or delete your personal data at any time. You can update your profile in the app, adjust privacy settings, or delete your account entirely from Settings. For other data requests, contact us at privacy@sprout.app.`,
            },
            {
              title: '8. Children',
              body: `Sprout is designed for parents and expecting parents aged 18 and over. We do not knowingly collect information from anyone under 18. If you believe a minor has created an account, please contact us.`,
            },
            {
              title: '9. Changes',
              body: `We may update this Privacy Policy from time to time. We will notify you of significant changes via the app. Continued use of Sprout after changes take effect constitutes acceptance of the updated policy.`,
            },
            {
              title: '10. Contact',
              body: `Questions about privacy? Email us at privacy@sprout.app.`,
            },
          ].map(({ title, body }) => (
            <section key={title}>
              <h2 className="text-base font-bold mb-2" style={{ color: '#2a1f18' }}>{title}</h2>
              <p style={{ lineHeight: 1.7 }}>{body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
