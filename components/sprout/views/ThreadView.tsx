'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Heart, Send, MoreHorizontal, MapPin, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { DbProfile } from '@/lib/types';

interface Post {
  id: string;
  content: string;
  tags: string[];
  type: string;
  created_at: string;
  profile: DbProfile | null;
  anonymous: boolean;
  likes: number;
  liked: boolean;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  profile: DbProfile | null;
}

interface ThreadViewProps {
  postId: string;
  onBack: () => void;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins || 1}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ThreadView({ postId, onBack }: ThreadViewProps) {
  const { user, profile } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [reply, setReply] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const loadThread = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoadError('');
    const [postRes, commentsRes, likeRes, myLike] = await Promise.all([
      supabase.from('posts').select('*').eq('id', postId).maybeSingle(),
      supabase.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true }),
      supabase.from('post_likes').select('post_id').eq('post_id', postId),
      supabase.from('post_likes').select('post_id').eq('post_id', postId).eq('user_id', user.id).maybeSingle(),
    ]);

    // Collect all user IDs needing profiles
    const userIds = Array.from(new Set([
      postRes.data?.user_id,
      ...((commentsRes.data ?? []) as any[]).map((c: any) => c.user_id),
    ].filter(Boolean)));

    const profileMap: Record<string, DbProfile> = {};
    if (userIds.length > 0) {
      const { data: profileRows } = await supabase.from('profiles').select('*').in('id', userIds);
      (profileRows ?? []).forEach((p: DbProfile) => { profileMap[p.id] = p; });
    }

    if (postRes.error) {
      setLoadError(postRes.error.message);
      setLoading(false);
      return;
    }

    if (postRes.data) {
      const p = postRes.data as any;
      setPost({
        id: p.id,
        content: p.content,
        tags: p.tags ?? [],
        type: p.type,
        created_at: p.created_at,
        profile: profileMap[p.user_id] ?? null,
        anonymous: p.anonymous,
        likes: likeRes.data?.length ?? 0,
        liked: !!myLike.data,
      });
    }

    setComments(
      ((commentsRes.data ?? []) as any[]).map((c: any) => ({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        user_id: c.user_id,
        profile: profileMap[c.user_id] ?? null,
      }))
    );
    setLoading(false);
  }, [postId, user]);

  useEffect(() => { loadThread(); }, [loadThread]);

  async function togglePostLike() {
    if (!user || !post) return;
    if (post.liked) {
      await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      setPost(p => p ? { ...p, liked: false, likes: p.likes - 1 } : p);
    } else {
      await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
      setPost(p => p ? { ...p, liked: true, likes: p.likes + 1 } : p);
    }
  }

  async function submitComment() {
    if (!reply.trim() || !user || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    const content = reply.trim();
    const { error } = await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: user.id, content });
    if (error) {
      setSubmitError('Failed to post comment. Please try again.');
    } else {
      setComments(prev => [...prev, {
        id: crypto.randomUUID(),
        content,
        created_at: new Date().toISOString(),
        user_id: user.id,
        profile: profile as unknown as DbProfile | null,
      }]);
      setReply('');
    }
    setSubmitting(false);
  }

  const authorName = post ? (post.anonymous ? 'Anonymous Parent' : post.profile?.name ?? 'Community Member') : '';
  const authorAvatar = post && !post.anonymous ? post.profile?.avatar_url ?? '' : '';

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-32 lg:pb-6">
      <button onClick={onBack} className="flex items-center gap-2 mb-5 text-sm font-medium" style={{ color: 'var(--brand)' }}>
        <ArrowLeft className="w-4 h-4" /> Back to Feed
      </button>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--brand)' }} />
        </div>
      )}

      {!loading && (loadError || !post) && (
        <div className="text-center py-16">
          <p className="text-sm font-medium mb-1" style={{ color: '#9a8070' }}>
            {loadError ? 'Could not load post' : 'Post not found or no longer available.'}
          </p>
          {loadError && (
            <p className="text-xs mt-1 font-mono" style={{ color: '#c4a090' }}>{loadError}</p>
          )}
        </div>
      )}

      {!loading && post && (
        <>
          {/* Original post */}
          <div className="card-sprout p-5 mb-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                {authorAvatar ? (
                  <img src={authorAvatar} alt={authorName} className="w-11 h-11 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold text-white"
                    style={{ background: post.anonymous ? '#2563EB' : 'var(--brand)' }}
                  >
                    {post.anonymous ? '?' : authorName.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="font-semibold" style={{ color: '#2a1f18' }}>{authorName}</p>
                  <div className="flex items-center gap-1 text-xs" style={{ color: '#9a8070' }}>
                    {post.profile?.neighborhood && !post.anonymous && (
                      <><MapPin className="w-3 h-3" />{post.profile.neighborhood} · </>
                    )}
                    {formatRelativeTime(post.created_at)}
                  </div>
                </div>
              </div>
              <button style={{ color: '#c4a090' }}><MoreHorizontal className="w-4 h-4" /></button>
            </div>
            <p className="text-sm leading-relaxed mb-4" style={{ color: '#3a2820', lineHeight: 1.65 }}>{post.content}</p>
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {post.tags.map((t) => <span key={t} className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#f4f3f0', color: '#7a6055' }}>#{t}</span>)}
              </div>
            )}
            <button
              onClick={togglePostLike}
              className="flex items-center gap-1.5 text-sm"
              style={{ color: post.liked ? '#E53E3E' : '#9a8070' }}
            >
              <Heart className="w-4 h-4" fill={post.liked ? '#E53E3E' : 'none'} /> {post.likes} {post.likes === 1 ? 'like' : 'likes'}
            </button>
          </div>

          {/* Comments */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#7a6055' }}>{comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}</h3>
            {comments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm" style={{ color: '#9a8070' }}>No comments yet. Be the first to reply!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {comments.map((c) => {
                  const name = c.profile?.name ?? 'Community Member';
                  const avatar = c.profile?.avatar_url ?? '';
                  return (
                    <div key={c.id} className="flex gap-2.5">
                      {avatar ? (
                        <img src={avatar} alt={name} className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-0.5" />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5"
                          style={{ background: 'var(--brand)' }}
                        >
                          {name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 rounded-xl p-3.5" style={{ background: 'white', border: '1px solid var(--border-color)' }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-semibold" style={{ color: '#2a1f18' }}>{name}</span>
                          <span className="text-xs" style={{ color: '#9a8070' }}>{formatRelativeTime(c.created_at)}</span>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: '#3a2820' }}>{c.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Comment input */}
      <div className="fixed bottom-0 left-0 right-0 lg:static p-4 lg:p-0" style={{ background: 'var(--bg)', borderTop: '1px solid var(--border-color)' }}>
        {submitError && (
          <p className="text-xs mb-2 px-1 font-medium" style={{ color: '#ef4444' }}>{submitError}</p>
        )}
        <div className="flex items-center gap-2">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Me" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: 'var(--brand)' }}
            >
              {(profile?.name ?? 'Y').charAt(0)}
            </div>
          )}
          <input
            ref={inputRef}
            className="input-sprout flex-1"
            placeholder="Add a comment…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && submitComment()}
          />
          <button
            onClick={submitComment}
            disabled={!reply.trim() || submitting}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity"
            style={{ background: 'var(--brand)', opacity: reply.trim() && !submitting ? 1 : 0.4 }}
          >
            {submitting
              ? <Loader2 className="w-4 h-4 text-white animate-spin" />
              : <Send className="w-4 h-4 text-white" />
            }
          </button>
        </div>
      </div>
    </div>
  );
}
