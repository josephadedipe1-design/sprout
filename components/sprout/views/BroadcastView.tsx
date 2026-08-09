'use client';

import { useRef, useState } from 'react';
import { Leaf, ArrowLeft, Send, Loader2, CheckCircle, Bold, Italic, Underline, ImagePlus, X, Link as LinkIcon } from 'lucide-react';
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
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function wrapSelection(marker: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = body.substring(start, end);
    const replacement = `${marker}${selected || 'text'}${marker}`;
    const newBody = body.substring(0, start) + replacement + body.substring(end);
    setBody(newBody);
    requestAnimationFrame(() => {
      ta.focus();
      const selStart = start + marker.length;
      const selEnd = selStart + (selected || 'text').length;
      ta.setSelectionRange(selStart, selEnd);
    });
  }

  function insertLink() {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = body.substring(start, end);
    const url = window.prompt('Enter the URL (https://…)');
    if (!url || !url.trim()) return;
    const cleanUrl = url.trim();
    const linkText = selected || 'link text';
    const replacement = `[${linkText}](${cleanUrl})`;
    const newBody = body.substring(0, start) + replacement + body.substring(end);
    setBody(newBody);
    requestAnimationFrame(() => {
      ta.focus();
      const selStart = start + 1;
      const selEnd = selStart + linkText.length;
      ta.setSelectionRange(selStart, selEnd);
    });
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `announcement-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('announcement-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      const { data: pub } = supabase.storage.from('announcement-images').getPublicUrl(fileName);
      setImageUrl(pub.publicUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to upload image.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleRemoveImage() {
    setImageUrl('');
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
      image_url: imageUrl || null,
    });

    setPublishing(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSuccess(true);
    setBody('');
    setImageUrl('');
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

        <div className="mb-4">
          <label className="block text-sm font-semibold mb-2" style={{ color: '#3a2820' }}>Message</label>

          <div className="flex items-center gap-1 mb-2 p-1.5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => wrapSelection('**')}
              className="p-2 rounded-lg hover:bg-white transition-colors"
              title="Bold"
              style={{ color: '#3a2820' }}
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => wrapSelection('_')}
              className="p-2 rounded-lg hover:bg-white transition-colors"
              title="Italic"
              style={{ color: '#3a2820' }}
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => wrapSelection('++')}
              className="p-2 rounded-lg hover:bg-white transition-colors"
              title="Underline"
              style={{ color: '#3a2820' }}
            >
              <Underline className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={insertLink}
              className="p-2 rounded-lg hover:bg-white transition-colors"
              title="Insert link"
              style={{ color: '#3a2820' }}
            >
              <LinkIcon className="w-4 h-4" />
            </button>
            <div className="w-px h-5 mx-1" style={{ background: 'var(--border-color)' }} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !!imageUrl}
              className="p-2 rounded-lg hover:bg-white transition-colors disabled:opacity-40"
              title="Add image"
              style={{ color: '#3a2820' }}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
          </div>

          <textarea
            ref={textareaRef}
            className="input-sprout min-h-[140px] resize-y"
            placeholder="Write your announcement here… Use the toolbar for bold, italic, and underline."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
          />
          <p className="text-xs mt-1" style={{ color: '#c4a090' }}>
            {body.length} / 2000 characters · Use **bold**, _italic_, ++underline++, [link text](url)
          </p>
        </div>

        {imageUrl && (
          <div className="mb-5 relative inline-block">
            <img
              src={imageUrl}
              alt="Announcement preview"
              className="rounded-xl max-h-48 object-cover"
              style={{ border: '1px solid var(--border-color)' }}
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-md"
              style={{ background: '#DC2626', color: 'white' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

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
