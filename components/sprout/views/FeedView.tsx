'use client';

import { useState, useEffect, useCallback } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, MapPin, Leaf, Copy, Check as CheckIcon, ShoppingBag, Tag, Car, Moon, Gamepad2, Package, Utensils, Home, BookOpen, Box, Trash2 } from 'lucide-react';
// Share2 kept for the first-in-area invite card only
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { DbProfile, DbListing } from '@/lib/types';
import { getCategoryStyle } from '@/lib/utils';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Travel: Car, Sleep: Moon, Clothing: Tag, Toys: Gamepad2,
  Gear: Package, Feeding: Utensils, Furniture: Home, Education: BookOpen, Miscellaneous: Box,
};

interface Post {
  id: string;
  type: string;
  content: string;
  tags: string[];
  anonymous: boolean;
  created_at: string;
  user_id: string;
  profile: DbProfile | null;
  likes: number;
  comments: number;
  liked: boolean;
  saved: boolean;
}

interface FeedListing {
  id: string;
  title: string;
  price: number;
  condition: string;
  category: string;
  image_url: string;
  sold: boolean;
  created_at: string;
  user_id: string;
  sellerName: string;
  neighborhood: string;
}

const TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  question: { bg: '#FFF5EF', text: '#7D3C1A', label: 'Question' },
  support:  { bg: '#EFF4FF', text: '#2563EB', label: 'Support' },
  meetup:   { bg: '#ECFDF5', text: '#059669', label: 'Meetup' },
  market:   { bg: '#FFF7ED', text: '#D97706', label: 'Market' },
  tip:      { bg: '#F0FDF4', text: '#16A34A', label: 'Tip' },
  listing:  { bg: '#FFF7ED', text: '#D97706', label: 'Market' },
};

