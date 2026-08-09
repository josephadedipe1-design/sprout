'use client';

import { useState, useEffect, useCallback } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, MapPin, Leaf, Copy, Check as CheckIcon, ShoppingBag, Tag, Car, Moon, Gamepad2, Package, Utensils, Home, BookOpen, Box, Trash2, Loader2, Send, Flag } from 'lucide-react';
import { renderAnnouncementMarkdown } from '@/lib/announcement-markdown';
// Share2 kept for the first-in-area invite card only
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { sendNotificationEmail, truncatePreview } from '@/lib/notifications';
import type { DbProfile, DbListing } from '@/lib/types';
import { getCategoryStyle, formatLocation, formatName, haversineKm, kmToMiles, objectPosition } from '@/lib/utils';
import ReportModal, { type ReportTarget } from '@/components/sprout/ReportModal';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Travel: Car, Sleep: Moon, Clothing: Tag, Toys: Gamepad2,
  Gear: Package, Feeding: Utensils, Furniture: Home, Education: BookOpen, Miscellaneous: Box,
};

interface Post {
  id: string;
  post_type: string;
  body: string;
  created_at: string;
  author_id: string;
  profile: DbProfile | null;
  is_official: boolean;
  image_url: string | null;
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
  seller_first_name: string;
  seller_last_initial: string;
  seller_avatar: string;
  seller_postcode_district: string;
  image_url: string;
}

type FeedItem =
  | { kind: 'post'; data: Post }
  | { kind: 'listing'; data: FeedListing };

