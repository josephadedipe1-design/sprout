'use client';

import { useState, useEffect, useCallback } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, MapPin, Leaf, Copy, Check as CheckIcon, ShoppingBag, Tag, Car, Moon, Gamepad2, Package, Utensils, Home, BookOpen, Box, Trash2 } from 'lucide-react';
// Share2 kept for the first-in-area invite card only
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { DbProfile, DbListing } from '@/lib/types';
import { getCategoryStyle, formatLocation } from '@/lib/utils';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Travel: Car, Sleep: Moon, Clothing: Tag, Toys: Gamepad2,
  Gear: Package, Feeding: Utensils, Furniture: Home, Education: BookOpen, Miscellaneous: Box,
};

interface Post {
  id: string;
  post_type: string;
  body: string;
  is_anonymous: boolean;
  created_at: string;
  author_id: string;
  profile: DbProfile | null;
  likes: number;
  comments: number;  liked: boolean;
  saved: boolean;
}

interface FeedListing {
  id: string;
  title: string;
  price_pence: number;
  condition: string;
  category: string;
  seller_id: string;
  postcode_district: string;
  status: string;
  offers_welcome: boolean;
  created_at: string;
}

type FeedItem =
  | { kind: 'post'; data: Post }
  | { kind: 'listing'; data: FeedListing };

const TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  question: { bg: '#FFF5EF', text: '#7D3C1A', label: 'Question' },
  support:  { bg: '#EFF4FF', text: '#2563EB', label: 'Support' },
  meetup:   { bg: '#ECFDF5', text: '#059669', label: 'Meetup' },
  market:   { bg: '#FFF7ED', text: '#D97706', label: 'Market' },
  tip:      { bg: '#F0FDF4', text: '#16A34A', label: 'Tip' },
  listing:  { bg: '#FFF7ED', text: '#D97706', label: 'Market' },
};

