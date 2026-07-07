'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Heart, MapPin, Baby, Star, SlidersHorizontal, ChevronRight, UserPlus, Users, Compass, Check, Clock, Map } from 'lucide-react';
import type { Profile } from '@/lib/profiles';
import { enrichProfilesWithChildren } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { DbProfile, DbConnection } from '@/lib/types';
import UKMap from '@/components/sprout/UKMap';

type Tab = 'discover' | 'connections' | 'requests' | 'map';

interface RealConnection {
  id: string;
  profile: DbProfile;
  requesterId: string;
}

interface MatchingViewProps {
  onViewProfile: (profile: Profile, connected?: boolean, pendingRequest?: boolean) => void;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function MatchingView({ onViewProfile }: MatchingViewProps) {
  const { user, profile: myProfile } = useAuth();
  const [tab, setTab] = useState<Tab>('connections');

  // DB state
  const [realConnections, setRealConnections] = useState<RealConnection[]>([]);
  const [realRequests, setRealRequests] = useState<RealConnection[]>([]);
  const [sentRequests, setSentRequests] = useState<RealConnection[]>([]);
  const [discoverQueue, setDiscoverQueue] = useState<DbProfile[]>([]);
  const [discoverIdx, setDiscoverIdx] = useState(0);
  const [animating, setAnimating] = useState<'left' | 'right' | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [stageFilter, setStageFilter] = useState<'' | 'expecting' | 'parent' | 'both'>('');
  const [mapProfiles, setMapProfiles] = useState<DbProfile[]>([]);

  const loadRealConnections = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('connections')
      .select('*')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq('status', 'accepted');

    if (!data) return;

    const profileIds = Array.from(new Set(
      data.flatMap(c => [c.requester_id, c.addressee_id]).filter(id => id !== user.id)
    ));
    const profileMap: Record<string, DbProfile> = {};
    if (profileIds.length > 0) {
      const { data: rows } = await supabase.from('profiles').select('*').in('id', profileIds);
      const enriched = await enrichProfilesWithChildren((rows ?? []) as DbProfile[]);
      enriched.forEach((p: DbProfile) => { profileMap[p.id] = p; });
    }

    const mapped: RealConnection[] = data.map(c => ({
      id: c.id,
      profile: profileMap[c.requester_id === user.id ? c.addressee_id : c.requester_id],
      requesterId: c.requester_id,
    })).filter(c => c.profile);
    setRealConnections(mapped);
  }, [user]);

  const loadRealRequests = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('connections')
      .select('*')
      .eq('addressee_id', user.id)
      .eq('status', 'pending');

    if (!data) return;

    const profileIds = data.map(c => c.requester_id).filter(Boolean);
    const profileMap: Record<string, DbProfile> = {};
    if (profileIds.length > 0) {
      const { data: rows } = await supabase.from('profiles').select('*').in('id', profileIds);
      const enriched = await enrichProfilesWithChildren((rows ?? []) as DbProfile[]);
      enriched.forEach((p: DbProfile) => { profileMap[p.id] = p; });
    }

    const mapped: RealConnection[] = data.map(c => ({
      id: c.id,
      profile: profileMap[c.requester_id],
      requesterId: c.requester_id,
    })).filter(c => c.profile);
    setRealRequests(mapped);
  }, [user]);

  const loadSentRequests = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('connections')
      .select('*')
      .eq('requester_id', user.id)
      .eq('status', 'pending');

    if (!data) return;

    const profileIds = data.map(c => c.addressee_id).filter(Boolean);
    const profileMap: Record<string, DbProfile> = {};
    if (profileIds.length > 0) {
      const { data: rows } = await supabase.from('profiles').select('*').in('id', profileIds);
      const enriched = await enrichProfilesWithChildren((rows ?? []) as DbProfile[]);
      enriched.forEach((p: DbProfile) => { profileMap[p.id] = p; });
    }

    const mapped: RealConnection[] = data.map(c => ({
      id: c.id,
      profile: profileMap[c.addressee_id],
      requesterId: c.requester_id,
    })).filter(c => c.profile);
    setSentRequests(mapped);
  }, [user]);

  const loadDiscoverProfiles = useCallback(async () => {
    if (!user) return;
    const { data: existingConns } = await supabase
      .from('connections')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    const excludeIds = new Set<string>([user.id]);
    (existingConns ?? []).forEach(c => {
      excludeIds.add(c.requester_id);
      excludeIds.add(c.addressee_id);
    });

    const excludeArr = Array.from(excludeIds);
    let query = supabase.from('profiles').select('*').not('id', 'in', `(${excludeArr.join(',')})`).limit(30);
    if (stageFilter) query = query.eq('parent_stage', stageFilter === 'expecting' ? 'expecting' : stageFilter);

    const { data } = await query;
    const enriched = await enrichProfilesWithChildren((data ?? []) as DbProfile[]);
    setDiscoverQueue(enriched);
    setDiscoverIdx(0);
  }, [user, stageFilter]);

  useEffect(() => {
    loadRealConnections();
    loadRealRequests();
    loadSentRequests();
  }, [loadRealConnections, loadRealRequests, loadSentRequests]);

  useEffect(() => {
    if (tab === 'discover') loadDiscoverProfiles();
  }, [tab, loadDiscoverProfiles]);

  const loadMapProfiles = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .limit(100);
    const enriched = await enrichProfilesWithChildren((data ?? []) as DbProfile[]);
    setMapProfiles(enriched);
  }, []);

  useEffect(() => {
    if (tab === 'map') loadMapProfiles();
  }, [tab, loadMapProfiles]);

  async function acceptRealRequest(connId: string) {
    await supabase.from('connections').update({ status: 'accepted' }).eq('id', connId);
    await loadRealConnections();
    await loadRealRequests();
    setTab('connections');
  }

  async function declineRealRequest(connId: string) {
    await supabase.from('connections').update({ status: 'declined' }).eq('id', connId);
    await loadRealRequests();
  }

  async function cancelSentRequest(connId: string) {
    await supabase.from('connections').delete().eq('id', connId);
    await loadSentRequests();
  }

  async function swipeRight() {
    const current = discoverQueue[discoverIdx];
    if (!current || !user) return;
    setAnimating('right');
    await supabase.from('connections').insert({ requester_id: user.id, addressee_id: current.id, status: 'pending' }).then(() => {});
    setTimeout(() => { setDiscoverIdx(i => i + 1); setAnimating(null); }, 300);
  }

  function swipeLeft() {
    setAnimating('left');
    setTimeout(() => { setDiscoverIdx(i => i + 1); setAnimating(null); }, 300);
  }

  function dbProfileToProfile(p: DbProfile): Profile {
    return {
      id: parseInt(p.id.replace(/-/g, '').slice(0, 8), 16),
      name: p.name,
      age: 30,
      neighborhood: p.neighborhood,
      childrenAges: p.children_ages,
      bio: p.bio,
      interests: p.interests,
      avatar: p.avatar_url,
      mutual: 0,
      distanceMiles: (myProfile?.lat && myProfile?.lng && p.lat && p.lng)
        ? Math.round(haversineKm(myProfile.lat, myProfile.lng, p.lat, p.lng) * 0.621371 * 10) / 10
        : 0,
      expecting: p.parent_stage === 'expecting' || p.parent_stage === 'both',
      userId: p.id,
    };
  }

  const totalConnections = realConnections.length;
  const totalRequests = realRequests.length + sentRequests.length;
  const current = discoverQueue[discoverIdx] ?? null;
  const remaining = discoverQueue.length - discoverIdx;

  const TABS = [
    { id: 'connections' as Tab, label: 'My Village', icon: Users, count: totalConnections },
    { id: 'requests' as Tab, label: 'Requests', icon: UserPlus, count: totalRequests },
    { id: 'discover' as Tab, label: 'Discover', icon: Compass, count: 0 },
    { id: 'map' as Tab, label: 'Map', icon: Map, count: 0 },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 lg:pb-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold" style={{ color: '#2a1f18' }}>My Village</h1>
        <p className="text-sm" style={{ color: '#9a8070' }}>Your parent community nearby</p>
      </div>

      <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: '#f4f3f0' }}>
        {TABS.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: tab === id ? 'white' : 'transparent',
              color: tab === id ? '#2a1f18' : '#9a8070',
              boxShadow: tab === id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Icon className="w-4 h-4" />
            {label}
            {count > 0 && id === 'requests' && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: 'var(--brand)', fontSize: '0.6rem', lineHeight: 1 }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── My Village ── */}
      {tab === 'connections' && (
        <div className="space-y-3">
          {totalConnections === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--brand-light)' }}>
                <Users className="w-7 h-7" style={{ color: 'var(--brand)' }} />
              </div>
              <p className="text-sm font-semibold mb-1" style={{ color: '#2a1f18' }}>No connections yet</p>
              <p className="text-sm" style={{ color: '#9a8070' }}>Head to Discover to find parents near you</p>
              <button onClick={() => setTab('discover')} className="btn-brand text-sm mt-4">Start discovering</button>
            </div>
          ) : (
            realConnections.map(rc => (
              <button
                key={rc.id}
                onClick={() => onViewProfile(dbProfileToProfile(rc.profile), true)}
                className="w-full card-sprout p-4 flex items-center gap-3 text-left transition-all hover:shadow-md"
              >
                {rc.profile.avatar_url ? (
                  <img src={rc.profile.avatar_url} alt={rc.profile.name} className="w-12 h-12 rounded-full object-cover object-top flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0" style={{ background: 'var(--brand)' }}>
                    {rc.profile.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold mb-0.5" style={{ color: '#2a1f18' }}>{rc.profile.name}</p>
                  <div className="flex items-center gap-1 text-xs" style={{ color: '#9a8070' }}>
                    <MapPin className="w-3 h-3" />{rc.profile.neighborhood || rc.profile.city}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(rc.profile.children_ages ?? []).map(a => (
                      <span key={a} className="text-xs px-1.5 py-0.5 rounded-md" style={{ background: '#f4f3f0', color: '#7a6055' }}>{a}</span>
                    ))}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: '#c4a090' }} />
              </button>
            ))
          )}
        </div>
      )}

      {/* ── Requests ── */}
      {tab === 'requests' && (
        <div className="space-y-5">
          {/* Received */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-2" style={{ color: '#9a8070' }}>
              <UserPlus className="w-3.5 h-3.5" /> Received
              {realRequests.length > 0 && (
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: 'var(--brand)', fontSize: '0.6rem' }}>{realRequests.length}</span>
              )}
            </p>
            {realRequests.length === 0 ? (
              <div className="card-sprout p-5 text-center">
                <p className="text-sm" style={{ color: '#9a8070' }}>No incoming requests</p>
              </div>
            ) : (
              <div className="space-y-3">
                {realRequests.map(rr => (
                  <div key={rr.id} className="card-sprout p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="flex-shrink-0">
                        {rr.profile.avatar_url ? (
                          <img src={rr.profile.avatar_url} alt={rr.profile.name} className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white" style={{ background: 'var(--brand)' }}>
                            {rr.profile.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: '#2a1f18' }}>{rr.profile.name}</p>
                        <div className="flex items-center gap-1 text-xs mb-1" style={{ color: '#9a8070' }}>
                          <MapPin className="w-3 h-3" />{rr.profile.neighborhood || rr.profile.city}
                        </div>
                        {rr.profile.bio && (
                          <p className="text-xs leading-relaxed line-clamp-2" style={{ color: '#7a6055' }}>{rr.profile.bio}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptRealRequest(rr.id)}
                        className="flex-1 text-sm py-2 rounded-xl font-semibold border-2 transition-all hover:bg-[var(--brand)] hover:text-white"
                        style={{ borderColor: 'var(--brand)', background: 'white', color: 'var(--brand)' }}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => declineRealRequest(rr.id)}
                        className="flex-1 text-sm py-2 rounded-xl font-semibold border-2 transition-all hover:bg-[#f4f3f0]"
                        style={{ borderColor: '#d0c8c0', background: 'white', color: '#7a6055' }}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sent */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3 flex items-center gap-2" style={{ color: '#9a8070' }}>
              <Clock className="w-3.5 h-3.5" /> Sent
              {sentRequests.length > 0 && (
                <span className="text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ background: '#f4f3f0', color: '#7a6055' }}>{sentRequests.length}</span>
              )}
            </p>
            {sentRequests.length === 0 ? (
              <div className="card-sprout p-5 text-center">
                <p className="text-sm" style={{ color: '#9a8070' }}>No sent requests pending</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sentRequests.map(sr => (
                  <div key={sr.id} className="card-sprout p-4 flex items-center gap-3">
                    {sr.profile.avatar_url ? (
                      <img src={sr.profile.avatar_url} alt={sr.profile.name} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold text-white flex-shrink-0" style={{ background: 'var(--brand)' }}>
                        {sr.profile.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: '#2a1f18' }}>{sr.profile.name}</p>
                      <div className="flex items-center gap-1 text-xs" style={{ color: '#9a8070' }}>
                        <MapPin className="w-3 h-3" />{sr.profile.neighborhood || sr.profile.city}
                      </div>
                      <p className="text-xs mt-0.5 font-medium" style={{ color: '#c4a090' }}>Request pending</p>
                    </div>
                    <button
                      onClick={() => cancelSentRequest(sr.id)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors hover:opacity-80"
                      style={{ borderColor: '#d0c8c0', color: '#7a6055', background: 'white' }}
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Discover ── */}
      {tab === 'discover' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm" style={{ color: '#9a8070' }}>Find new parents near you</p>
            <button
              onClick={() => setShowFilters(f => !f)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors"
              style={{
                borderColor: stageFilter ? 'var(--brand)' : 'var(--border-color)',
                color: stageFilter ? 'var(--brand)' : '#5a4035',
                background: stageFilter ? 'var(--brand-light)' : 'white',
              }}
            >
              <SlidersHorizontal className="w-4 h-4" /> Filters
              {stageFilter && <span className="w-2 h-2 rounded-full" style={{ background: 'var(--brand)' }} />}
            </button>
          </div>

          {showFilters && (
            <div className="card-sprout p-4 mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#7a6055' }}>Who you&apos;d like to meet</p>
              <div className="space-y-2">
                {[
                  { id: '' as const, Icon: Users, title: 'Everyone', desc: 'Show all parents' },
                  { id: 'expecting' as const, Icon: Baby, title: 'Expecting', desc: 'Currently pregnant' },
                  { id: 'parent' as const, Icon: Heart, title: 'Already a parent', desc: 'Has a child or children' },
                  { id: 'both' as const, Icon: Users, title: 'Both', desc: 'Expecting with existing children' },
                ].map(({ id, Icon, title, desc }) => {
                  const sel = stageFilter === id;
                  return (
                    <button key={id || 'all'} onClick={() => setStageFilter(id)}
                      className="w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all"
                      style={{ borderColor: sel ? 'var(--brand)' : 'var(--border-color)', background: sel ? 'var(--brand-light)' : 'white' }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: sel ? 'var(--brand)' : '#f0ece5' }}>
                        <Icon className="w-4 h-4" style={{ color: sel ? 'white' : '#9a7060' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: sel ? 'var(--brand)' : '#2a1f18' }}>{title}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#9a8070' }}>{desc}</p>
                      </div>
                      {sel && (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand)' }}>
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!current ? (
            <div className="flex flex-col items-center text-center py-10">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ background: 'var(--brand-light)' }}>
                <Heart className="w-10 h-10" style={{ color: 'var(--brand)' }} fill="currentColor" />
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: '#2a1f18' }}>You&apos;ve seen everyone!</h2>
              <p className="text-sm mb-8" style={{ color: '#9a8070' }}>Check back later for new parent profiles near you.</p>
              <button onClick={loadDiscoverProfiles} className="text-sm font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--brand)' }}>
                Refresh
              </button>
            </div>
          ) : (
            <>
              <div
                className="card-sprout overflow-hidden mb-4 transition-all duration-300"
                style={{
                  transform: animating === 'right' ? 'translateX(120%) rotate(12deg)' : animating === 'left' ? 'translateX(-120%) rotate(-12deg)' : 'none',
                  opacity: animating ? 0 : 1,
                }}
              >
                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-4">
                    {current.avatar_url ? (
                      <img
                        src={current.avatar_url}
                        alt={current.name}
                        className="w-16 h-16 rounded-2xl object-cover object-top flex-shrink-0"
                        style={{ border: '2px solid var(--border-color)' }}
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white flex-shrink-0" style={{ background: 'var(--brand)' }}>
                        {current.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="text-lg font-bold leading-tight" style={{ color: '#2a1f18' }}>{current.name}</h2>
                        {current.parent_stage && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{
                            background: current.parent_stage === 'expecting' ? '#EFF4FF' : 'var(--brand-light)',
                            color: current.parent_stage === 'expecting' ? '#2563EB' : 'var(--brand)',
                          }}>
                            {current.parent_stage === 'expecting' ? 'Expecting' : current.parent_stage === 'both' ? 'Parent & Expecting' : 'Parent'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs mt-0.5" style={{ color: '#9a8070' }}>
                        <MapPin className="w-3 h-3" />{current.neighborhood || current.city || 'Nearby'}
                        {myProfile?.lat && myProfile?.lng && current.lat && current.lng && (
                          <span className="font-medium" style={{ color: '#c4a090' }}>
                            · {Math.round(haversineKm(myProfile.lat, myProfile.lng, current.lat, current.lng) * 0.621371 * 10) / 10} mi away
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bio */}
                  <div className="mb-3 p-3 rounded-xl" style={{ background: '#faf8f6' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#c4a090' }}>About</p>
                    <p className="text-sm leading-relaxed" style={{ color: current.bio ? '#5a4035' : '#b0a090', lineHeight: 1.55, fontStyle: current.bio ? 'normal' : 'italic' }}>
                      {current.bio || 'No bio added yet'}
                    </p>
                  </div>

                  {/* Children ages */}
                  <div className="mb-3">
                    <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#c4a090' }}>
                      <Baby className="w-3 h-3 inline mr-1" />Children
                    </p>
                    {(current.children_ages ?? []).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {(current.children_ages ?? []).map(a => (
                          <span key={a} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: '#f4f3f0', color: '#5a4035' }}>{a}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm italic" style={{ color: '#b0a090' }}>Not specified</p>
                    )}
                  </div>

                  {/* Interests */}
                  {(current.interests ?? []).length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#c4a090' }}>Interests</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(current.interests ?? []).map(i => (
                          <span key={i} className="tag-sprout text-xs" style={{ background: 'var(--brand-light)', color: 'var(--brand)', border: '1px solid #e8c9b4' }}>{i}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <button onClick={() => onViewProfile(dbProfileToProfile(current), false)} className="text-sm font-semibold flex items-center gap-1 mt-1 transition-opacity hover:opacity-70" style={{ color: 'var(--brand)' }}>
                    See full profile <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-center gap-6 mt-2">
                <button onClick={swipeLeft} className="w-16 h-16 rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-110 active:scale-95" style={{ background: 'white', border: '2px solid #fecaca' }}>
                  <X className="w-7 h-7" style={{ color: '#ef4444' }} />
                </button>
                <button onClick={swipeRight} className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95" style={{ background: 'var(--brand)' }}>
                  <Heart className="w-9 h-9 text-white" fill="white" />
                </button>
                <button onClick={swipeRight} className="w-16 h-16 rounded-full flex items-center justify-center shadow-md transition-transform hover:scale-110 active:scale-95" style={{ background: 'white', border: '2px solid #bbf7d0' }}>
                  <Star className="w-7 h-7" style={{ color: '#16a34a' }} />
                </button>
              </div>
              <p className="text-center text-xs mt-4" style={{ color: '#c4a090' }}>
                {remaining - 1 > 0 ? `${remaining - 1} more parents near you` : 'Last profile for now'}
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Map ── */}
      {tab === 'map' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm" style={{ color: '#9a8070' }}>
              {mapProfiles.length > 0
                ? `${mapProfiles.length} parent${mapProfiles.length !== 1 ? 's' : ''} on the map`
                : 'Parents will appear here once they join with a UK postcode'}
            </p>
          </div>

          {mapProfiles.length === 0 ? (
            <div className="rounded-2xl overflow-hidden flex flex-col items-center justify-center py-16" style={{ background: '#f0ece5', border: '1px solid var(--border-color)' }}>
              <MapPin className="w-10 h-10 mb-3" style={{ color: '#c4a090' }} />
              <p className="text-sm font-semibold mb-1" style={{ color: '#2a1f18' }}>No parents on the map yet</p>
              <p className="text-sm text-center max-w-xs" style={{ color: '#9a8070' }}>
                As parents sign up with UK postcodes, they&apos;ll appear as pins here.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ height: 480, border: '1px solid var(--border-color)' }}>
              <UKMap
                profiles={mapProfiles}
                currentUserId={user?.id}
                center={myProfile?.lat && myProfile?.lng ? [myProfile.lat, myProfile.lng] : undefined}
                zoom={myProfile?.lat ? 12 : 6}
                onPinClick={(p) => onViewProfile(dbProfileToProfile(p))}
              />
            </div>
          )}

          {myProfile && !myProfile.lat && (
            <div className="mt-3 p-3 rounded-xl text-sm" style={{ background: '#fdf0cc', border: '1px solid #f5d87a', color: '#92680a' }}>
              Your profile doesn&apos;t have a location set yet. Update your postcode in Edit Profile to appear on the map.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
