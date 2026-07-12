'use client';

import { useEffect, useState } from 'react';
import { MapPin, Edit3, Settings, Heart, FileText, ShoppingBag, UserPlus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatLocation } from '@/lib/utils';

interface ActivityItem {
  id: string;
  type: 'post' | 'listing' | 'connection';
  time: string;
  created_at: string;
  text: string;
  reactions: number;
}

interface Stats {
  posts: number;
  connections: number;
  listings: number;
}

const TYPE_META: Record<string, { Icon: React.ElementType; color: string; bg: string; label: string }> = {
  post:       { Icon: FileText,    color: 'var(--brand)',  bg: 'var(--brand-light)', label: 'Post' },
  listing:    { Icon: ShoppingBag, color: '#16a34a',       bg: '#d6ede3',            label: 'Market' },
  connection: { Icon: UserPlus,    color: '#2c5faa',       bg: '#dce8fb',            label: 'Connection' },
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins || 1}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface ProfileViewProps {
  onEditProfile: () => void;
  onSettings: () => void;
}

export default function ProfileView({ onEditProfile, onSettings }: ProfileViewProps) {
  const { profile, user } = useAuth();
  const [stats, setStats] = useState<Stats>({ posts: 0, connections: 0, listings: 0 });
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    if (!user) return;

    async function loadStats() {
      const [postsRes, connectionsRes, listingsRes] = await Promise.all([
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', user!.id),
        supabase.from('match_requests').select('id', { count: 'exact', head: true })
          .or(`from_user_id.eq.${user!.id},to_user_id.eq.${user!.id}`)
          .eq('status', 'connected'),
        supabase.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', user!.id),
      ]);
      setStats({
        posts: postsRes.count ?? 0,
        connections: connectionsRes.count ?? 0,
        listings: listingsRes.count ?? 0,
      });
    }

    async function loadActivity() {
      const [postsRes, listingsRes] = await Promise.all([
        supabase.from('posts').select('id, body, created_at').eq('author_id', user!.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('listings').select('id, title, price_pence, created_at').eq('seller_id', user!.id).order('created_at', { ascending: false }).limit(3),
      ]);

      const items: ActivityItem[] = [];

      (postsRes.data ?? []).forEach(p => items.push({
        id: p.id,
        type: 'post',
        time: formatRelativeTime(p.created_at),
        created_at: p.created_at,
        text: p.body.length > 120 ? p.body.slice(0, 120) + '…' : p.body,
        reactions: 0,
      }));

      (listingsRes.data ?? []).forEach(l => items.push({
        id: l.id,
        type: 'listing',
        time: formatRelativeTime(l.created_at),
        created_at: l.created_at,
        text: `Listed "${l.title}" on the Market${l.price_pence > 0 ? ` for £${(l.price_pence / 100).toFixed(2)}` : ' for free'}.`,
        reactions: 0,
      }));

      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setActivity(items.slice(0, 6));
    }

    loadStats();
    loadActivity();
  }, [user]);

  const firstName = profile?.first_name || '';
  const lastInitial = profile?.last_initial || '';
  const displayName = firstName
    ? `${firstName}${lastInitial ? ' ' + lastInitial + '.' : ''}`
    : 'You';
  const location = formatLocation(profile?.postcode_district || '') || 'Location not set';
  const bio = profile?.bio || '';
  const interests = profile?.interests ?? [];
  const avatarUrl = profile?.avatar_url || '';
  const initials = firstName ? firstName.charAt(0).toUpperCase() : 'Y';

  const profileIncomplete = !firstName;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 lg:pb-6">
      {profileIncomplete && (
        <div
          className="mb-5 p-4 rounded-2xl flex items-start gap-3"
          style={{ background: '#fff8f3', border: '1px solid #f0d0b4' }}
        >
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: '#fde8d8' }}>
            <Edit3 className="w-4 h-4" style={{ color: '#c05a20' }} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold mb-0.5" style={{ color: '#2a1f18' }}>Complete your profile</p>
            <p className="text-xs leading-relaxed" style={{ color: '#9a8070' }}>
              Your registration details didn&apos;t save correctly. Tap <strong>Edit</strong> to add your name, postcode, and interests.
            </p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-start gap-4 mb-5">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-20 h-20 rounded-full object-cover flex-shrink-0 border-2"
            style={{ borderColor: 'var(--border-color)' }}
          />
        ) : (
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0 border-2 text-2xl font-bold text-white"
            style={{ borderColor: 'var(--border-color)', background: 'var(--brand)' }}
          >
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold" style={{ color: '#2a1f18' }}>{displayName}</h1>
              <div className="flex items-center gap-1.5 text-sm mt-0.5" style={{ color: '#9a8070' }}>
                <MapPin className="w-3.5 h-3.5" /> {location}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={onEditProfile}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors hover:opacity-80"
                style={{ borderColor: 'var(--border-color)', color: '#5a4035', background: 'white' }}
              >
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                onClick={onSettings}
                className="w-8 h-8 rounded-xl border flex items-center justify-center transition-colors hover:opacity-80"
                style={{ borderColor: 'var(--border-color)', color: '#5a4035', background: 'white' }}
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bio */}
      {bio ? (
        <p className="text-sm leading-relaxed mb-4" style={{ color: '#5a4035', lineHeight: 1.6 }}>{bio}</p>
      ) : (
        <p className="text-sm mb-4 italic" style={{ color: '#c4a090' }}>No bio yet — add one via Edit.</p>
      )}

      {/* Interest tags */}
      {interests.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {interests.map((t) => (
            <span key={t} className="tag-sprout text-xs" style={{ background: '#f4f3f0', color: '#7a6055', border: '1px solid #e0dbd4' }}>{t}</span>
          ))}
        </div>
      ) : (
        <p className="text-sm mb-5 italic" style={{ color: '#c4a090' }}>No interests selected — add some via Edit.</p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Posts', value: stats.posts },
          { label: 'Connections', value: stats.connections },
          { label: 'Listings', value: stats.listings },
        ].map(({ label, value }) => (
          <div key={label} className="card-sprout py-3 text-center">
            <p className="text-lg font-bold" style={{ color: '#2a1f18' }}>{value}</p>
            <p className="text-xs" style={{ color: '#9a8070' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Activity feed */}
      <h2 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: '#b8a090' }}>Activity</h2>
      {activity.length === 0 ? (
        <div className="card-sprout p-6 text-center">
          <p className="text-sm" style={{ color: '#9a8070' }}>No activity yet. Start posting or listing items!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activity.map((item) => {
            const meta = TYPE_META[item.type];
            return (
              <div key={item.id} className="card-sprout p-4 flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: meta.bg }}
                >
                  <meta.Icon className="w-4 h-4" style={{ color: meta.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</span>
                    <span className="text-xs" style={{ color: '#c4a090' }}>{item.time}</span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: '#3a2820' }}>{item.text}</p>
                  {item.reactions > 0 && (
                    <div className="flex items-center gap-1 mt-2 text-xs" style={{ color: '#9a8070' }}>
                      <Heart className="w-3.5 h-3.5" fill="currentColor" style={{ color: '#e07070' }} />
                      {item.reactions} reactions
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