const PLACEHOLDER_IMG = 'https://images.pexels.com/photos/1148998/pexels-photo-1148998.jpeg';

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
  const { user } = useAuth();
  const [dbPosts, setDbPosts] = useState<Post[]>([]);
  const [feedListings, setFeedListings] = useState<FeedListing[]>([]);
  const [listingsLoaded, setListingsLoaded] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [isFirstInArea, setIsFirstInArea] = useState(false);
  const [areaName, setAreaName] = useState('');
  const [copied, setCopied] = useState(false);
  const [menuPostId, setMenuPostId] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    if (!user) return;

    // Check if user is first in their local area
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('postcode, neighborhood')
      .eq('id', user.id)
      .maybeSingle();

    if (myProfile?.postcode) {
      const prefix = myProfile.postcode.trim().split(/\s/)[0].toUpperCase();
      const { count } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .ilike('postcode', `${prefix}%`);
      if ((count ?? 0) <= 1) {
        setIsFirstInArea(true);
        setAreaName(myProfile.neighborhood || prefix);
      }
    }

    const { data, error } = await supabase
      .from('posts')
      .select('*, post_likes(count), comment_count:comments(count)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) { setLoading(false); return; }

    // Fetch profiles for all post authors
    const userIds = Array.from(new Set((data as any[]).map(p => p.user_id).filter(Boolean)));
    const profileMap: Record<string, DbProfile> = {};
    if (userIds.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);
      (profileRows ?? []).forEach((p: DbProfile) => { profileMap[p.id] = p; });
    }

    const { data: myLikes } = await supabase
      .from('post_likes')
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
      type: p.type,
      content: p.content,
      tags: p.tags ?? [],
      anonymous: p.anonymous,
      created_at: p.created_at,
      user_id: p.user_id,
      profile: profileMap[p.user_id] ?? null,
      likes: p.post_likes?.[0]?.count ?? 0,
      comments: p.comment_count?.[0]?.count ?? 0,
      liked: likedIds.has(p.id),
      saved: savedIds.has(p.id),
    }));

    setDbPosts(mapped);
    setLoading(false);
  }, [user]);

  const loadListings = useCallback(async () => {
    if (!user || listingsLoaded) return;
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) return;

    const userIds = Array.from(new Set((data as any[]).map((l: any) => l.user_id).filter(Boolean)));
    const profileMap: Record<string, { name: string; neighborhood: string }> = {};
    if (userIds.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, name, neighborhood')
        .in('id', userIds);
      (profileRows ?? []).forEach((p: any) => { profileMap[p.id] = p; });
    }

    const mapped: FeedListing[] = (data as DbListing[]).map(l => ({
      id: l.id,
      title: l.title,
      price: l.price,
      condition: l.condition,
      category: l.category,
      image_url: l.image_url,
      sold: l.sold,
      created_at: l.created_at,
      user_id: l.user_id,
      sellerName: profileMap[l.user_id]?.name || 'Community Member',
      neighborhood: profileMap[l.user_id]?.neighborhood || '',
    }));

    setFeedListings(mapped);
    setListingsLoaded(true);
  }, [user, listingsLoaded]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  useEffect(() => {
    if (activeFilter === 'Market') loadListings();
  }, [activeFilter, loadListings]);

  async function toggleLike(post: Post) {
    if (!user) return;
    if (post.liked) {
      await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id);
    } else {
      await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id });
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

  const filters = ['All', 'Questions', 'Meetups', 'Market', 'Support'];
  const filtered = activeFilter === 'All' ? dbPosts : dbPosts.filter((p) => {
    const map: Record<string, string> = { Questions: 'question', Support: 'support', Meetups: 'meetup', Market: 'market' };
    return p.type === map[activeFilter];
  });

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
      {loading && dbPosts.length === 0 && activeFilter !== 'Market' && (
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

      {/* Market listings view */}
      {activeFilter === 'Market' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium" style={{ color: '#9a8070' }}>
              {feedListings.length} item{feedListings.length !== 1 ? 's' : ''} in the marketplace
            </p>
            <button onClick={onGoToMarket} className="text-sm font-semibold" style={{ color: 'var(--brand)' }}>
              Browse all →
            </button>
          </div>

          {feedListings.length === 0 && listingsLoaded && (
            <div className="flex flex-col items-center text-center py-14">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: '#FFF7ED' }}>
                <ShoppingBag className="w-7 h-7" style={{ color: '#D97706' }} />
              </div>
              <p className="text-base font-semibold mb-1" style={{ color: '#2a1f18' }}>No items listed yet</p>
              <p className="text-sm mb-5" style={{ color: '#9a8070' }}>Be the first to list something in the marketplace.</p>
              <button onClick={onGoToMarket} className="btn-brand text-sm">+ List an Item</button>
            </div>
          )}

          {feedListings.map((listing) => (
            <article
              key={listing.id}
              className="card-sprout overflow-hidden cursor-pointer hover:shadow-md transition-shadow flex"
              onClick={() => onOpenListing(listing.id)}
            >
              {(() => {
                const showIcon = !listing.image_url || listing.image_url.includes('1148998');
                const catStyle = getCategoryStyle(listing.category);
                const CategoryIcon = CATEGORY_ICONS[listing.category] ?? ShoppingBag;
                return (
                  <div className="relative flex-shrink-0 w-28 sm:w-36" style={{ minHeight: 96 }}>
                    {showIcon ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1" style={{ minHeight: 96, background: catStyle.bg }}>
                        <CategoryIcon className="w-8 h-8" style={{ color: catStyle.color, opacity: 0.8 }} />
                        <span className="text-xs font-medium" style={{ color: catStyle.color }}>{listing.category}</span>
                      </div>
                    ) : (
                      <img
                        src={listing.image_url}
                        alt={listing.title}
                        className={`w-full h-full object-cover ${listing.sold ? 'opacity-60' : ''}`}
                        style={{ minHeight: 96 }}
                      />
                    )}
                    {listing.sold && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.35)' }}>
                        <span className="text-xs font-bold text-white px-2 py-0.5 rounded-full" style={{ background: '#374151' }}>Sold</span>
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold leading-tight" style={{ color: listing.sold ? '#9a8070' : '#2a1f18' }}>{listing.title}</p>
                    <span className="tag-sprout flex-shrink-0" style={{ background: '#FFF7ED', color: '#D97706' }}>Market</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: '#f4f3f0', color: '#5a4035' }}>{listing.condition}</span>
                    <span className="text-xs" style={{ color: '#9a8070' }}>{listing.category}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold" style={{ color: listing.sold ? '#9a8070' : (listing.price === 0 ? '#16a34a' : 'var(--brand)') }}>
                    {listing.price === 0 ? 'Free' : `£${listing.price}`}
                  </span>
                  <div className="flex items-center gap-1 text-xs" style={{ color: '#9a8070' }}>
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate max-w-[80px]">{listing.neighborhood || listing.sellerName}</span>
                    <span>· {formatRelativeTime(listing.created_at)}</span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Posts */}
      {activeFilter !== 'Market' && !loading && (
        <div className="space-y-4">
          {filtered.length === 0 && (
            <div className="flex flex-col items-center text-center py-14">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--brand-light)' }}>
                <MessageCircle className="w-7 h-7" style={{ color: 'var(--brand)' }} />
              </div>
              <p className="text-base font-semibold mb-1" style={{ color: '#2a1f18' }}>Nothing here yet</p>
              <p className="text-sm mb-5" style={{ color: '#9a8070' }}>
                {activeFilter === 'All'
                  ? 'Be the first to post something for your community.'
                  : `No ${activeFilter.toLowerCase()} posts yet. Try a different filter or be the first!`}
              </p>
              <button onClick={onNewPost} className="btn-brand text-sm">+ Share something</button>
            </div>
          )}
          {filtered.map((post) => {
            const typeInfo = TYPE_COLORS[post.type] ?? TYPE_COLORS.question;
            const authorName = post.anonymous ? 'Anonymous Parent' : (post.profile?.name || 'Community Member');
            const authorAvatar = post.anonymous ? '' : (post.profile?.avatar_url || '');
            const authorNeighborhood = post.profile?.neighborhood || '';
            const timeAgo = formatRelativeTime(post.created_at);

            return (
              <article key={post.id} className="card-sprout overflow-hidden cursor-pointer hover:shadow-md transition-shadow" onClick={() => onOpenThread(post.id)}>
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      {post.anonymous || !authorAvatar ? (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                          style={post.anonymous
                            ? { background: '#EFF4FF', color: '#2563EB' }
                            : { background: 'var(--brand-light)', color: 'var(--brand)' }
                          }
                        >
                          {post.anonymous ? '?' : authorName.charAt(0)}
                        </div>
                      ) : (
                        <img src={authorAvatar} alt={authorName} className="w-10 h-10 rounded-full object-cover" />
                      )}
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#2a1f18' }}>{authorName}</p>
                        <div className="flex items-center gap-1 text-xs" style={{ color: '#9a8070' }}>
                          {authorNeighborhood && <><MapPin className="w-3 h-3" />{authorNeighborhood} · </>}
                          {timeAgo}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tag-sprout" style={{ background: typeInfo.bg, color: typeInfo.text }}>{typeInfo.label}</span>
                      {post.user_id === user?.id && (
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

                  <p className="text-sm leading-relaxed mb-3" style={{ color: '#3a2820', lineHeight: 1.6 }}>{post.content}</p>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {post.tags.map((tag) => (
                      <span key={tag} className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#f4f3f0', color: '#7a6055' }}>#{tag}</span>
                    ))}
                  </div>
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
              onClick={() => {
                navigator.clipboard.writeText(window.location.origin).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
              className="flex items-center gap-1.5 text-sm mr-5 transition-colors font-medium"
              style={{ color: copied ? 'var(--brand)' : '#9a8070' }}
            >
              {copied ? <CheckIcon className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Link copied!' : 'Copy invite link'}
            </button>
            <button className="flex items-center gap-1.5 text-sm mr-5" style={{ color: '#9a8070' }}>
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </article>
      )}
    </div>
  );
}
