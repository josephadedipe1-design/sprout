'use client';

import { useState } from 'react';
import { ArrowLeft, MapPin, Baby, Star, Heart, UserPlus, MessageCircle, X, Loader2 } from 'lucide-react';
import { Profile } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatLocation } from '@/lib/utils';

interface PublicProfileViewProps {
  profile: Profile;
  onBack: () => void;
  onConnect: () => void;
  onMessage: (userId?: string) => void;
  connected?: boolean;
  pendingRequest?: boolean;
}

export default function PublicProfileView({ profile, onBack, onConnect, onMessage, connected = false, pendingRequest = false }: PublicProfileViewProps) {
  const { user } = useAuth();
  const [hovered, setHovered] = useState<'accept' | 'decline' | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');

  async function handleConnect() {
    if (!user || !profile.userId) return;
    setConnecting(true);
    setConnectError('');
    const { error } = await supabase
      .from('match_requests')
      .insert({ from_user_id: user.id, to_user_id: profile.userId, status: 'pending' });
    if (error) {
      console.error('Connection insert error:', error);
      setConnectError('Could not send request. Please try again.');
      setConnecting(false);
      return;
    }
    setConnecting(false);
    onConnect();
  }
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 lg:pb-6">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium mb-5 transition-opacity hover:opacity-70"
        style={{ color: '#7a6055' }}
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header */}
      <div className="flex items-start gap-4 mb-5">
        <img
          src={profile.avatar}
          alt={profile.name}
          className="w-20 h-20 rounded-full object-cover object-top flex-shrink-0 border-2"
          style={{ borderColor: 'var(--border-color)' }}
        />
        <div className="flex-1 min-w-0 pt-1">
          <h1 className="text-xl font-bold" style={{ color: '#2a1f18' }}>{profile.name}, {profile.age}</h1>
          <div className="flex items-center gap-1.5 text-sm mt-0.5" style={{ color: '#9a8070' }}>
            <MapPin className="w-3.5 h-3.5" /> {profile.postcode_district ? formatLocation(profile.postcode_district) : profile.neighborhood}
            <span className="text-xs" style={{ color: '#c4a090' }}>· {profile.distanceMiles} mi away</span>
          </div>
          {profile.mutual > 0 && (
            <div className="flex items-center gap-1 text-xs font-medium mt-2 px-2.5 py-1 rounded-full w-fit" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>
              <Star className="w-3 h-3" /> {profile.mutual} mutual connection{profile.mutual !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Bio */}
      <p className="text-sm leading-relaxed mb-4" style={{ color: '#5a4035', lineHeight: 1.6 }}>
        {profile.bio}
      </p>

      {/* Children tags */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {profile.childrenAges.map((a) => (
          <span key={a} className="tag-sprout text-xs" style={{ background: '#f4f3f0', color: '#7a6055', border: '1px solid #e0dbd4' }}>
            <Baby className="w-3 h-3 mr-1" />{a}
          </span>
        ))}
      </div>

      {/* Interests */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#b8a090' }}>Interests</p>
        <div className="flex flex-wrap gap-1.5">
          {profile.interests.map((i) => (
            <span key={i} className="tag-sprout text-xs" style={{ background: 'var(--brand-light)', color: 'var(--brand)', border: '1px solid #e8c9b4' }}>
              {i}
            </span>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {connected ? (
          <>
            <button onClick={() => onMessage(profile.userId)} className="btn-brand flex-1 text-sm gap-1.5">
              <MessageCircle className="w-4 h-4" /> Message
            </button>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
              <UserPlus className="w-4 h-4" /> Connected
            </div>
          </>
        ) : pendingRequest ? (
          <>
            <button
              onClick={onConnect}
              onMouseEnter={() => setHovered('accept')}
              onMouseLeave={() => setHovered(null)}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 rounded-xl border-2 transition-all"
              style={{
                borderColor: 'var(--brand)',
                background: hovered === 'accept' ? 'var(--brand)' : 'white',
                color: hovered === 'accept' ? 'white' : 'var(--brand)',
              }}
            >
              <UserPlus className="w-4 h-4" /> Accept Request
            </button>
            <button
              onClick={onBack}
              onMouseEnter={() => setHovered('decline')}
              onMouseLeave={() => setHovered(null)}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 rounded-xl border-2 transition-all"
              style={{
                borderColor: '#d0c8c0',
                background: hovered === 'decline' ? '#f4f3f0' : 'white',
                color: hovered === 'decline' ? '#4a3328' : '#7a6055',
              }}
            >
              <X className="w-4 h-4" /> Decline
            </button>
          </>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="btn-brand flex-1 text-sm gap-1.5"
            style={{ opacity: connecting ? 0.6 : 1 }}
          >
            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {connecting ? 'Sending…' : 'Connect'}
          </button>
        )}
      </div>

      {connectError && (
        <p className="text-xs text-center mt-2 font-medium" style={{ color: '#ef4444' }}>{connectError}</p>
      )}

      {/* Message locked state for non-connections */}
      {!connected && (
        <p className="text-xs text-center mt-3" style={{ color: '#b8a090' }}>
          {pendingRequest ? 'Accept the request to start messaging' : 'Connect first to send a message'}
        </p>
      )}
    </div>
  );
}