// Hardcoded neighbour map for UK postcode districts.
// Each entry lists immediate neighbouring districts (roughly within 2 miles).
const DISTRICT_NEIGHBOURS: Record<string, string[]> = {
  // South East London
  SE1:  ['SE11','SE16','SE17','SE1','EC1','EC4','SW1'],
  SE4:  ['SE13','SE14','SE23','SE4','SE5','SE22'],
  SE5:  ['SE15','SE17','SE22','SE24','SE4'],
  SE6:  ['SE12','SE13','SE23','SE26','BR1'],
  SE8:  ['SE10','SE14','SE16'],
  SE9:  ['SE12','SE18','BR5','DA16'],
  SE10: ['SE3','SE7','SE8','SE14'],
  SE12: ['SE6','SE9','SE13','BR1'],
  SE13: ['SE4','SE6','SE12','SE14','SE23'],
  SE14: ['SE4','SE8','SE13','SE15'],
  SE15: ['SE5','SE14','SE17','SE22'],
  SE16: ['SE1','SE8','SE17'],
  SE17: ['SE1','SE5','SE11','SE15','SE16'],
  SE18: ['SE7','SE9','DA18'],
  SE22: ['SE4','SE5','SE15','SE21','SE23','SE24'],
  SE23: ['SE4','SE6','SE13','SE22','SE26'],
  SE24: ['SE5','SE21','SE22','SW2'],
  SE26: ['SE6','SE23','SE25','BR3'],
  // South West London
  SW1:  ['SW3','SW7','SW10','W1'],
  SW2:  ['SW4','SW9','SW16','SE24'],
  SW3:  ['SW1','SW7','SW10'],
  SW4:  ['SW2','SW8','SW9','SW12'],
  SW6:  ['SW3','SW5','SW10','SW15','W6'],
  SW8:  ['SW4','SW9','SW11','SW12'],
  SW9:  ['SW2','SW4','SW8','SE5','SE11'],
  SW11: ['SW4','SW6','SW8','SW12'],
  SW12: ['SW2','SW4','SW8','SW11','SW16','SW17'],
  SW15: ['SW6','SW13','SW14','SW18'],
  SW16: ['SW2','SW12','SW17','CR4','SE27'],
  SW17: ['SW12','SW16','SW18','CR4'],
  SW18: ['SW11','SW15','SW17','SW19'],
  SW19: ['SW17','SW18','SW20','CR4'],
  // North London
  N1:   ['N4','N5','N7','EC1','WC1'],
  N4:   ['N1','N5','N8','N15'],
  N5:   ['N1','N4','N7','N16'],
  N7:   ['N1','N5','N19','NW1','NW5'],
  N8:   ['N4','N10','N17','N22'],
  N10:  ['N8','N11','N22'],
  N15:  ['N4','N16','N17'],
  N16:  ['N1','N4','N5','N15'],
  N19:  ['N4','N7','N8','N10'],
  N22:  ['N8','N10','N11','N17'],
  // North West London
  NW1:  ['N7','NW3','NW5','NW8','W1'],
  NW3:  ['NW1','NW5','NW6','NW8'],
  NW5:  ['N7','NW1','NW3'],
  NW6:  ['NW2','NW3','NW8','NW10'],
  NW8:  ['NW1','NW3','NW6','W9'],
  NW10: ['NW2','NW6','W10'],
  // East London
  E1:   ['E2','E3','EC3','SE1'],
  E2:   ['E1','E3','E8','N1'],
  E3:   ['E1','E2','E14','E15'],
  E8:   ['E2','E5','E9','N16'],
  E9:   ['E2','E3','E5','E8'],
  E14:  ['E1','E3','SE8','SE10'],
  E15:  ['E3','E6','E11','E13'],
  // West London
  W1:   ['W2','WC1','WC2','SW1','NW1'],
  W2:   ['W1','W9','W11','NW8'],
  W6:   ['W4','W12','SW6','SW13'],
  W9:   ['W2','W10','NW8'],
  W10:  ['W9','W11','NW10'],
  W11:  ['W2','W10','W12'],
  W12:  ['W6','W11','W14'],
  // Outer London and major cities (sparse coverage)
  BR1:  ['SE6','SE12','SE20','BR2','BR3'],
  CR4:  ['SW16','SW17','SW19','CR0','SM4'],
  // Birmingham
  B1:   ['B2','B3','B4','B5','B12'],
  B2:   ['B1','B3','B4','B5'],
  B15:  ['B1','B5','B16','B17'],
  // Manchester
  M1:   ['M2','M3','M4','M8','M12'],
  M14:  ['M13','M15','M16','M19','M20'],
  M20:  ['M14','M19','M21','M22'],
  // Leeds
  LS1:  ['LS2','LS3','LS4','LS6','LS7'],
  LS6:  ['LS1','LS2','LS5','LS7','LS16'],
  // Edinburgh
  EH1:  ['EH2','EH3','EH6','EH7','EH8'],
  EH3:  ['EH1','EH2','EH4','EH6','EH9'],
};

function getLocalDistricts(district: string): string[] {
  const upper = district.toUpperCase();
  const neighbours = DISTRICT_NEIGHBOURS[upper] ?? [];
  return Array.from(new Set([upper, ...neighbours]));
}

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

interface FeedViewProps {
  onOpenThread: (postId: string) => void;
  onNewPost: () => void;
  onGoToMarket: () => void;
  onOpenListing: (id: string) => void;
}

