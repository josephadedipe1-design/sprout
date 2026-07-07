'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Camera, Loader2, MapPin } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

interface EditProfileViewProps {
  onBack: () => void;
  onSave: () => void;
}

const INTERESTS = [
  'Getting out',
  'Feeding',
  'Sleep',
  'Health',
  'Development',
  'Education & learning',
  'Wellbeing & mental health',
  'Pregnancy & birth',
  'Practical life',
  'Just for fun',
];
const BIO_MAX = 150;

export default function EditProfileView({ onBack, onSave }: EditProfileViewProps) {
  const { profile, user, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeStatus, setGeocodeStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: '',
    bio: '',
    neighborhood: '',
    city: '',
    postcode: '',
    interests: [] as string[],
  });
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name,
        bio: profile.bio,
        neighborhood: profile.neighborhood,
        city: profile.city,
        postcode: profile.postcode ?? '',
        interests: profile.interests ?? [],
      });
      setAvatarUrl(profile.avatar_url || '');
    }
  }, [profile]);

  function toggleInterest(i: string) {
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(i) ? f.interests.filter((x) => x !== i) : [...f.interests, i],
    }));
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    setError('');
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const bustedUrl = `${publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: bustedUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (updateError) throw updateError;
      setAvatarUrl(bustedUrl);
      await refreshProfile();
    } catch {
      setError('Failed to upload photo. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setError('');

    let lat: number | null | undefined = undefined;
    let lng: number | null | undefined = undefined;
    let neighborhood = form.neighborhood;
    let city = form.city;

    const postcodeTrimmed = form.postcode.trim();
    const postcodeChanged = postcodeTrimmed && postcodeTrimmed !== (profile?.postcode ?? '');
    if (postcodeChanged) {
      setGeocoding(true);
      try {
        const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcodeTrimmed)}`);
        const data = await res.json();
        if (data.status === 200 && data.result) {
          lat = data.result.latitude;
          lng = data.result.longitude;
          if (!neighborhood) neighborhood = data.result.admin_ward || data.result.parliamentary_constituency || '';
          if (!city) city = data.result.admin_district || data.result.region || '';
          setGeocodeStatus('ok');
        } else {
          setGeocodeStatus('error');
        }
      } catch {
        setGeocodeStatus('error');
      }
      setGeocoding(false);
    }

    const update: Record<string, unknown> = {
      name: form.name,
      bio: form.bio.slice(0, BIO_MAX),
      neighborhood,
      city,
      interests: form.interests,
      postcode: postcodeTrimmed || profile?.postcode,
      updated_at: new Date().toISOString(),
    };
    if (lat !== undefined) { update.lat = lat; update.lng = lng; }

    const { error: updateError } = await supabase.from('profiles').update(update).eq('id', user.id);

    if (updateError) {
      setError('Failed to save changes. Please try again.');
      setSaving(false);
    } else {
      await refreshProfile();
      onSave();
    }
  }

  const initials = (form.name || 'Y').charAt(0).toUpperCase();
  const bioLength = form.bio.length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 lg:pb-6">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--brand)' }}>
          <ArrowLeft className="w-4 h-4" /> Cancel
        </button>
        <h1 className="font-bold" style={{ color: '#2a1f18' }}>Edit Profile</h1>
        <button onClick={handleSave} className="text-sm font-semibold" style={{ color: 'var(--brand)' }} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl text-sm font-medium" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
          {error}
        </div>
      )}

      {/* Avatar */}
      <div className="flex flex-col items-center mb-7">
        <div className="relative">
          {avatarUrl ? (
            <img src={avatarUrl} alt={form.name} className="w-24 h-24 rounded-full object-cover" />
          ) : (
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white"
              style={{ background: 'var(--brand)' }}
            >
              {initials}
            </div>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
            style={{ background: 'var(--brand)' }}
          >
            {uploading
              ? <Loader2 className="w-4 h-4 text-white animate-spin" />
              : <Camera className="w-4 h-4 text-white" />
            }
          </button>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="mt-2 text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--brand)' }}
        >
          {uploading ? 'Uploading…' : 'Change photo'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#4a3328' }}>Display name</label>
          <input className="input-sprout" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#4a3328' }}>Bio</label>
          <textarea
            className="input-sprout resize-none"
            rows={3}
            maxLength={BIO_MAX}
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
          />
          <p className="text-xs mt-1 text-right" style={{ color: bioLength >= BIO_MAX ? '#ef4444' : '#c4a090' }}>
            {bioLength}/{BIO_MAX}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#4a3328' }}>Neighborhood</label>
          <input className="input-sprout" value={form.neighborhood} onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#4a3328' }}>City</label>
          <input className="input-sprout" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5" style={{ color: '#4a3328' }}>
            <MapPin className="w-3.5 h-3.5" /> Postcode
          </label>
          <div className="relative">
            <input
              className="input-sprout uppercase"
              placeholder="e.g. SW1A 1AA"
              value={form.postcode}
              onChange={(e) => { setForm((f) => ({ ...f, postcode: e.target.value.toUpperCase() })); setGeocodeStatus('idle'); }}
            />
            {geocoding && (
              <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin" style={{ color: '#c4a090' }} />
            )}
          </div>
          {geocodeStatus === 'ok' && (
            <p className="text-xs mt-1 font-medium" style={{ color: '#059669' }}>Location found — you&apos;ll appear on the map!</p>
          )}
          {geocodeStatus === 'error' && (
            <p className="text-xs mt-1 font-medium" style={{ color: '#b45309' }}>Postcode not recognised — check spelling and try again.</p>
          )}
          <p className="text-xs mt-1" style={{ color: '#c4a090' }}>Used to show you on the community map. Only your area is ever shown.</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: '#4a3328' }}>Interests</label>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((i) => {
              const sel = form.interests.includes(i);
              return (
                <button
                  key={i}
                  onClick={() => toggleInterest(i)}
                  className="tag-sprout transition-all"
                  style={{
                    background: sel ? 'var(--brand-light)' : '#f4f3f0',
                    color: sel ? 'var(--brand)' : '#7a6055',
                    border: `1px solid ${sel ? '#e8c9b4' : '#e0dbd4'}`,
                  }}
                >
                  {i}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-2">
          <button onClick={handleSave} className="btn-brand w-full text-base" disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
