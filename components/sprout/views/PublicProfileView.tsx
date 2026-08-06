'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Baby, Star, Heart, UserPlus, MessageCircle, X, Loader2, Users, Flag, Ban } from 'lucide-react';
import { Profile } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { sendNotificationEmail } from '@/lib/notifications';
import { formatLocation, objectPosition } from '@/lib/utils';
import ReportModal, { type ReportTarget } from '@/components/sprout/ReportModal';
import { blockUser, isUserBlockedByMe } from '@/lib/blocks';

interface PublicProfileViewProps {
  profile: Profile;
  onBack: () => void;
  onConnect: () => void;
  onMessage: (userId?: string) => void;
  connected?: boolean;
  pendingRequest?: boolean;
}

export default function PublicProfileView({ profile, onBack, onConnect, onMessage, connected = false, pendingRequest = false }: PublicProfileViewProps) {
  const { user, profile: myProfile } = useAuth();
  const [hovered, setHovered] = useState<'accept' | 'decline' | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

  useEffect(() => {
    if (!user || !profile.userId || profile.userId === user.id) return;
    isUserBlockedByMe(profile.userId).then(setBlocked);
  }, [user, profile.userId]);

  async function handleBlock() {
    if (!user || !profile.userId) return;
    setBlockLoading(true);
    const ok = await blockUser(profile.userId);
    setBlockLoading(false);
    if (ok) {
      setBlocked(true);
      setShowBlockConfirm(false);
    }
  }

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

    const requesterName = myProfile?.first_name
      ? (myProfile.last_initial ? `${myProfile.first_name} ${myProfile.last_initial}.` : myProfile.first_name)
      : 'A parent';
    sendNotificationEmail({
      type: 'match_request',
      recipientUserId: profile.userId,
      emailData: {
        actorUserId: user.id,
        requesterName,
      },
    });
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
          className="w-20 h-20 rounded-full object-cover flex-shrink-0 border-2"
          style={{ borderColor: 'var(--border-color)', objectPosition: objectPosition(profile.avatarPosX, profile.avatarPosY) }}
        />
        <div className="flex-1 min-w-0 pt-1">
          <h1 className="text-xl font-bold" style={{ color: '#2a1f18' }}>{profile.name}, {profile.age}</h1>
          <div className="flex items-center gap-1.5 text-sm mt-0.5" style={{ color: '#9a8070' }}>
            <MapPin className="w-3.5 h-3.5" /> {formatLocation(profile.postcode_district || '', profile.neighborhood) || 'Location not set'}
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

      {/* Life stage badge */}
      {(() => {
        const meta = profile.parent_type
          ? { expecting: { Icon: Baby, label: 'Expecting', color: '#2563EB', bg: '#EFF4FF' }, parent: { Icon: Heart, label: 'Parent', color: 'var(--brand)', bg: 'var(--brand-light)' }, both: { Icon: Users, label: 'Parent & Expecting', color: '#7c3aed', bg: '#F3EBFD' } }[profile.parent_type]
          : undefined;
        if (!meta) return null;
        const Icon = meta.Icon;
        return (
          <div className="mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: meta.bg, color: meta.color }}>
              <Icon className="w-3.5 h-3.5" /> {meta.label}
            </span>
          </div>
        );
      })()}

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
        {profile.userId && profile.userId !== user?.id && (
          <>
            <button
              onClick={() => setShowBlockConfirm(true)}
              disabled={blocked}
              className="flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 px-3 rounded-xl border-2 transition-all hover:bg-red-50"
              style={{
                borderColor: blocked ? '#fecaca' : '#d0c8c0',
                color: blocked ? '#ef4444' : '#7a6055',
                opacity: blocked ? 0.7 : 1,
              }}
              title={blocked ? 'User blocked' : 'Block this user'}
            >
              <Ban className="w-4 h-4" />
            </button>
            <button
              onClick={() => setReportTarget({ type: 'user', userId: profile.userId! })}
              className="flex items-center justify-center gap-1.5 text-sm font-semibold py-2.5 px-3 rounded-xl border-2 transition-all hover:bg-orange-50"
              style={{ borderColor: '#d0c8c0', color: '#7a6055' }}
              title="Report this user"
            >
              <Flag className="w-4 h-4" />
            </button>
          </>
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
      <ReportModal target={reportTarget} open={!!reportTarget} onClose={() => setReportTarget(null)} />

      {showBlockConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }} onClick={() => setShowBlockConfirm(false)}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: 'white' }} onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Ban className="w-5 h-5" style={{ color: '#ef4444' }} />
                <h2 className="text-base font-bold" style={{ color: '#2a1f18' }}>Block {profile.name}?</h2>
              </div>
              <p className="text-sm mb-5" style={{ color: '#7a6055', lineHeight: 1.5 }}>
                They won&apos;t be able to see your posts, listings, or profile, and you won&apos;t see theirs. You can unblock them anytime in Settings.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleBlock}
                  disabled={blockLoading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity hover:opacity-80 flex items-center justify-center gap-2"
                  style={{ background: '#ef4444', color: 'white', opacity: blockLoading ? 0.7 : 1 }}
                >
                  {blockLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {blockLoading ? 'Blocking…' : 'Block'}
                </button>
                <button
                  onClick={() => setShowBlockConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-opacity hover:opacity-80"
                  style={{ borderColor: '#d0c8c0', color: '#5a4035', background: 'white' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
