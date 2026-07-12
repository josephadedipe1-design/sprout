'use client';

import { useState, useEffect, useCallback } from 'react';
import { Heart, MessageCircle, UserPlus, Bell, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface RealNotification {
  id: string;
  type: 'like' | 'comment' | 'connect';
  actorName: string;
  actorAvatar: string;
  text: string;
  time: string;
  read: boolean;
  created_at: string;
}

const ICON_MAP: Record<string, { icon: React.FC<{ className?: string; style?: React.CSSProperties }>, bg: string, color: string }> = {
  like:    { icon: Heart,         bg: '#FFF0F0', color: '#ef4444' },
  comment: { icon: MessageCircle, bg: '#FFF5EF', color: '#7D3C1A' },
  connect: { icon: UserPlus,      bg: '#F0FDF4', color: '#16a34a' },
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins || 1}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function truncate(str: string, len = 50) {
  return str.length > len ? str.slice(0, len) + '…' : str;
}

interface NotificationsViewProps {
  onGoToFeed: () => void;
  onGoToMatching: () => void;
  onGoToMessages: () => void;
}

export default function NotificationsView({ onGoToFeed, onGoToMatching, onGoToMessages }: NotificationsViewProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<RealNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    const all: RealNotification[] = [];

    // Fetch my posts so we can filter activity on them
    const { data: myPosts } = await supabase
      .from('posts')
      .select('id, body')
      .eq('user_id', user.id);

    const myPostIds = (myPosts ?? []).map((p: any) => p.id);
    const postContentMap: Record<string, string> = {};
    (myPosts ?? []).forEach((p: any) => { postContentMap[p.id] = p.body; });

    // Collect all actor user_ids so we can batch-fetch profiles
    const actorIds = new Set<string>();

    // 1. Likes on my posts
    const likesRaw: any[] = [];
    if (myPostIds.length > 0) {
      const { data } = await supabase
        .from('post_likes')
        .select('user_id, post_id, created_at')
        .in('post_id', myPostIds)
        .neq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      (data ?? []).forEach((r: any) => { likesRaw.push(r); actorIds.add(r.user_id); });
    }

    // 2. Comments on my posts
    const commentsRaw: any[] = [];
    if (myPostIds.length > 0) {
      const { data } = await supabase
        .from('comments')
        .select('id, user_id, post_id, content, created_at')
        .in('post_id', myPostIds)
        .neq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      (data ?? []).forEach((r: any) => { commentsRaw.push(r); actorIds.add(r.user_id); });
    }

    // 3. Pending connection requests to me
    const { data: connRaw } = await supabase
      .from('match_requests')
      .select('id, from_user_id, created_at')
      .eq('to_user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(20);
    (connRaw ?? []).forEach((r: any) => actorIds.add(r.from_user_id));

    // Batch-fetch all actor profiles
    const profileMap: Record<string, { name: string; avatar_url: string }> = {};
    if (actorIds.size > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', Array.from(actorIds));
      (profileRows ?? []).forEach((p: any) => { profileMap[p.id] = p; });
    }

    for (const r of likesRaw) {
      const actor = profileMap[r.user_id];
      all.push({
        id: `like-${r.user_id}-${r.created_at}`,
        type: 'like',
        actorName: actor?.name || 'Someone',
        actorAvatar: actor?.avatar_url || '',
        text: `liked your post "${truncate(postContentMap[r.post_id] || '')}"`,
        time: formatRelativeTime(r.created_at),
        read: false,
        created_at: r.created_at,
      });
    }

    for (const r of commentsRaw) {
      const actor = profileMap[r.user_id];
      all.push({
        id: `comment-${r.id}`,
        type: 'comment',
        actorName: actor?.name || 'Someone',
        actorAvatar: actor?.avatar_url || '',
        text: `commented on your post: "${truncate(r.content || '')}"`,
        time: formatRelativeTime(r.created_at),
        read: false,
        created_at: r.created_at,
      });
    }

    for (const r of (connRaw ?? [])) {
      const actor = profileMap[r.from_user_id];
      all.push({
        id: `connect-${r.id}`,
        type: 'connect',
        actorName: actor?.name || 'Someone',
        actorAvatar: actor?.avatar_url || '',
        text: 'wants to connect with you',
        time: formatRelativeTime(r.created_at),
        read: false,
        created_at: r.created_at,
      });
    }

    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setNotifications(all);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }

  function handleTap(n: RealNotification) {
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
    if (n.type === 'connect') onGoToMatching();
    else if (n.type === 'like' || n.type === 'comment') onGoToFeed();
    else onGoToMessages();
  }

  const unread = notifications.filter(n => !n.read);
  const read   = notifications.filter(n =>  n.read);

  function renderItem(n: RealNotification) {
    const { icon: Icon, bg, color } = ICON_MAP[n.type] || ICON_MAP.comment;
    const isUnread = !n.read;
    return (
      <button
        key={n.id}
        onClick={() => handleTap(n)}
        className="w-full flex items-start gap-3 p-4 rounded-xl text-left transition-opacity hover:opacity-80"
        style={{
          background: isUnread ? 'var(--brand-light)' : 'white',
          border: `1px solid ${isUnread ? '#f0d5c0' : 'var(--border-color)'}`,
        }}
      >
        <div className="relative flex-shrink-0">
          {n.actorAvatar ? (
            <img src={n.actorAvatar} alt={n.actorName} className="w-11 h-11 rounded-full object-cover" />
          ) : (
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold" style={{ background: bg, color }}>
              {n.actorName.charAt(0)}
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: bg }}>
            <Icon className="w-3 h-3" style={{ color }} />
          </div>
        </div>
        <div className="flex-1">
          <p className="text-sm" style={{ color: '#5a4035' }}>
            <strong style={{ color: '#2a1f18' }}>{n.actorName}</strong> {n.text}
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#9a8070' }}>{n.time}</p>
        </div>
        {isUnread && <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--brand)' }} />}
      </button>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 lg:pb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#2a1f18' }}>Notifications</h1>
          <p className="text-sm" style={{ color: '#9a8070' }}>
            {loading ? 'Loading…' : unread.length > 0 ? `${unread.length} new` : 'All caught up'}
          </p>
        </div>
        {unread.length > 0 && (
          <button onClick={markAllRead} className="text-sm font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--brand)' }}>
            Mark all read
          </button>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl p-4 animate-pulse" style={{ background: 'white', border: '1px solid var(--border-color)' }}>
              <div className="flex gap-3">
                <div className="w-11 h-11 rounded-full flex-shrink-0" style={{ background: '#e8e4de' }} />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 rounded" style={{ background: '#e8e4de', width: '70%' }} />
                  <div className="h-2 rounded" style={{ background: '#e8e4de', width: '30%' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && notifications.length === 0 && (
        <div className="flex flex-col items-center text-center py-16">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--brand-light)' }}>
            <Bell className="w-7 h-7" style={{ color: 'var(--brand)' }} />
          </div>
          <p className="text-base font-semibold mb-1" style={{ color: '#2a1f18' }}>No notifications yet</p>
          <p className="text-sm" style={{ color: '#9a8070' }}>When someone likes your post, comments, or wants to connect, you&apos;ll see it here.</p>
        </div>
      )}

      {!loading && unread.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#9a8070' }}>New</p>
          <div className="space-y-2">{unread.map(renderItem)}</div>
        </div>
      )}

      {!loading && read.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#9a8070' }}>Earlier</p>
          <div className="space-y-2">{read.map(renderItem)}</div>
        </div>
      )}
    </div>
  );
}
