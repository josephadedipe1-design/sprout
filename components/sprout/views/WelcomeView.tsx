'use client';

import { useEffect, useState, useCallback } from 'react';
import { MapPin, Heart, ArrowRight, Users, Sparkles, Copy, Check as CheckIcon, Share2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { DbProfile } from '@/lib/types';
import { enrichProfilesWithChildren } from '@/lib/profiles';

interface WelcomeViewProps {
  onDone: () => void;
  onGoToMatching: () => void;
}

export default function WelcomeView({ onDone, onGoToMatching }: WelcomeViewProps) {
  const { profile } = useAuth();
  const [nearbyParents, setNearbyParents] = useState<DbProfile[]>([]);
  const [copied, setCopied] = useState(false);

  const loadNearby = useCallback(async () => {
    if (!profile) return;

    // If the user has coordinates, find parents within ~15km bounding box
    if (profile.lat && profile.lng) {
      const delta = 0.135; // ~15km in degrees
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', profile.id)
        .not('lat', 'is', null)
        .gte('lat', profile.lat - delta)
        .lte('lat', profile.lat + delta)
        .gte('lng', profile.lng - delta * 1.5)
        .lte('lng', profile.lng + delta * 1.5)
        .limit(10);

      if (data && data.length > 0) {
        setNearbyParents(await enrichProfilesWithChildren(data as DbProfile[]));
        return;
      }
    }

    // Fallback: same postcode district, then any profiles
    const district = profile.postcode_district ?? profile.postcode?.split(' ')[0];
    if (district) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', profile.id)
        .ilike('postcode', `${district}%`)
        .limit(10);
      if (data && data.length > 0) {
        setNearbyParents(await enrichProfilesWithChildren(data as DbProfile[]));
        return;
      }
    }

    // Final fallback: any profiles
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', profile.id)
      .limit(6);
    setNearbyParents(await enrichProfilesWithChildren((data ?? []) as DbProfile[]));
  }, [profile]);

  useEffect(() => {
    loadNearby();
  }, [loadNearby]);

  const firstName = profile?.first_name || 'there';
  const district = profile?.postcode_district || profile?.postcode?.split(' ')[0] || '';

  function buildInviteMessage() {
    const loc = district || (profile?.neighborhood ? profile.neighborhood : '');
    const base = loc ? `Hey! I've just joined Sprout — a community app for parents in ${loc}.` : "Hey! I've just joined Sprout — a community app for local parents.";
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
        await navigator.share({ title: 'Join Sprout', text: msg, url: typeof window !== 'undefined' ? window.location.origin : '' });
        return;
      } catch { /* fall through */ }
    }
    copyInvite();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md">

        {/* Hero greeting */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm" style={{ background: 'var(--brand)' }}>
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#2a1f18' }}>
            Welcome, {firstName}!
          </h1>
          <p className="text-base leading-relaxed" style={{ color: '#7a6055' }}>
            You&apos;ve joined a community of parents right around you. Here are some nearby parents to get you started.
          </p>
        </div>

        {/* Parents near you */}
        <div className="card-sprout p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4" style={{ color: 'var(--brand)' }} />
            <p className="text-sm font-semibold" style={{ color: '#2a1f18' }}>Parents near you</p>
            {nearbyParents.length > 0 && (
              <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>
                {nearbyParents.length}+ parents
              </span>
            )}
          </div>

          {nearbyParents.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm font-semibold mb-1" style={{ color: '#2a1f18' }}>Be the first in your area!</p>
              <p className="text-sm mb-4" style={{ color: '#9a8070' }}>Invite parents near you to join Sprout and build your local community.</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={copyInvite}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{ background: 'var(--brand-light)', color: 'var(--brand)', border: '1px solid #e8c9b4' }}
                >
                  {copied ? <CheckIcon className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy invite'}
                </button>
                <button
                  onClick={shareInvite}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{ background: 'white', color: '#5a4035', border: '1px solid var(--border-color)' }}
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {nearbyParents.slice(0, 4).map((p) => (
                  <div key={p.id} className="flex items-center gap-3">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={p.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: 'var(--brand)' }}>
                        {p.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: '#2a1f18' }}>{p.name}</p>
                      <div className="flex items-center gap-1 text-xs" style={{ color: '#9a8070' }}>
                        <MapPin className="w-2.5 h-2.5" />
                        {p.neighborhood || p.city || 'Nearby'}
                        {p.children_ages && p.children_ages.length > 0 && (
                          <span style={{ color: '#c4a090' }}>· {p.children_ages[0]}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 max-w-[100px] justify-end">
                      {(p.interests ?? []).slice(0, 1).map(i => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>
                          {i}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {nearbyParents.length > 4 && (
                <div className="flex items-center justify-center mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                  <div className="flex -space-x-2 mr-2">
                    {nearbyParents.slice(4, 7).map(p => (
                      p.avatar_url ? (
                        <img key={p.id} src={p.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover border-2 border-white" />
                      ) : (
                        <div key={p.id} className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--brand)' }}>
                          {p.name.charAt(0)}
                        </div>
                      )
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: '#9a8070' }}>and {nearbyParents.length - 4} more nearby</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Quick stats / feature teasers */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="card-sprout p-4 text-center">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ background: '#d6ede3' }}>
              <Heart className="w-5 h-5" style={{ color: '#2d7a52' }} />
            </div>
            <p className="text-lg font-bold" style={{ color: '#2a1f18' }}>Community Feed</p>
            <p className="text-xs mt-0.5" style={{ color: '#9a8070' }}>Questions, support, meetups</p>
          </div>
          <div className="card-sprout p-4 text-center">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ background: '#fde8d8' }}>
              <Users className="w-5 h-5" style={{ color: '#c05a20' }} />
            </div>
            <p className="text-lg font-bold" style={{ color: '#2a1f18' }}>Your Village</p>
            <p className="text-xs mt-0.5" style={{ color: '#9a8070' }}>Connect with parents nearby</p>
          </div>
        </div>

        {/* CTAs */}
        <div className="space-y-3">
          <button
            onClick={onGoToMatching}
            className="btn-brand w-full gap-2 justify-center text-base py-3.5"
          >
            <Users className="w-5 h-5" /> Find parents near me
          </button>
          <button
            onClick={onDone}
            className="w-full text-sm font-medium py-3 flex items-center justify-center gap-1.5 rounded-xl transition-opacity hover:opacity-70"
            style={{ color: '#9a8070' }}
          >
            Explore the app <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