interface ReplyItem {
  id: string;
  body: string;
  created_at: string;
  author_first_name: string;
  author_last_initial?: string | null;
  author_avatar: string;
}

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
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [repliesMap, setRepliesMap] = useState<Record<string, ReplyItem[]>>({});
  const [repliesLoadingMap, setRepliesLoadingMap] = useState<Record<string, boolean>>({});
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [replySubmittingMap, setReplySubmittingMap] = useState<Record<string, boolean>>({});
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

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

    // Fetch my profile for lat/lng
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('lat, lng, postcode_district')
      .eq('id', user.id)
      .maybeSingle();

    const myLat = (myProfile as any)?.lat as number | null;
    const myLng = (myProfile as any)?.lng as number | null;
    const userDistrict: string = (myProfile as any)?.postcode_district || '';

    if (userDistrict) {
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .ilike('postcode_district', `${userDistrict}%`);
      if ((count ?? 0) <= 1) {
        setIsFirstInArea(true);
        setAreaName(userDistrict);
      }
    }

    const { data, error } = await supabase
      .from('posts')
      .select('*, likes(count), reply_count:replies(count)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) { setLoading(false); return; }

    // Fetch profiles for all post authors (need lat/lng for distance filtering)
    const authorIds = Array.from(new Set((data as any[]).map(p => p.author_id).filter(Boolean)));
    const profileMap: Record<string, DbProfile> = {};
    if (authorIds.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('*')
        .in('id', authorIds);
      (profileRows ?? []).forEach((p: DbProfile) => { profileMap[p.id] = p; });
    }

    // Filter posts to 10-mile radius using haversine distance
    const FEED_RADIUS_MILES = 10;
    const filteredData = (data as any[]).filter(p => {
      // Official Sprout Team posts bypass the radius filter — visible to all
      if (p.is_official) return true;
      // Always show own posts
      if (p.author_id === user.id) return true;
      // If we don't have user location, fall back to showing all
      if (!myLat || !myLng) return true;
      const authorProfile = profileMap[p.author_id];
      if (!authorProfile?.lat || !authorProfile?.lng) return false;
      const distMiles = kmToMiles(haversineKm(myLat, myLng, authorProfile.lat, authorProfile.lng));
      return distMiles <= FEED_RADIUS_MILES;
    });

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

    const mapped: Post[] = filteredData.map((p) => ({
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
      liked: likedIds.has(p.id),
      saved: savedIds.has(p.id),
    }));

    setDbPosts(mapped);

    // Fetch active listings for the local area (10-mile radius)
    const { data: listingsData } = await supabase
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(50);

    if (listingsData) {
      const sellerIds = Array.from(new Set((listingsData as DbListing[]).map(l => l.seller_id).filter(Boolean)));
      const sellerProfileMap: Record<string, { first_name: string; last_initial: string; avatar_url: string; avatar_position_x?: number; avatar_position_y?: number; postcode_district: string; lat: number | null; lng: number | null }> = {};
      if (sellerIds.length > 0) {
        const { data: sellerRows } = await supabase
          .from('profiles')
          .select('id, first_name, last_initial, avatar_url, avatar_position_x, avatar_position_y, postcode_district, lat, lng')
          .in('id', sellerIds);
        (sellerRows ?? []).forEach((p: any) => { sellerProfileMap[p.id] = p; });
      }

      // Filter listings by 10-mile radius
      const FEED_RADIUS_MILES = 10;
      const filteredListings = (listingsData as DbListing[]).filter(l => {
        if (l.seller_id === user.id) return true;
        if (!myLat || !myLng) return true;
        const seller = sellerProfileMap[l.seller_id];
        if (!seller?.lat || !seller?.lng) return false;
        const distMiles = kmToMiles(haversineKm(myLat, myLng, seller.lat, seller.lng));
        return distMiles <= FEED_RADIUS_MILES;
      });

      const listingIds = filteredListings.map(l => l.id);
      const imageMap: Record<string, string> = {};
      const imagePosMap: Record<string, { x: number; y: number }> = {};
      if (listingIds.length > 0) {
        const { data: imageRows } = await supabase
          .from('listing_images')
          .select('listing_id, url, position, position_x, position_y')
          .in('listing_id', listingIds)
          .order('position', { ascending: true });
        (imageRows ?? []).forEach((img: any) => {
          if (!imageMap[img.listing_id]) {
            imageMap[img.listing_id] = img.url;
            imagePosMap[img.listing_id] = { x: img.position_x ?? 50, y: img.position_y ?? 50 };
          }
        });
      }
      setFeedListings(filteredListings.map(l => ({
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
        seller_first_name: sellerProfileMap[l.seller_id]?.first_name || 'Community Member',
        seller_last_initial: sellerProfileMap[l.seller_id]?.last_initial || '',
        seller_avatar: sellerProfileMap[l.seller_id]?.avatar_url || '',
        seller_avatar_pos_x: sellerProfileMap[l.seller_id]?.avatar_position_x,
        seller_avatar_pos_y: sellerProfileMap[l.seller_id]?.avatar_position_y,
        seller_postcode_district: sellerProfileMap[l.seller_id]?.postcode_district || l.postcode_district,
        image_url: imageMap[l.id] || '',
        image_pos_x: imagePosMap[l.id]?.x,
        image_pos_y: imagePosMap[l.id]?.y,
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

      if (post.author_id && post.author_id !== user.id) {
        const likerName = profile?.first_name
          ? (profile.last_initial ? `${profile.first_name} ${profile.last_initial}.` : profile.first_name)
          : 'Someone';
        sendNotificationEmail({
          type: 'like',
          recipientUserId: post.author_id,
          emailData: {
            actorUserId: user.id,
            likerName,
            postPreview: truncatePreview(post.body),
          },
        });
      }
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

  async function toggleReplies(postId: string) {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
      return;
    }
    setExpandedPostId(postId);
    if (repliesMap[postId]) return;
    setRepliesLoadingMap(prev => ({ ...prev, [postId]: true }));
    const { data: replyRows } = await supabase
      .from('replies')
      .select('id, body, created_at, author_id')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    const authorIds = Array.from(new Set((replyRows ?? []).map((r: any) => r.author_id)));
    const profileMap: Record<string, { first_name: string; avatar_url: string; avatar_position_x?: number; avatar_position_y?: number }> = {};
    if (authorIds.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, first_name, avatar_url, avatar_position_x, avatar_position_y')
        .in('id', authorIds);
      (profileRows ?? []).forEach((p: any) => { profileMap[p.id] = p; });
    }
    const items: ReplyItem[] = (replyRows ?? []).map((r: any) => ({
      id: r.id,
      body: r.body,
      created_at: r.created_at,
      author_first_name: profileMap[r.author_id]?.first_name || 'Community Member',
      author_last_initial: profileMap[r.author_id]?.last_initial,
      author_avatar: profileMap[r.author_id]?.avatar_url || '',
      author_avatar_pos_x: profileMap[r.author_id]?.avatar_position_x,
      author_avatar_pos_y: profileMap[r.author_id]?.avatar_position_y,
    }));
    setRepliesMap(prev => ({ ...prev, [postId]: items }));
    setRepliesLoadingMap(prev => ({ ...prev, [postId]: false }));
  }

  async function submitInlineReply(postId: string) {
    const text = (replyTextMap[postId] || '').trim();
    if (!text || !user || replySubmittingMap[postId]) return;
    setReplySubmittingMap(prev => ({ ...prev, [postId]: true }));
    const { error } = await supabase.from('replies').insert({ post_id: postId, author_id: user.id, body: text });
    if (!error) {
      const post = dbPosts.find(p => p.id === postId);
      if (post?.author_id && post.author_id !== user.id) {
        const replierName = profile?.first_name
          ? (profile.last_initial ? `${profile.first_name} ${profile.last_initial}.` : profile.first_name)
          : 'Someone';
        sendNotificationEmail({
          type: 'reply',
          recipientUserId: post.author_id,
          emailData: {
            actorUserId: user.id,
            replierName,
            replyPreview: truncatePreview(text),
            postPreview: truncatePreview(post.body),
          },
        });
      }
      const newReply: ReplyItem = {
        id: crypto.randomUUID(),
        body: text,
        created_at: new Date().toISOString(),
        author_first_name: profile?.first_name || 'You',
        author_last_initial: profile?.last_initial,
        author_avatar: profile?.avatar_url || '',
      };
      setRepliesMap(prev => ({ ...prev, [postId]: [...(prev[postId] ?? []), newReply] }));
      setReplyTextMap(prev => ({ ...prev, [postId]: '' }));
      setDbPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: p.comments + 1 } : p));
    }
    setReplySubmittingMap(prev => ({ ...prev, [postId]: false }));
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
          {/* General welcome post — shown for new users in their first 72h who are NOT the first in their area */}
          {isNewUser && !isFirstInArea && activeFilter === 'All' && (
            <article className="card-sprout overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand)' }}>
                      <Leaf className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#2a1f18' }}>Sprout</p>
                      <div className="flex items-center gap-1 text-xs" style={{ color: '#9a8070' }}>
                        {areaName && <><MapPin className="w-3 h-3" />{areaName} · </>}
                        just now
                      </div>
                    </div>
                  </div>
                  <span className="tag-sprout" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>Welcome</span>
                </div>

                <p className="text-sm font-semibold mb-1.5" style={{ color: '#2a1f18' }}>
                  Welcome to Sprout{areaName ? `, ${areaName}` : profile?.first_name ? `, ${profile.first_name}` : ''}!
                </p>
                <p className="text-sm leading-relaxed mb-3" style={{ color: '#3a2820', lineHeight: 1.6 }}>
                  You&apos;ve joined parents near you on Sprout. Say hello, browse the marketplace, or share what&apos;s on your mind.
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
                  className="card-sprout overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => onOpenListing(listing.id)}
                >
                  {/* Seller header */}
                  <div className="flex items-center gap-2.5 p-4 pb-3">
                    {listing.seller_avatar ? (
                      <img src={listing.seller_avatar} alt={listing.seller_first_name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" style={{ objectPosition: objectPosition((listing as any).seller_avatar_pos_x, (listing as any).seller_avatar_pos_y) }} />
                    ) : (
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: 'var(--brand)' }}>
                        {listing.seller_first_name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: '#2a1f18' }}>{formatName(listing.seller_first_name, listing.seller_last_initial)}</p>
                      <div className="flex items-center gap-1 text-xs" style={{ color: '#9a8070' }}>
                        {listing.seller_postcode_district && <><MapPin className="w-3 h-3" />{formatLocation(listing.seller_postcode_district)} · </>}
                        {formatRelativeTime(listing.created_at)}
                      </div>
                    </div>
                    <span className="tag-sprout flex-shrink-0" style={{ background: '#FFF7ED', color: '#D97706' }}>Market</span>
                  </div>

                  {/* Listing image or icon */}
                  {listing.image_url ? (
                    <img src={listing.image_url} alt={listing.title} className={`w-full h-48 object-cover ${isSold ? 'opacity-60' : ''}`} style={{ objectPosition: objectPosition((listing as any).image_pos_x, (listing as any).image_pos_y) }} />
                  ) : (
                    <div className="w-full h-32 flex flex-col items-center justify-center gap-2" style={{ background: catStyle.bg, opacity: isSold ? 0.6 : 1 }}>
                      <CategoryIcon className="w-10 h-10" style={{ color: catStyle.color, opacity: 0.8 }} />
                      <span className="text-xs font-medium" style={{ color: catStyle.color }}>{listing.category}</span>
                    </div>
                  )}

                  {/* Listing details */}
                  <div className="p-4 pt-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold leading-tight" style={{ color: isSold ? '#9a8070' : '#2a1f18' }}>{listing.title}</p>
                      <span className="text-base font-bold flex-shrink-0" style={{ color: isSold ? '#9a8070' : (priceInPounds === 0 ? '#16a34a' : 'var(--brand)') }}>
                        {priceInPounds === 0 ? 'Free' : `£${priceInPounds.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: '#f4f3f0', color: '#5a4035' }}>{listing.condition}</span>
                      <span className="text-xs" style={{ color: '#9a8070' }}>{listing.category}</span>
                      {isSold && <span className="text-xs font-bold px-2 py-0.5 rounded-full ml-auto" style={{ background: '#374151', color: 'white' }}>Sold</span>}
                    </div>
                  </div>
                </article>
              );
            }

            const post = item.data;
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
              <article key={`post-${post.id}`} className="card-sprout overflow-hidden">
                <div className="p-4 cursor-pointer hover:bg-orange-50/30 transition-colors" onClick={() => toggleReplies(post.id)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      {isOfficial ? (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand)' }}>
                          <Leaf className="w-5 h-5 text-white" />
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
                            {post.author_id === user?.id ? (
                              <button
                                onClick={() => deletePost(post.id)}
                                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-left transition-colors hover:bg-red-50"
                                style={{ color: '#E53E3E' }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete post
                              </button>
                            ) : (
                              <button
                                onClick={() => { setReportTarget({ type: 'post', postId: post.id, userId: post.author_id }); setMenuPostId(null); }}
                                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-left transition-colors hover:bg-orange-50"
                                style={{ color: '#7a6055' }}
                              >
                                <Flag className="w-3.5 h-3.5" />
                                Report post
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {isOfficial ? (
                    <div
                      className="text-sm leading-relaxed mb-3 announcement-body"
                      style={{ color: '#3a2820', lineHeight: 1.6 }}
                      dangerouslySetInnerHTML={{ __html: renderAnnouncementMarkdown(post.body) }}
                    />
                  ) : (
                    <p className="text-sm leading-relaxed mb-3" style={{ color: '#3a2820', lineHeight: 1.6 }}>{post.body}</p>
                  )}
                  {post.image_url && (
                    <img
                      src={post.image_url}
                      alt="Announcement image"
                      className="w-full rounded-xl mb-3 object-cover"
                      style={{ maxHeight: 400, border: '1px solid var(--border-color)' }}
                    />
                  )}
                </div>

                <div className="flex items-center border-t px-4 py-2.5" style={{ borderColor: 'var(--border-color)' }}>
                  <button
                    onClick={() => toggleLike(post)}
                    className="flex items-center gap-1.5 text-sm mr-5 transition-colors"
                    style={{ color: post.liked ? '#E53E3E' : '#9a8070' }}
                  >
                    <Heart className="w-4 h-4" fill={post.liked ? '#E53E3E' : 'none'} />
                    {post.likes}
                  </button>
                  <button
                    onClick={() => toggleReplies(post.id)}
                    className="flex items-center gap-1.5 text-sm mr-5 transition-colors"
                    style={{ color: expandedPostId === post.id ? 'var(--brand)' : '#9a8070' }}
                  >
                    <MessageCircle className="w-4 h-4" />
                    {post.comments}
                  </button>
                  <button className="flex items-center gap-1.5 text-sm ml-auto" style={{ color: post.saved ? 'var(--brand)' : '#9a8070' }} onClick={(e) => toggleSave(post, e)}>
                    <Bookmark className="w-4 h-4" fill={post.saved ? 'var(--brand)' : 'none'} />
                  </button>
                </div>

                {expandedPostId === post.id && (
                  <div className="border-t px-4 py-3" style={{ borderColor: 'var(--border-color)', background: '#faf9f7' }}>
                    {repliesLoadingMap[post.id] ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--brand)' }} />
                      </div>
                    ) : (
                      <>
                        {(repliesMap[post.id] ?? []).length === 0 ? (
                          <p className="text-xs text-center py-2" style={{ color: '#9a8070' }}>No replies yet. Be the first!</p>
                        ) : (
                          <div className="space-y-3 mb-3">
                            {(repliesMap[post.id] ?? []).map(r => (
                              <div key={r.id} className="flex gap-2">
                                {r.author_avatar ? (
                                  <img src={r.author_avatar} alt={r.author_first_name} className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-0.5" style={{ objectPosition: objectPosition((r as any).author_avatar_pos_x, (r as any).author_avatar_pos_y) }} />
                                ) : (
                                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5" style={{ background: 'var(--brand)' }}>
                                    {r.author_first_name.charAt(0)}
                                  </div>
                                )}
                                <div className="flex-1 rounded-xl px-3 py-2" style={{ background: 'white', border: '1px solid var(--border-color)' }}>
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-xs font-semibold" style={{ color: '#2a1f18' }}>{r.author_last_initial ? `${r.author_first_name} ${r.author_last_initial}.` : r.author_first_name}</span>
                                    <span className="text-xs" style={{ color: '#c4a090' }}>{formatRelativeTime(r.created_at)}</span>
                                  </div>
                                  <p className="text-sm leading-relaxed" style={{ color: '#3a2820' }}>{r.body}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="Me" className="w-7 h-7 rounded-full object-cover flex-shrink-0" style={{ objectPosition: objectPosition(profile?.avatar_position_x, profile?.avatar_position_y) }} />
                          ) : (
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: 'var(--brand)' }}>
                              {(profile?.first_name ?? 'Y').charAt(0)}
                            </div>
                          )}
                          <input
                            className="input-sprout flex-1 text-sm py-2"
                            placeholder="Add a reply…"
                            value={replyTextMap[post.id] ?? ''}
                            onChange={e => setReplyTextMap(prev => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submitInlineReply(post.id)}
                          />
                          <button
                            onClick={() => submitInlineReply(post.id)}
                            disabled={!(replyTextMap[post.id] ?? '').trim() || replySubmittingMap[post.id]}
                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity"
                            style={{ background: 'var(--brand)', opacity: (replyTextMap[post.id] ?? '').trim() && !replySubmittingMap[post.id] ? 1 : 0.4 }}
                          >
                            {replySubmittingMap[post.id]
                              ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                              : <Send className="w-3.5 h-3.5 text-white" />
                            }
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
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
      <ReportModal target={reportTarget} open={!!reportTarget} onClose={() => setReportTarget(null)} />
    </div>
  );
}
