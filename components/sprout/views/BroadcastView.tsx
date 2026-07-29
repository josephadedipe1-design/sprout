'use client';

import { useState } from 'react';
import { Leaf, ArrowLeft, Send, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const ADMIN_ID = '4848415f-2bbe-409a-8443-eb925b0b88e8';
const SPROUT_TEAM_PROFILE_ID = '4848415f-2bbe-409a-8443-eb925b0b88e8';

interface BroadcastViewProps {
  onBack: () => void;
}

export default function BroadcastView({ onBack }: BroadcastViewProps) {
  const { user } = useAuth();
  const [body, setBody] = useState('');
  const [postType, setPostType] = useState('announcement');
  const [publishing, setPublishing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!user || user.id !== ADMIN_ID) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="card-sprout p-8 text-center">
          <p className="text-sm font-medium" style={{ color: '#9a8070' }}>
            You don&apos;t have access to this page.
          </p>
          <button onClick={onBack} className="btn-sprout mt-4">Back to Feed</button>
        </div>
      </div>
    );
  }

  async function handlePublish() {
    if (!body.trim()) {
      setError('Please write a message before publishing.');
      return;
    }
    setPublishing(true);
    setError('');
    setSuccess(false);

    const { error: insertError } = await supabase.from('posts').insert({
      author_id: SPROUT_TEAM_PROFILE_ID,
      body: body.trim(),
      post_type: postType,
      is_anonymous: false,
      is_official: true,
      postcode_district: '',
    });

    setPublishing(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSuccess(true);
    setBody('');
    setTimeout(() => setSuccess(false), 4000);
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium mb-5 hover:opacity-70 transition-opacity" style={{ color: '#7a6055' }}>
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="card-sprout p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand)' }}>
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: '#2a1f18' }}>Sprout Team Broadcast</h1>
            <p className="text-xs" style={{ color: '#9a8070' }}>Publish an announcement visible to all Sprout parents</p>
          </div>
        </div>

        {success && (
          <div className="mb-4 p-3 rounded-xl flex items-center gap-2" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <CheckCircle className="w-4 h-4" style={{ color: '#16A34A' }} />
            <p className="text-sm font-medium" style={{ color: '#15803D' }}>Announcement published successfully.</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-xl" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
            <p className="text-sm font-medium" style={{ color: '#DC2626' }}>{error}</p>
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2" style={{ color: '#3a2820' }}>Post type</label>
          <select
            className="input-sprout"
            value={postType}
            onChange={(e) => setPostType(e.target.value)}
          >
            <option value="announcement">Announcement</option>
            <option value="question">Question</option>
            <option value="tip">Tip</option>
            <option value="event">Event</option>
          </select>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-semibold mb-2" style={{ color: '#3a2820' }}>Message</label>
          <textarea
            className="input-sprout min-h-[140px] resize-y"
            placeholder="Write your announcement here…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
          />
          <p className="text-xs mt-1" style={{ color: '#c4a090' }}>{body.length} / 2000 characters</p>
        </div>

        <button
          onClick={handlePublish}
          disabled={publishing || !body.trim()}
          className="btn-sprout w-full flex items-center justify-center gap-2"
          style={{ opacity: publishing || !body.trim() ? 0.5 : 1 }}
        >
          {publishing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Publishing…</>
          ) : (
            <><Send className="w-4 h-4" /> Publish Announcement</>
          )}
        </button>
      </div>
    </div>
  );
}
