'use client';

import { useEffect, useState, useCallback } from 'react';
import { MapPin, Edit3, Settings, Heart, FileText, ShoppingBag, UserPlus, Baby, Users, Bookmark, MessageCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { fetchUserInterests, ageMonthsToLabel } from '@/lib/profiles';
import { formatLocation, formatName, objectPosition } from '@/lib/utils';
import { renderAnnouncementMarkdown } from '@/lib/announcement-markdown';
import type { DbProfile } from '@/lib/types';

interface ActivityItem {
  id: string;
  type: 'post' | 'listing' | 'connection';
  time: string;
  created_at: string;
  text: string;
  reactions: number;
  sold?: boolean;
}

interface Stats {
  posts: number;
  connections: number;
  listings: number;
}

interface SavedPost {
  id: string;
  post_type: string;
  body: string;
  created_at: string;
  author_id: string;
  profile: DbProfile | null;
  is_official: boolean;
  image_url: string | null;
  likes: number;
  comments: number;
  saved: boolean;
}

const PARENT_TYPE_META: Record<string, { Icon: React.ElementType; label: string; color: string; bg: string }> = {
  expecting: { Icon: Baby,  label: 'Expecting',          color: '#2563EB', bg: '#EFF4FF' },
  parent:   { Icon: Heart, label: 'Parent',             color: 'var(--brand)', bg: 'var(--brand-light)' },
  both:     { Icon: Users, label: 'Parent & Expecting',  color: '#7c3aed', bg: '#F3EBFD' },
};

const TYPE_META: Record<string, { Icon: React.ElementType; color: string; bg: string; label: string }> = {
  post:       { Icon: FileText,    color: 'var(--brand)',  bg: 'var(--brand-light)', label: 'Post' },
  listing:    { Icon: ShoppingBag, color: '#16a34a',       bg: '#d6ede3',            label: 'Market' },
  connection: { Icon: UserPlus,    color: '#2c5faa',       bg: '#dce8fb',            label: 'Connection' },
};

const TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  question: { bg: '#FFF5EF', text: '#7D3C1A', label: 'Question' },
  support:  { bg: '#EFF4FF', text: '#2563EB', label: 'Support' },
  meetup:   { bg: '#ECFDF5', text: '#059669', label: 'Meetup' },
  market:   { bg: '#FFF7ED', text: '#D97706', label: 'Market' },
  tip:      { bg: '#F0FDF4', text: '#16A34A', label: 'Tip' },
  listing:  { bg: '#FFF7ED', text: '#D97706', label: 'Market' },
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
  onOpenThread: (postId: string) => void;
}

