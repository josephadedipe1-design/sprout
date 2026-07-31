import Link from 'next/link';
import { Leaf, ArrowLeft, Shield, MapPin, Users, Home, Eye, Phone, Flag } from 'lucide-react';

const TIPS = [
  {
    icon: MapPin,
    title: 'Meet in a public place',
    body: 'For first meetups, always choose a busy, public location — a café, park, library, or children\u2019s centre. Avoid meeting at someone\u2019s home or inviting someone to yours until you know them well.',
    color: '#059669',
    bg: '#ECFDF5',
  },
  {
    icon: Users,
    title: 'Tell someone where you\u2019re going',
    body: 'Let a trusted friend or family member know who you\u2019re meeting, where, and when. Share the other parent\u2019s profile name and arrange to check in afterwards.',
    color: '#2563EB',
    bg: '#EFF4FF',
  },
  {
    icon: Home,
    title: 'Protect your home address',
    body: 'Don\u2019t share your exact home address with someone you haven\u2019t met in person. Your postcode area is enough for planning a meetup. Be cautious about posting photos that reveal your home or children\u2019s school.',
    color: '#D97706',
    bg: '#FFF7ED',
  },
  {
    icon: Eye,
    title: 'Trust your instincts',
    body: 'If something feels off — pressure to meet privately, inconsistent stories, or any discomfort — you can cancel or leave at any time. You owe no one an explanation, and you can block or report the person from their profile.',
    color: '#DC2626',
    bg: '#FEF2F2',
  },
  {
    icon: Phone,
    title: 'If you\u2019re in immediate danger',
    body: 'Call 999 (or 112) right away. For non-urgent concerns about a child\u2019s safety, contact the NSPCC on 0808 800 5000 or your local social services. These services are independent of Sprout.',
    color: '#7D3C1A',
    bg: '#FFF5EF',
  },
];

export default function SafetyPage() {
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

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: '#ECFDF5' }}>
            <Shield className="w-6 h-6" style={{ color: '#059669' }} />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold" style={{ color: '#2a1f18' }}>Meetup Safety</h1>
            <p className="text-sm" style={{ color: '#9a8070' }}>Simple steps to stay safe when meeting new people</p>
          </div>
        </div>

        <div className="card-sprout p-5 mb-8" style={{ background: '#F0FDF4', borderColor: '#BBF7D0' }}>
          <p className="text-sm" style={{ color: '#15803D', lineHeight: 1.65 }}>
            Sprout connects you with parents nearby — people you may not have met before. Most meetups are friendly and positive, but a few simple habits help keep you and your children safe.
          </p>
        </div>

        <div className="space-y-4">
          {TIPS.map(({ icon: Icon, title, body, color, bg }) => (
            <div key={title} className="card-sprout p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <div>
                  <h2 className="text-base font-bold mb-1.5" style={{ color: '#2a1f18' }}>{title}</h2>
                  <p className="text-sm" style={{ color: '#5a4035', lineHeight: 1.65 }}>{body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="card-sprout p-5 mt-8">
          <div className="flex items-center gap-2 mb-3">
            <Flag className="w-4 h-4" style={{ color: '#dc2626' }} />
            <h2 className="text-base font-bold" style={{ color: '#2a1f18' }}>Report a concern</h2>
          </div>
          <p className="text-sm mb-4" style={{ color: '#5a4035', lineHeight: 1.65 }}>
            If someone makes you uncomfortable, sends inappropriate messages, or behaves in a way that feels unsafe, you can report them directly from their profile or any post and message. You can also block them — they won&rsquo;t be able to see or contact you afterwards.
          </p>
          <p className="text-sm" style={{ color: '#5a4035', lineHeight: 1.65 }}>
            For anything urgent, contact the police on 999. For non-urgent child safety concerns, the NSPCC helpline is 0808 800 5000.
          </p>
        </div>

        <p className="text-center text-xs mt-10" style={{ color: '#b8a090' }}>
          <Link href="/help" className="underline" style={{ color: '#9a8070' }}>Help &amp; Support</Link>
          {' \u00b7 '}
          <Link href="/guidelines" className="underline" style={{ color: '#9a8070' }}>Community Guidelines</Link>
          {' \u00b7 '}
          <Link href="/terms" className="underline" style={{ color: '#9a8070' }}>Terms</Link>
          {' \u00b7 '}
          <Link href="/privacy" className="underline" style={{ color: '#9a8070' }}>Privacy</Link>
        </p>
      </div>
    </div>
  );
}
