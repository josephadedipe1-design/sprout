'use client';

import { Home, MessageCircle, Users, Bell, User, ShoppingBag } from 'lucide-react';

type View = 'feed' | 'market' | 'messages' | 'matching' | 'notifications' | 'profile' | 'search';

interface MobileNavProps {
  active: View;
  onNav: (v: View) => void;
  hasUnread?: boolean;
  unreadMessages?: number;
}

const NAV = [
  { id: 'feed',          icon: Home,          label: 'Feed' },
  { id: 'market',        icon: ShoppingBag,   label: 'Market' },
  { id: 'matching',      icon: Users,         label: 'Village' },
  { id: 'messages',      icon: MessageCircle, label: 'Messages' },
  { id: 'notifications', icon: Bell,          label: 'Updates' },
  { id: 'profile',       icon: User,          label: 'Profile' },
] as const;

export default function MobileNav({ active, onNav, hasUnread = false, unreadMessages = 0 }: MobileNavProps) {
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center border-t"
      style={{ background: 'white', borderColor: 'var(--border-color)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {NAV.map(({ id, icon: Icon, label }) => {
        const isActive = active === id;
        const msgBadge = id === 'messages' && unreadMessages > 0;
        const notifBadge = id === 'notifications' && hasUnread;
        return (
          <button
            key={id}
            onClick={() => onNav(id as View)}
            className="flex-1 flex flex-col items-center gap-0.5 py-2.5 relative"
            style={{ color: isActive ? 'var(--brand)' : '#9a8070' }}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {msgBadge && (
                <span
                  className="absolute -top-1.5 -right-2 text-white text-xs font-bold rounded-full flex items-center justify-center"
                  style={{ background: '#E53E3E', minWidth: '1.125rem', height: '1.125rem', fontSize: '0.6rem', padding: '0 0.2rem' }}
                >
                  {unreadMessages > 5 ? '5+' : unreadMessages}
                </span>
              )}
              {notifBadge && (
                <span
                  className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white"
                  style={{ background: '#E53E3E' }}
                />
              )}
            </div>
            <span className="text-xs font-medium">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