export default function ProfileView({ onEditProfile, onSettings, onOpenThread }: ProfileViewProps) {
  const { profile, user } = useAuth();
  const [stats, setStats] = useState<Stats>({ posts: 0, connections: 0, listings: 0 });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [childrenAges, setChildrenAges] = useState<string[]>([]);
  const [tab, setTab] = useState<'activity' | 'saved'>('activity');
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function loadStats() {
      const soldCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [postsRes, connectionsRes, listingsRes] = await Promise.all([
        supabase.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', user!.id),
        supabase.from('match_requests').select('id', { count: 'exact', head: true })
          .or(`from_user_id.eq.${user!.id},to_user_id.eq.${user!.id}`)
          .eq('status', 'connected'),
        supabase.from('listings').select('id', { count: 'exact', head: true })
          .eq('seller_id', user!.id)
          .or(`status.eq.active,and(status.eq.sold,sold_at.gt.${soldCutoff})`),
      ]);
      setStats({
        posts: postsRes.count ?? 0,
        connections: connectionsRes.count ?? 0,
        listings: listingsRes.count ?? 0,
      });
    }

    async function loadActivity() {
      const soldCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [postsRes, listingsRes] = await Promise.all([
        supabase.from('posts').select('id, body, created_at').eq('author_id', user!.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('listings').select('id, title, price_pence, created_at, status, sold_at').eq('seller_id', user!.id)
          .or(`status.eq.active,and(status.eq.sold,sold_at.gt.${soldCutoff})`)
          .order('created_at', { ascending: false }).limit(3),
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
        sold: l.status === 'sold',
      }));

      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setActivity(items.slice(0, 6));
    }

    loadStats();
    loadActivity();
    if (user) {
      fetchUserInterests(user.id).then(setInterests);
      supabase.from('children').select('age_months').eq('user_id', user.id).then(({ data }) => {
        setChildrenAges((data ?? []).map((c: { age_months: number }) => ageMonthsToLabel(c.age_months)));
      });
    }
  }, [user]);

  const loadSavedPosts = useCallback(async () => {
    if (!user) return;
    setSavedLoading(true);

    const { data: saves, error } = await supabase
      .from('post_saves')
      .select('post_id, saved_at:created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error || !saves || saves.length === 0) {
      setSavedPosts([]);
      setSavedLoading(false);
      return;
    }

    const postIds = saves.map(s => s.post_id);

    const { data: posts } = await supabase
      .from('posts')
      .select('*, likes(count), reply_count:replies(count)')
      .in('id', postIds)
      .order('created_at', { ascending: false });

    const authorIds = Array.from(new Set((posts ?? []).map((p: any) => p.author_id).filter(Boolean)));
    const profileMap: Record<string, DbProfile> = {};
    if (authorIds.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('*')
        .in('id', authorIds);
      (profileRows ?? []).forEach((p: DbProfile) => { profileMap[p.id] = p; });
    }

    const { data: myLikes } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', user.id);
    const likedIds = new Set((myLikes ?? []).map(l => l.post_id));

    const savedIdSet = new Set(postIds);

    const mapped: SavedPost[] = (posts ?? []).map((p: any) => ({
      id: p.id,
      post_type: p.post_type,
      body: p.body,
      created_at: p.created_at,
      author_id: p.author_id,
      profile: profileMap[p.author_id] ?? null,
      is_official: p.is_official ?? false,
      image_url: p.image_url ?? null,
      likes: p.likes?.[0]?.count ?? 0,
      comments: p.reply_count?.[0]?.count ?? 0,
      saved: savedIdSet.has(p.id),
      liked: likedIds.has(p.id),
    })) as SavedPost[];

    setSavedPosts(mapped);
    setSavedLoading(false);
  }, [user]);

  useEffect(() => {
    if (tab === 'saved' && user) {
      loadSavedPosts();
    }
  }, [tab, user, loadSavedPosts]);

  async function unsavePost(post: SavedPost, e: React.MouseEvent) {
    e.stopPropagation();
    if (!user) return;
    await supabase.from('post_saves').delete().eq('post_id', post.id).eq('user_id', user.id);
    setSavedPosts(prev => prev.filter(p => p.id !== post.id));
  }

  const firstName = profile?.first_name || '';
  const lastInitial = profile?.last_initial || '';
  const displayName = firstName
    ? `${firstName}${lastInitial ? ' ' + lastInitial + '.' : ''}`
    : 'You';
  const location = formatLocation(profile?.postcode_district || '', profile?.neighborhood) || 'Location not set';
  const bio = profile?.bio || '';
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
            style={{ borderColor: 'var(--border-color)', objectPosition: objectPosition(profile?.avatar_position_x, profile?.avatar_position_y) }}
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

      {/* Life stage badge + children */}
      {(() => {
        const meta = profile?.parent_type ? PARENT_TYPE_META[profile.parent_type] : undefined;
        if (!meta) return null;
        const Icon = meta.Icon;
        const hasChildren = childrenAges.length > 0;
        const childPrefix = childrenAges.length > 1 ? 'Children:' : 'Child:';
        return (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: meta.bg, color: meta.color }}>
              <Icon className="w-3.5 h-3.5" /> {meta.label}
            </span>
            {hasChildren && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold" style={{ color: '#9a8070' }}>{childPrefix}</span>
                {childrenAges.map((a) => (
                  <span key={a} className="tag-sprout text-xs" style={{ background: '#f4f3f0', color: '#7a6055', border: '1px solid #e0dbd4' }}>
                    <Baby className="w-3 h-3 mr-1" />{a}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })()}

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

      {/* Tab toggle */}
      <div className="flex gap-1 mb-4 p-1 rounded-xl" style={{ background: '#f4f3f0' }}>
        <button
          onClick={() => setTab('activity')}
          className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: tab === 'activity' ? 'white' : 'transparent',
            color: tab === 'activity' ? '#2a1f18' : '#9a8070',
            boxShadow: tab === 'activity' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          Activity
        </button>
        <button
          onClick={() => setTab('saved')}
          className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5"
          style={{
            background: tab === 'saved' ? 'white' : 'transparent',
            color: tab === 'saved' ? '#2a1f18' : '#9a8070',
            boxShadow: tab === 'saved' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          <Bookmark className="w-3.5 h-3.5" /> Saved
        </button>
      </div>

      {/* Activity feed */}
      {tab === 'activity' && (
        <>
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
                        {item.sold && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#374151', color: 'white' }}>Sold</span>}
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
        </>
      )}

      {/* Saved posts */}
      {tab === 'saved' && (
        <>
          {savedLoading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div key={i} className="card-sprout p-4 animate-pulse">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-full" style={{ background: '#e8e4de' }} />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 rounded" style={{ background: '#e8e4de', width: '40%' }} />
                      <div className="h-2 rounded" style={{ background: '#e8e4de', width: '60%' }} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 rounded" style={{ background: '#e8e4de' }} />
                    <div className="h-3 rounded" style={{ background: '#e8e4de', width: '80%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : savedPosts.length === 0 ? (
            <div className="flex flex-col items-center text-center py-14">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--brand-light)' }}>
                <Bookmark className="w-7 h-7" style={{ color: 'var(--brand)' }} />
              </div>
              <p className="text-base font-semibold mb-1" style={{ color: '#2a1f18' }}>No saved posts yet</p>
              <p className="text-sm" style={{ color: '#9a8070' }}>
                Tap the bookmark icon on any post to save it here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {savedPosts.map((post) => {
                const typeInfo = TYPE_COLORS[post.post_type] ?? TYPE_COLORS.question;
                const isOfficial = post.is_official;
                const authorName = isOfficial
                  ? 'Sprout Team'
                  : (formatName(post.profile?.first_name || '', post.profile?.last_initial) || 'Community Member');
                const authorAvatar = isOfficial ? '' : (post.profile?.avatar_url || '');
                const authorLocation = isOfficial
                  ? ''
                  : (post.profile?.postcode_district
                    ? formatLocation(post.profile.postcode_district, post.profile.neighborhood)
                    : '');
                const timeAgo = formatRelativeTime(post.created_at);

                return (
                  <article key={post.id} className="card-sprout overflow-hidden">
                    <div className="p-4 cursor-pointer hover:bg-orange-50/30 transition-colors" onClick={() => onOpenThread(post.id)}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          {isOfficial ? (
                            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand)' }}>
                              <MapPin className="w-5 h-5 text-white" />
                            </div>
                          ) : authorAvatar ? (
                            <img src={authorAvatar} alt={authorName} className="w-10 h-10 rounded-full object-cover" style={{ objectPosition: objectPosition(post.profile?.avatar_position_x, post.profile?.avatar_position_y) }} />
                          ) : (
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                              style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}
                            >
                              {authorName.charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-semibold" style={{ color: '#2a1f18' }}>{authorName}</p>
                            <div className="flex items-center gap-1 text-xs" style={{ color: '#9a8070' }}>
                              {authorLocation && <><MapPin className="w-3 h-3" />{authorLocation} · </>}
                              {timeAgo}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isOfficial ? (
                            <span className="tag-sprout" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>Announcement</span>
                          ) : (
                            <span className="tag-sprout" style={{ background: typeInfo.bg, color: typeInfo.text }}>{typeInfo.label}</span>
                          )}
                        </div>
                      </div>

                      <div
                        className="text-sm leading-relaxed mb-3 announcement-body"
                        style={{ color: '#3a2820', lineHeight: 1.6 }}
                        dangerouslySetInnerHTML={{ __html: renderAnnouncementMarkdown(post.body) }}
                      />
                      {post.image_url && (
                        <img
                          src={post.image_url}
                          alt="Post image"
                          className="w-full rounded-xl mb-3 aspect-video object-cover"
                          style={{ border: '1px solid var(--border-color)' }}
                        />
                      )}
                    </div>

                    <div className="flex items-center border-t px-4 py-2.5" style={{ borderColor: 'var(--border-color)' }}>
                      <button
                        onClick={() => onOpenThread(post.id)}
                        className="flex items-center gap-1.5 text-sm mr-5 transition-colors"
                        style={{ color: '#9a8070' }}
                      >
                        <Heart className="w-4 h-4" fill="none" />
                        {post.likes}
                      </button>
                      <button
                        onClick={() => onOpenThread(post.id)}
                        className="flex items-center gap-1.5 text-sm mr-5 transition-colors"
                        style={{ color: '#9a8070' }}
                      >
                        <MessageCircle className="w-4 h-4" />
                        {post.comments}
                      </button>
                      <button
                        className="flex items-center gap-1.5 text-sm ml-auto transition-colors"
                        style={{ color: 'var(--brand)' }}
                        onClick={(e) => unsavePost(post, e)}
                        title="Remove from saved"
                      >
                        <Bookmark className="w-4 h-4" fill="var(--brand)" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