export default function FeedView({ onOpenThread, onNewPost, onGoToMarket, onOpenListing }: FeedViewProps) {
  const { user, profile } = useAuth();
  const [dbPosts, setDbPosts] = useState<Post[]>([]);
  const [feedListings, setFeedListings] = useState<FeedListing[]>([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [isFirstInArea, setIsFirstInArea] = useState(false);
  const [areaName, setAreaName] = useState('');
  const [copied, setCopied] = useState(false);
  const [menuPostId, setMenuPostId] = useState<string | null>(null);

  const isNewUser = !!(
    profile?.created_at &&
    Date.now() - new Date(profile.created_at).getTime() < 72 * 60 * 60 * 1000 &&
    typeof window !== 'undefined' &&
    !localStorage.getItem(`sprout_welcome_post_seen_${user?.id}`)
  );

  useEffect(() => {
    if (isNewUser && user) {
      localStorage.setItem(`sprout_welcome_post_seen_${user.id}`, 'true');
    }
  }, [isNewUser, user]);

  const loadPosts = useCallback(async () => {
    if (!user) return;

    // Check if user is first in their local area
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('postcode_district, neighborhood')
      .eq('id', user.id)
      .maybeSingle();

    const userDistrict: string = (myProfile as any)?.postcode_district || '';

    if (userDistrict) {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .ilike('postcode_district', `${userDistrict}%`);
      if ((count ?? 0) <= 1) {
        setIsFirstInArea(true);
        setAreaName((myProfile as any).neighborhood || userDistrict);
      }
    }

    // Build the posts query. If the user has a postcode district, filter to
    // their district and immediate neighbours. Fall back to all posts when no
    // district is available (new account, district not yet set).
    let postsQuery = supabase
      .from('posts')
      .select('*, likes(count), reply_count:replies(count)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (userDistrict) {
      const localDistricts = getLocalDistricts(userDistrict);
      // Also include posts with no district set (empty string) so they're visible to everyone
      postsQuery = postsQuery.in('postcode_district', [...localDistricts, '']);
    }

    const { data, error } = await postsQuery;

    if (error || !data) { setLoading(false); return; }

    // Fetch profiles for all post authors
    const authorIds = Array.from(new Set((data as any[]).map(p => p.author_id).filter(Boolean)));
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

    const { data: mySaves } = await supabase
      .from('post_saves')
      .select('post_id')
      .eq('user_id', user.id);

    const likedIds = new Set((myLikes ?? []).map(l => l.post_id));
    const savedIds = new Set((mySaves ?? []).map(s => s.post_id));

    const mapped: Post[] = (data as any[]).map((p) => ({
      id: p.id,
      post_type: p.post_type,
      body: p.body,
      is_anonymous: p.is_anonymous,
      created_at: p.created_at,
      author_id: p.author_id,
      profile: profileMap[p.author_id] ?? null,
      likes: p.likes?.[0]?.count ?? 0,
      comments: p.reply_count?.[0]?.count ?? 0,
      liked: likedIds.has(p.id),
      saved: savedIds.has(p.id),
    }));

    setDbPosts(mapped);

    // Fetch active listings for the local area alongside posts
    let listingsQuery = supabase
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(20);

    if (userDistrict) {
      const localDistricts = getLocalDistricts(userDistrict);
      listingsQuery = listingsQuery.in('postcode_district', localDistricts);
    }

    const { data: listingsData } = await listingsQuery;
    if (listingsData) {
      setFeedListings((listingsData as DbListing[]).map(l => ({
        id: l.id,
        title: l.title,
        price_pence: l.price_pence,
        condition: l.condition,
        category: l.category,
        seller_id: l.seller_id,
        postcode_district: l.postcode_district,
        status: l.status,
        offers_welcome: l.offers_welcome,
        created_at: l.created_at,
      })));
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  async function toggleLike(post: Post) {
    if (!user) return;
    if (post.liked) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', user.id);
    } else {
      await supabase.from('likes').insert({ post_id: post.id, user_id: user.id });
    }
    setDbPosts(prev => prev.map(p =>
      p.id === post.id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p
    ));
  }

  async function toggleSave(post: Post, e: React.MouseEvent) {
    e.stopPropagation();
    if (!user) return;
    if (post.saved) {
      await supabase.from('post_saves').delete().eq('post_id', post.id).eq('user_id', user.id);
    } else {
      await supabase.from('post_saves').insert({ post_id: post.id, user_id: user.id });
    }
    setDbPosts(prev => prev.map(p => p.id === post.id ? { ...p, saved: !p.saved } : p));
  }

  async function deletePost(postId: string) {
    await supabase.from('posts').delete().eq('id', postId);
    setDbPosts(prev => prev.filter(p => p.id !== postId));
    setMenuPostId(null);
  }

  useEffect(() => {
    if (!menuPostId) return;
    const close = () => setMenuPostId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuPostId]);

  function buildInviteMessage() {
    const base = areaName ? `Hey! I've joined Sprout — a community app for parents in ${areaName}.` : "Hey! I've joined Sprout — a community app for local parents.";
    return `${base} Come join and connect with families near you! ${typeof window !== 'undefined' ? window.location.origin : ''}`;
  }

  function copyInvite() {
    navigator.clipboard.writeText(buildInviteMessage()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  async function shareInvite() {
    const msg = buildInviteMessage();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Join Sprout',
          text: msg,
          url: typeof window !== 'undefined' ? window.location.origin : '',
        });
        return;
      } catch {
        // user cancelled or API unavailable — fall through to copy
      }
    }
    copyInvite();
  }

  const filters = ['All', 'Questions', 'Meetups', 'Market', 'Support'];

  // Build a unified feed combining posts and listings, sorted by created_at desc
  const feedItems: FeedItem[] = (() => {
    if (activeFilter === 'Market') {
      return feedListings.map(l => ({ kind: 'listing' as const, data: l }));
    }
    if (activeFilter !== 'All') {
      const typeMap: Record<string, string> = { Questions: 'question', Support: 'support', Meetups: 'meetup' };
      return dbPosts
        .filter(p => p.post_type === typeMap[activeFilter])
        .map(p => ({ kind: 'post' as const, data: p }));
    }
    // 'All': merge posts and active listings, sort by created_at
    const postItems: FeedItem[] = dbPosts.map(p => ({ kind: 'post' as const, data: p }));
    const listingItems: FeedItem[] = feedListings.map(l => ({ kind: 'listing' as const, data: l }));
    return [...postItems, ...listingItems].sort((a, b) =>
      new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime()
    );
  })();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 lg:pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#2a1f18' }}>Community Feed</h1>
          <p className="text-sm" style={{ color: '#9a8070' }}>What&apos;s happening near you</p>
        </div>
        <button className="btn-brand text-sm lg:hidden" onClick={onNewPost}>+ Post</button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-5 -mx-4 px-4">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className="flex-shrink-0 text-sm font-medium px-4 py-1.5 rounded-full transition-all"
            style={{
              background: activeFilter === f ? 'var(--brand)' : 'white',
              color: activeFilter === f ? 'white' : '#7a6055',
              border: `1px solid ${activeFilter === f ? 'var(--brand)' : 'var(--border-color)'}`,
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && (
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
      )}

      {/* Market filter header */}
      {!loading && activeFilter === 'Market' && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium" style={{ color: '#9a8070' }}>
            {feedListings.length} item{feedListings.length !== 1 ? 's' : ''} in the marketplace
          </p>
          <button onClick={onGoToMarket} className="text-sm font-semibold" style={{ color: 'var(--brand)' }}>
            Browse all →
          </button>
        </div>
      )}

      {/* Unified feed */}
      {!loading && (
        <div className="space-y-4">
          {/* Sprout welcome post — shown for new users in their first 72h */}
          {isNewUser && activeFilter === 'All' && (
            <article className="card-sprout overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand)' }}>
                      <Leaf className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#2a1f18' }}>Sprout</p>
                      <p className="text-xs" style={{ color: '#9a8070' }}>just now</p>
                    </div>
                  </div>
                  <span className="tag-sprout" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>Welcome</span>
                </div>
                <p className="text-sm font-semibold mb-1.5" style={{ color: '#2a1f18' }}>
                  Welcome to Sprout{profile?.first_name ? `, ${profile.first_name}` : ''}!
                </p>
                <p className="text-sm leading-relaxed" style={{ color: '#3a2820', lineHeight: 1.6 }}>
                  We&apos;re so glad you&apos;re here. This is your community feed — a place to ask questions, share tips, find meetups, and support other parents nearby. Dive in and say hello!
                </p>
              </div>
            </article>
          )}

          {/* Empty state */}
          {feedItems.length === 0 && (
            <div className="flex flex-col items-center text-center py-14">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: activeFilter === 'Market' ? '#FFF7ED' : 'var(--brand-light)' }}>
                {activeFilter === 'Market'
                  ? <ShoppingBag className="w-7 h-7" style={{ color: '#D97706' }} />
                  : <MessageCircle className="w-7 h-7" style={{ color: 'var(--brand)' }} />
                }
              </div>
              <p className="text-base font-semibold mb-1" style={{ color: '#2a1f18' }}>
                {activeFilter === 'Market' ? 'No items listed nearby yet' : 'Nothing here yet'}
              </p>
              <p className="text-sm mb-5" style={{ color: '#9a8070' }}>
                {activeFilter === 'Market'
                  ? 'Be the first to list something in the marketplace.'
                  : activeFilter === 'All'
                    ? 'Be the first to post something for your community.'
                    : `No ${activeFilter.toLowerCase()} posts yet. Try a different filter or be the first!`}
              </p>
              {activeFilter === 'Market'
                ? <button onClick={onGoToMarket} className="btn-brand text-sm">+ List an Item</button>
                : <button onClick={onNewPost} className="btn-brand text-sm">+ Share something</button>
              }
            </div>
          )}

          {/* Feed items — posts and listings merged */}
          {feedItems.map((item) => {
            if (item.kind === 'listing') {
              const listing = item.data;
              const isSold = listing.status === 'sold';
              const priceInPounds = listing.price_pence / 100;
              const catStyle = getCategoryStyle(listing.category);
              const CategoryIcon = CATEGORY_ICONS[listing.category] ?? ShoppingBag;
              return (
                <article
                  key={`listing-${listing.id}`}
                  className="card-sprout overflow-hidden cursor-pointer hover:shadow-md transition-shadow flex"
                  onClick={() => onOpenListing(listing.id)}
                >
                  <div className="relative flex-shrink-0 w-28 sm:w-36" style={{ minHeight: 96 }}>
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1" style={{ minHeight: 96, background: catStyle.bg }}>
                      <CategoryIcon className="w-8 h-8" style={{ color: catStyle.color, opacity: 0.8 }} />
                      <span className="text-xs font-medium" style={{ color: catStyle.color }}>{listing.category}</span>
                    </div>
                    {isSold && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.35)' }}>
                        <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full" style={{ background: '#374151' }}>Sold</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-semibold leading-tight" style={{ color: isSold ? '#9a8070' : '#2a1f18' }}>{listing.title}</p>
                        <span className="tag-sprout flex-shrink-0" style={{ background: '#FFF7ED', color: '#D97706' }}>Market</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: '#f4f3f0', color: '#5a4035' }}>{listing.condition}</span>
                        <span className="text-xs" style={{ color: '#9a8070' }}>{listing.category}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold" style={{ color: isSold ? '#9a8070' : (priceInPounds === 0 ? '#16a34a' : 'var(--brand)') }}>
                        {priceInPounds === 0 ? 'Free' : `£${priceInPounds.toFixed(2)}`}
                      </span>
                      <div className="flex items-center gap-1 text-xs" style={{ color: '#9a8070' }}>
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate max-w-[120px]">{formatLocation(listing.postcode_district)}</span>
                        <span>· {formatRelativeTime(listing.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            }

            const post = item.data;
            const typeInfo = TYPE_COLORS[post.post_type] ?? TYPE_COLORS.question;
            const authorName = post.is_anonymous ? 'Anonymous Parent' : (post.profile?.name || 'Community Member');
            const authorAvatar = post.is_anonymous ? '' : (post.profile?.avatar_url || '');
            const authorLocation = post.profile?.postcode_district
              ? formatLocation(post.profile.postcode_district)
              : (post.profile?.neighborhood || '');
            const timeAgo = formatRelativeTime(post.created_at);

            return (
              <article key={`post-${post.id}`} className="card-sprout overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => onOpenThread(post.id)}>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      {post.is_anonymous || !authorAvatar ? (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                          style={post.is_anonymous
                            ? { background: '#EFF4FF', color: '#2563EB' }
                            : { background: 'var(--brand-light)', color: 'var(--brand)' }
                          }
                        >
                          {post.is_anonymous ? '?' : authorName.charAt(0)}
                        </div>
                      ) : (
                        <img src={authorAvatar} alt={authorName} className="w-10 h-10 rounded-full object-cover" />
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
                      <span className="tag-sprout" style={{ background: typeInfo.bg, color: typeInfo.text }}>{typeInfo.label}</span>
                      {post.author_id === user?.id && (
                        <div className="relative" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setMenuPostId(menuPostId === post.id ? null : post.id)}
                            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-orange-50"
                            style={{ color: '#c4a090' }}
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {menuPostId === post.id && (
                            <div
                              className="absolute right-0 top-8 z-20 rounded-xl shadow-lg border overflow-hidden"
                              style={{ background: 'white', borderColor: 'var(--border-color)', minWidth: 140 }}
                            >
                              <button
                                onClick={() => deletePost(post.id)}
                                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-left transition-colors hover:bg-red-50"
                                style={{ color: '#E53E3E' }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete post
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-sm leading-relaxed mb-3" style={{ color: '#3a2820', lineHeight: 1.6 }}>{post.body}</p>
                </div>

                <div className="flex items-center border-t px-4 py-2.5" style={{ borderColor: 'var(--border-color)' }} onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => toggleLike(post)}
                    className="flex items-center gap-1.5 text-sm mr-5 transition-colors"
                    style={{ color: post.liked ? '#E53E3E' : '#9a8070' }}
                  >
                    <Heart className="w-4 h-4" fill={post.liked ? '#E53E3E' : 'none'} />
                    {post.likes}
                  </button>
                  <button
                    onClick={() => onOpenThread(post.id)}
                    className="flex items-center gap-1.5 text-sm mr-5"
                    style={{ color: '#9a8070' }}
                  >
                    <MessageCircle className="w-4 h-4" />
                    {post.comments}
                  </button>
                  <button className="flex items-center gap-1.5 text-sm ml-auto" style={{ color: post.saved ? 'var(--brand)' : '#9a8070' }} onClick={(e) => toggleSave(post, e)}>
                    <Bookmark className="w-4 h-4" fill={post.saved ? 'var(--brand)' : 'none'} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* First-in-area welcome post — sits at the bottom as the seed post */}
      {isFirstInArea && !loading && activeFilter !== 'Market' && (
        <article className="card-sprout overflow-hidden mb-4 mt-4">
          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand)' }}>
                  <Leaf className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#2a1f18' }}>Sprout</p>
                  <div className="flex items-center gap-1 text-xs" style={{ color: '#9a8070' }}>
                    <MapPin className="w-3 h-3" />{areaName} · just now
                  </div>
                </div>
              </div>
              <span className="tag-sprout" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>Welcome</span>
            </div>

            <p className="text-sm font-semibold mb-1.5" style={{ color: '#2a1f18' }}>
              You&apos;re the first Sprout parent in {areaName}!
            </p>
            <p className="text-sm leading-relaxed mb-3" style={{ color: '#3a2820', lineHeight: 1.6 }}>
              You&apos;ve planted the seed for your local community. Sprout gets better the more parents join — so share it with families nearby and help build something great together.
            </p>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {['Community', 'LocalParents', 'ShareSprout'].map(tag => (
                <span key={tag} className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#f4f3f0', color: '#7a6055' }}>#{tag}</span>
              ))}
            </div>
          </div>

          <div className="flex items-center border-t px-4 py-2.5" style={{ borderColor: 'var(--border-color)' }}>
            <button
              onClick={copyInvite}
              className="flex items-center gap-1.5 text-sm mr-5 transition-colors font-medium"
              style={{ color: copied ? 'var(--brand)' : '#9a8070' }}
            >
              {copied ? <CheckIcon className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy invite'}
            </button>
            <button
              onClick={shareInvite}
              className="flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: '#9a8070' }}
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </article>
      )}
    </div>
  );
}
