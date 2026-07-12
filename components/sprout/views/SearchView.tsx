'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, ArrowLeft, MapPin, Clock, TrendingUp, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DbProfile } from '@/lib/types';
import { formatLocation } from '@/lib/utils';

const TRENDING = ['Pediatric dentist', 'Sleep regression', 'Playgroup', 'Baby carrier', 'First foods'];

interface PostResult {
  id: string;
  body: string;
  profile: DbProfile | null;
  created_at: string;
}

interface ListingResult {
  id: string;
  title: string;
  price_pence: number;
  postcode_district: string;
  image_url: string;
}

interface SearchResults {
  profiles: DbProfile[];
  posts: PostResult[];
  listings: ListingResult[];
}

const EMPTY: SearchResults = { profiles: [], posts: [], listings: [] };

interface SearchViewProps {
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

export default function SearchView({ onBack }: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [recent, setRecent] = useState<string[]>([]);

  const runSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(EMPTY); return; }
    setLoading(true);
    const term = `%${q}%`;
    const [profileRes, postRes, listingRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .ilike('first_name', term)
        .limit(5),
      supabase
        .from('posts')
        .select('id, body, created_at, profiles(*)')
        .ilike('body', term)
        .eq('is_anonymous', false)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('listings')
        .select('id, title, price_pence, postcode_district, image_url')
        .ilike('title', term)
        .eq('status', 'active')
        .limit(3),
    ]);
    setResults({
      profiles: (profileRes.data ?? []) as DbProfile[],
      posts: (postRes.data ?? []).map((p: any) => ({
        id: p.id,
        body: p.body,
        profile: p.profiles as DbProfile | null,
        created_at: p.created_at,
      })),
      listings: (listingRes.data ?? []) as ListingResult[],
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => runSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  function selectQuery(q: string) {
    setQuery(q);
    setRecent(prev => [q, ...prev.filter(r => r !== q)].slice(0, 5));
  }

  const hasQuery = query.length >= 2;
  const hasAnyResults = results.profiles.length > 0 || results.posts.length > 0 || results.listings.length > 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 lg:pb-6">
      {/* Search input */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} style={{ color: 'var(--brand)', flexShrink: 0 }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#c4a090' }} />
          <input
            className="input-sprout pl-9"
            placeholder="Search people, posts, listings…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          {loading && (
            <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin" style={{ color: '#c4a090' }} />
          )}
        </div>
      </div>

      {/* Pre-search state */}
      {!hasQuery && (
        <>
          {recent.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: '#4a3328' }}>
                  <Clock className="w-4 h-4" /> Recent
                </p>
                <button className="text-xs" style={{ color: 'var(--brand)' }} onClick={() => setRecent([])}>Clear</button>
              </div>
              <div className="space-y-2">
                {recent.map((r) => (
                  <button
                    key={r}
                    onClick={() => selectQuery(r)}
                    className="w-full flex items-center gap-3 py-2 text-sm text-left"
                    style={{ color: '#5a4035' }}
                  >
                    <Clock className="w-4 h-4 flex-shrink-0" style={{ color: '#c4a090' }} />
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-semibold flex items-center gap-1.5 mb-3" style={{ color: '#4a3328' }}>
              <TrendingUp className="w-4 h-4" /> Suggested searches
            </p>
            <div className="flex flex-wrap gap-2">
              {TRENDING.map((t) => (
                <button
                  key={t}
                  onClick={() => selectQuery(t)}
                  className="tag-sprout text-sm"
                  style={{ background: 'white', border: '1px solid var(--border-color)', color: '#5a4035' }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Results */}
      {hasQuery && !loading && !hasAnyResults && (
        <div className="text-center py-14">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--brand-light)' }}>
            <Search className="w-6 h-6" style={{ color: 'var(--brand)' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#2a1f18' }}>No results for &ldquo;{query}&rdquo;</p>
          <p className="text-sm" style={{ color: '#9a8070' }}>Try different keywords or check your spelling.</p>
        </div>
      )}

      {hasQuery && hasAnyResults && (
        <div className="space-y-6">
          {results.profiles.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#9a8070' }}>People</p>
              <div className="space-y-3">
                {results.profiles.map((p) => (
                  <div key={p.id} className="card-sprout p-3 flex items-center gap-3">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={p.first_name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: 'var(--brand)' }}>
                        {p.first_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#2a1f18' }}>{p.first_name}</p>
                      {p.postcode_district && (
                        <p className="text-xs flex items-center gap-1" style={{ color: '#9a8070' }}>
                          <MapPin className="w-3 h-3" />{formatLocation(p.postcode_district)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.posts.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#9a8070' }}>Posts</p>
              <div className="space-y-3">
                {results.posts.map((p) => (
                  <div key={p.id} className="card-sprout p-4">
                    <p className="text-sm mb-2 leading-relaxed" style={{ color: '#2a1f18', lineHeight: 1.5 }}>{p.body}</p>
                    <p className="text-xs" style={{ color: '#9a8070' }}>
                      {p.profile?.first_name ?? 'Community Member'} · {formatRelativeTime(p.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.listings.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#9a8070' }}>Listings</p>
              <div className="space-y-3">
                {results.listings.map((l) => (
                  <div key={l.id} className="card-sprout p-3 flex items-center gap-3">
                    {l.image_url ? (
                      <img src={l.image_url} alt={l.title} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl flex-shrink-0" style={{ background: '#f0ece5' }} />
                    )}
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#2a1f18' }}>{l.title}</p>
                      <p className="text-base font-bold" style={{ color: 'var(--brand)' }}>{l.price_pence === 0 ? 'Free' : `£${(l.price_pence / 100).toFixed(2)}`}</p>
                      {l.postcode_district && (
                        <p className="text-xs flex items-center gap-1" style={{ color: '#9a8070' }}>
                          <MapPin className="w-3 h-3" />{formatLocation(l.postcode_district)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
