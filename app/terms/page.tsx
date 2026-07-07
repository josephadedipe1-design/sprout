import Link from 'next/link';
import { Leaf, ArrowLeft } from 'lucide-react';

export default function TermsPage() {
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

        <h1 className="text-3xl font-extrabold mb-2" style={{ color: '#2a1f18' }}>Terms of Service</h1>
        <p className="text-sm mb-8" style={{ color: '#9a8070' }}>Last updated: July 2026</p>

        <div className="space-y-8 text-sm leading-relaxed" style={{ color: '#4a3828' }}>
          {[
            {
              title: '1. Acceptance',
              body: `By creating a Sprout account or using our service, you agree to these Terms of Service. If you do not agree, please do not use Sprout.`,
            },
            {
              title: '2. Eligibility',
              body: `You must be 18 or older to use Sprout. The service is intended for parents, expecting parents, and those planning a family. By registering, you confirm you meet these requirements.`,
            },
            {
              title: '3. Your Account',
              body: `You are responsible for keeping your login credentials secure and for all activity that occurs under your account. Please notify us immediately if you suspect unauthorised access. You may not create accounts for others or transfer your account.`,
            },
            {
              title: '4. Community Standards',
              body: `Sprout is a supportive community. You agree not to post content that is abusive, harassing, discriminatory, sexually explicit, or otherwise harmful. You must not impersonate others, spread misinformation, or use Sprout for commercial spam. Violations may result in content removal or account suspension. Our full Community Guidelines provide more detail.`,
            },
            {
              title: '5. Content You Post',
              body: `You retain ownership of the content you post on Sprout. By posting, you grant Sprout a non-exclusive, royalty-free licence to display and distribute that content within the service. You are responsible for ensuring your content does not infringe third-party rights.`,
            },
            {
              title: '6. Marketplace',
              body: `Sprout provides a peer-to-peer marketplace for parents to buy, sell, and give away children's items. Sprout is not a party to any transaction and accepts no liability for the quality, safety, or legality of listed items. Users transact at their own risk and are encouraged to meet in safe, public locations.`,
            },
            {
              title: '7. Service Availability',
              body: `We aim to keep Sprout available at all times but cannot guarantee uninterrupted access. We may modify or discontinue features with reasonable notice. We are not liable for losses resulting from service downtime.`,
            },
            {
              title: '8. Limitation of Liability',
              body: `To the maximum extent permitted by law, Sprout is provided "as is" without warranties of any kind. Sprout's liability for any claim arising from use of the service is limited to the amount you paid us in the past 12 months (which is £0 for the free tier).`,
            },
            {
              title: '9. Governing Law',
              body: `These Terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.`,
            },
            {
              title: '10. Contact',
              body: `For questions about these Terms, contact us at hello@sprout.app.`,
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
