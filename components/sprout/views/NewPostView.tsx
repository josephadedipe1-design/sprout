'use client';

import { useState } from 'react';
import { ArrowLeft, MapPin, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const POST_TYPES = [
  { id: 'question', label: 'Question', desc: 'Ask the community for advice', color: '#7D3C1A', bg: '#FFF5EF' },
  { id: 'support', label: 'Support', desc: 'Share anonymously, receive kindness', color: '#2563EB', bg: '#EFF4FF' },
  { id: 'meetup', label: 'Meetup', desc: 'Organize a local playdate or event', color: '#059669', bg: '#ECFDF5' },
  { id: 'listing', label: 'List in Market', desc: 'Sell or give away items in the Marketplace', color: '#D97706', bg: '#FFF7ED' },
];

const TAGS = ['Health', 'Sleep', 'Feeding', 'Development', 'Education', 'Mental Health', 'Activities', 'Gear', 'Nutrition', 'Travel'];

interface NewPostViewProps {
  onBack: () => void;
  onPublish: () => void;
  onListInMarket: () => void;
}

export default function NewPostView({ onBack, onPublish, onListInMarket }: NewPostViewProps) {
  const { user, profile } = useAuth();
  const postcodeDistrict = profile?.postcode_district || '';
  const [step, setStep] = useState<'type' | 'compose'>('type');
  const [postType, setPostType] = useState('');
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [anonymous, setAnonymous] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');

  function toggleTag(t: string) {
    setSelectedTags((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  async function handlePublish() {
    if (!content.trim() || !user) return;
    setPublishing(true);
    setError('');

    const { error: insertError } = await supabase.from('posts').insert({
      author_id: user.id,
      post_type: postType,
      body: content.trim(),
      is_anonymous: anonymous,
      postcode_district: postcodeDistrict,
    });

    if (insertError) {
      console.error('Post insert error:', insertError);
      setError(insertError.message || 'Failed to publish. Please try again.');
      setPublishing(false);
    } else {
      onPublish();
    }
  }

  const selectedType = POST_TYPES.find((t) => t.id === postType);
  const neighborhood = profile?.neighborhood || profile?.city || 'your area';

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 lg:pb-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={step === 'compose' ? () => setStep('type') : onBack} style={{ color: 'var(--brand)' }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold" style={{ color: '#2a1f18' }}>
          {step === 'type' ? 'What would you like to post?' : 'Create Post'}
        </h1>
      </div>

      {step === 'type' && (
        <div className="space-y-3">
          {POST_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                if (t.id === 'listing') { onListInMarket(); return; }
                setPostType(t.id); setStep('compose');
              }}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all hover:scale-[1.01]"
              style={{ background: 'white', borderColor: 'var(--border-color)' }}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0" style={{ background: t.bg, color: t.color }}>
                {t.label[0]}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm" style={{ color: '#2a1f18' }}>{t.label}</p>
                <p className="text-xs" style={{ color: '#9a8070' }}>{t.desc}</p>
              </div>
              {t.id === 'listing' && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: '#FFF7ED', color: '#D97706' }}>Market</span>
              )}
            </button>
          ))}
        </div>
      )}

      {step === 'compose' && selectedType && (
        <div className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl text-sm font-medium" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
              {error}
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="tag-sprout" style={{ background: selectedType.bg, color: selectedType.color }}>
              {selectedType.label}
            </span>
            {postType === 'support' && (
              <button
                onClick={() => setAnonymous(!anonymous)}
                className="tag-sprout transition-all"
                style={{
                  background: anonymous ? '#EFF4FF' : '#f4f3f0',
                  color: anonymous ? '#2563EB' : '#9a8070',
                  border: `1px solid ${anonymous ? '#bfdbfe' : '#e0dbd4'}`,
                }}
              >
                {anonymous ? '✓ Anonymous' : 'Post anonymously'}
              </button>
            )}
          </div>

          <div>
            <textarea
              className="input-sprout resize-none"
              rows={5}
              placeholder={
                postType === 'question' ? "What's on your mind? Ask the community…"
                : postType === 'support' ? "Share what you're going through. This is a safe space…"
                : postType === 'tip' ? "Share your tip or parenting win…"
                : postType === 'meetup' ? "Describe your event, date, time, and location…"
                : "Describe what you're selling or giving away…"
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <p className="text-xs mt-1 text-right" style={{ color: '#c4a090' }}>{content.length}/500</p>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#f4f3f0' }}>
            <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--brand)' }} />
            <span className="text-sm" style={{ color: '#5a4035' }}>Posting from <strong>{neighborhood}</strong></span>
          </div>

          <div>
            <p className="text-sm font-medium mb-2" style={{ color: '#4a3328' }}>Tags</p>
            <div className="flex flex-wrap gap-2">
              {TAGS.map((t) => {
                const sel = selectedTags.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggleTag(t)}
                    className="tag-sprout transition-all"
                    style={{
                      background: sel ? 'var(--brand-light)' : '#f4f3f0',
                      color: sel ? 'var(--brand)' : '#7a6055',
                      border: `1px solid ${sel ? '#e8c9b4' : '#e0dbd4'}`,
                    }}
                  >
                    {sel && <X className="w-3 h-3 mr-0.5" />}
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            className="btn-brand w-full text-base mt-2"
            disabled={!content.trim() || publishing}
            onClick={handlePublish}
            style={{ opacity: content.trim() && !publishing ? 1 : 0.5 }}
          >
            {publishing ? 'Publishing…' : 'Publish Post'}
          </button>
        </div>
      )}
    </div>
  );
}
