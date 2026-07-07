import Link from 'next/link';
import { Leaf, ArrowLeft, Heart, MessageCircle, ShoppingBag, Users, Shield, AlertTriangle } from 'lucide-react';

const RULES = [
  {
    icon: Heart,
    title: 'Be kind and supportive',
    body: 'Parenting is hard. Offer encouragement, not judgment. Every family is doing their best in different circumstances. Constructive advice is welcome — unsolicited criticism is not.',
    color: '#ef4444',
    bg: '#FFF0F0',
  },
  {
    icon: MessageCircle,
    title: 'Keep it relevant',
    body: 'Post content that is genuinely useful to your local parent community — questions, meetups, tips, support, and marketplace listings. Off-topic promotional content or spam will be removed.',
    color: '#7D3C1A',
    bg: '#FFF5EF',
  },
  {
    icon: Users,
    title: 'Respect privacy',
    body: 'Do not share other people\'s personal details without their consent. This includes photos of other parents\' children, addresses, phone numbers, or any identifying information.',
    color: '#2563eb',
    bg: '#EFF4FF',
  },
  {
    icon: Shield,
    title: 'No harassment or hate',
    body: 'Sprout has zero tolerance for harassment, bullying, discrimination, or hateful content of any kind — based on race, gender, religion, parenting choices, or anything else. Violations result in immediate removal.',
    color: '#059669',
    bg: '#ECFDF5',
  },
  {
    icon: ShoppingBag,
    title: 'Honest marketplace',
    body: 'List items accurately. Describe real conditions, include real photos, and price fairly. Scams, counterfeit goods, and unsafe items are strictly prohibited and will be reported to authorities if necessary.',
    color: '#d97706',
    bg: '#FFF7ED',
  },
  {
    icon: AlertTriangle,
    title: 'Safety first',
    body: 'For meetups and marketplace exchanges, always meet in public places. Trust your instincts. If something feels wrong, it probably is. Report anything concerning using the "Report a Problem" link.',
    color: '#dc2626',
    bg: '#FEF2F2',
  },
];

export default function GuidelinesPage() {
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

        <h1 className="text-3xl font-extrabold mb-2" style={{ color: '#2a1f18' }}>Community Guidelines</h1>
        <p className="text-base mb-8" style={{ color: '#9a8070', lineHeight: 1.6 }}>
          Sprout is a place for parents to support each other. These guidelines exist to keep it safe, warm, and genuinely useful for every family in your area.
        </p>

        <div className="space-y-4 mb-10">
          {RULES.map(({ icon: Icon, title, body, color, bg }) => (
            <div key={title} className="card-sprout p-5 flex gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <div>
                <h2 className="text-sm font-bold mb-1" style={{ color: '#2a1f18' }}>{title}</h2>
                <p className="text-sm" style={{ color: '#5a4035', lineHeight: 1.65 }}>{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl p-6 text-center" style={{ background: 'var(--brand-light)', border: '1px solid #e8c9b4' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#2a1f18' }}>See something that doesn&apos;t belong?</p>
          <p className="text-sm mb-4" style={{ color: '#7a6055' }}>Use the "Report a Problem" option in Settings or tap ⋯ on any post to report it directly. Our team reviews all reports.</p>
          <Link href="/help#report" className="btn-brand text-sm inline-flex">Report a problem</Link>
        </div>
      </div>
    </div>
  );
}
