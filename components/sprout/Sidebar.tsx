'use client';

import { Leaf, Home, MessageCircle, Users, Bell, User, Search, Plus, LogOut, ShoppingBag } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { formatLocation } from '@/lib/utils';

type View = 'feed' | 'market' | 'messages' | 'matching' | 'notifications' | 'profile' | 'search';

interface SidebarProps {
  active: View;
  onNav: (v: View) => void;
  onNewPost?: () => void;
  hasUnread?: boolean;
  unreadMessages?: number;
}

const NAV = [
  { id: 'feed',          icon: Home,          label: 'Feed' },
  { id: 'market',        icon: ShoppingBag,   label: 'Market' },
  { id: 'matching',      icon: Users,         label: 'MyVillage' },
  { id: 'messages',      icon: MessageCircle, label: 'Messages' },
  { id: 'notifications', icon: Bell,          label: 'Notifications' },
  { id: 'profile',       icon: User,          label: 'Profile' },
] as const;

export default function Sidebar({ active, onNav, onNewPost, hasUnread = false, unreadMessages = 0 }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push('/');
  }

  const displayName = profile?.first_name || 'You';
  const displayLocation = formatLocation(profile?.postcode_district || '');
  const avatarUrl = profile?.avatar_url || '';
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <aside
      className="hidden lg:flex flex-col h-screen sticky top-0 flex-shrink-0"
      style={{ width: 240, background: 'white', borderRight: '1px solid var(--border-color)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--brand)' }}>
          <Leaf className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold" style={{ color: 'var(--brand)' }}>Sprout</span>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <button
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors"
          style={{ background: '#f4f3f0', color: '#9a8070' }}
          onClick={() => onNav('search')}
        >
          <Search className="w-4 h-4" />
          Search Sprout…
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {NAV.map(({ id, icon: Icon, label }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onNav(id as View)}
              className="sidebar-link w-full"
              style={isActive ? {
                background: 'var(--brand-light)',
                color: 'var(--brand)',
                fontWeight: 600,
              } : {}}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {label}
              {id === 'notifications' && hasUnread && (
                <span
                  className="ml-auto w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: '#E53E3E' }}
                />
              )}
              {id === 'messages' && unreadMessages > 0 && (
                <span
                  className="ml-auto text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: '#E53E3E', minWidth: '1.25rem', height: '1.25rem', fontSize: '0.65rem', padding: '0 0.25rem' }}
                >
                  {unreadMessages > 5 ? '5+' : unreadMessages}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* New post button */}
      <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
        <button className="btn-brand w-full text-sm" onClick={onNewPost}>
          <Plus className="w-4 h-4" /> New Post
        </button>
      </div>

      {/* User */}
      <div className="px-4 py-4 border-t flex items-center gap-3" style={{ borderColor: 'var(--border-color)' }}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
            style={{ background: 'var(--brand)' }}
          >
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: '#2a1f18' }}>{displayName}</p>
          {displayLocation && <p className="text-xs truncate" style={{ color: '#9a8070' }}>{displayLocation}</p>}
        </div>
        <button onClick={handleSignOut} style={{ color: '#c4a090' }} title="Sign out">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
