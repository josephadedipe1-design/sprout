'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Baby, Camera, Check, Heart, Loader2, MapPin, Move, Plus, Trash2, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { fetchUserInterests, ageMonthsToLabel, AGE_LABEL_TO_MONTHS } from '@/lib/profiles';
import { objectPosition } from '@/lib/utils';
import ImageRepositioner from '@/components/sprout/ImageRepositioner';

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
  'Education/Learning',
  'Wellbeing/Mental Health',
  'Pregnancy/Birth',
  'Adoption/Fostering',
  'SEN',
  'Practical life',
  'Just for fun',
];
const BIO_MAX = 150;

const PARENT_TYPES = [
  { id: 'expecting', title: 'Expecting', desc: "I'm pregnant and due soon", Icon: Baby },
  { id: 'parent',   title: 'Already a parent', desc: 'I have a child or children', Icon: Heart },
  { id: 'both',     title: 'Both', desc: "I have a child or children and I'm expecting again", Icon: Users },
];

const CHILD_AGE_OPTIONS = ['Under 1 year', '1 - 4 years', '5 - 8 years', '9 - 11 years'];

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
    postcode: '',
    interests: [] as string[],
  });
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarPos, setAvatarPos] = useState({ x: 50, y: 50 });
  const [showReposition, setShowReposition] = useState(false);
  const [parentType, setParentType] = useState('');
  const [children, setChildren] = useState<{ id: string | null; age_months: number }[]>([]);

  useEffect(() => {
    if (profile) {
      const fallbackName = profile.first_name
        ? `${profile.first_name}${profile.last_initial ? ' ' + profile.last_initial : ''}`
        : '';
      setForm({
        name: fallbackName,
        bio: profile.bio,
        postcode: profile.postcode ?? '',
        interests: profile.interests ?? [],
      });
      setAvatarUrl(profile.avatar_url || '');
      setAvatarPos({ x: profile.avatar_position_x ?? 50, y: profile.avatar_position_y ?? 50 });
      setParentType(profile.parent_type ?? 'parent');
      if (user) {
        fetchUserInterests(user.id).then(interests => {
          setForm(f => ({ ...f, interests: interests.length > 0 ? interests : f.interests }));
        });
        supabase.from('children').select('id, age_months').eq('user_id', user.id).order('created_at').then(({ data }) => {
          setChildren((data ?? []).map((c: { id: string; age_months: number }) => ({ id: c.id, age_months: c.age_months })));
        });
      }
    }
  }, [profile, user]);

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
      const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const path = `${user.id}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const bustedUrl = `${publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: bustedUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (updateError) throw updateError;
      setAvatarUrl(bustedUrl);
      setAvatarPos({ x: 50, y: 50 });
      await refreshProfile();
      setShowReposition(true);
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

    const postcodeTrimmed = form.postcode.trim();
    const fullPattern = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
    if (!postcodeTrimmed || !fullPattern.test(postcodeTrimmed)) {
      setError('Please enter your full postcode (e.g. SW1A 1AA) so we can show you nearby content.');
      setSaving(false);
      return;
    }

    const postcodeChanged = postcodeTrimmed && postcodeTrimmed !== (profile?.postcode ?? '');
    let newLat: number | null = null;
    let newLng: number | null = null;
    let newNeighborhood = '';
    let newCity = '';
    if (postcodeChanged) {
      setGeocoding(true);
      try {
        const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcodeTrimmed)}`);
        const data = await res.json();
        if (data.status === 200 && data.result) {
          setGeocodeStatus('ok');
          newLat = data.result.latitude;
          newLng = data.result.longitude;
          newNeighborhood = data.result.admin_ward || data.result.parliamentary_constituency || '';
          newCity = data.result.admin_district || data.result.region || '';
        } else {
          setGeocodeStatus('error');
        }
      } catch {
        setGeocodeStatus('error');
      }
      setGeocoding(false);
    }

    const nameParts = (form.name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastInitial = nameParts.length > 1 ? nameParts[nameParts.length - 1][0].toUpperCase() : '';
    const finalPostcode = postcodeTrimmed || profile?.postcode || '';

    const update: Record<string, unknown> = {
      id: user.id,
      first_name: firstName,
      last_initial: lastInitial,
      bio: form.bio.slice(0, BIO_MAX),
      avatar_url: avatarUrl,
      parent_type: parentType,
      due_date: profile?.due_date ?? null,
      postcode: finalPostcode,
      postcode_district: finalPostcode.split(' ')[0] || profile?.postcode_district || '',
      updated_at: new Date().toISOString(),
    };
    if (newLat !== null) {
      update.lat = newLat;
      update.lng = newLng;
      update.neighborhood = newNeighborhood;
      update.city = newCity;
    }

    const { id: _id, ...updateWithoutId } = update;
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updateWithoutId)
      .eq('id', user.id);

    if (updateError) {
      console.error('Profile update error:', updateError);
      setError('Failed to save changes. Please try again.');
      setSaving(false);
      return;
    }

    // Save interests separately: delete all existing, then insert new ones
    const { error: deleteError } = await supabase.from('user_interests').delete().eq('user_id', user.id);
    if (deleteError) throw deleteError;
    if (form.interests.length > 0) {
      const rows = form.interests.map(interest => ({ user_id: user.id, interest }));
      const { error: interestError } = await supabase.from('user_interests').insert(rows);
      if (interestError) throw interestError;
    }

    // Sync children: delete all existing, then insert current
    const { error: deleteChildrenError } = await supabase.from('children').delete().eq('user_id', user.id);
    if (deleteChildrenError) throw deleteChildrenError;
    if (children.length > 0) {
      const childRows = children.map(c => ({ user_id: user.id, age_months: c.age_months }));
      const { error: childrenInsertError } = await supabase.from('children').insert(childRows);
      if (childrenInsertError) throw childrenInsertError;
    }

    await refreshProfile();
    onSave();
    setSaving(false);
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
            <img src={avatarUrl} alt={form.name} className="w-24 h-24 rounded-full object-cover" style={{ objectPosition: objectPosition(avatarPos.x, avatarPos.y) }} />
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
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--brand)' }}
          >
            {uploading ? 'Uploading…' : 'Change photo'}
          </button>
          {avatarUrl && (
            <button
              onClick={() => setShowReposition(true)}
              className="text-sm font-medium transition-opacity hover:opacity-70 flex items-center gap-1"
              style={{ color: 'var(--brand)' }}
            >
              <Move className="w-3.5 h-3.5" /> Reposition
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
      </div>

      {showReposition && avatarUrl && (
        <ImageRepositioner
          src={avatarUrl}
          initialX={avatarPos.x}
          initialY={avatarPos.y}
          shape="circle"
          onSave={async (x, y) => {
            if (!user) return;
            await supabase.from('profiles').update({
              avatar_position_x: x,
              avatar_position_y: y,
              updated_at: new Date().toISOString(),
            }).eq('id', user.id);
            setAvatarPos({ x, y });
            await refreshProfile();
            setShowReposition(false);
          }}
          onClose={() => setShowReposition(false)}
        />
      )}

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#4a3328' }}>Full name</label>
          <input
            className="input-sprout"
            placeholder="e.g. Sarah Thompson"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          {form.name.trim() && (() => {
            const parts = form.name.trim().split(/\s+/);
            const fn = parts[0];
            const li = parts.length > 1 ? parts[parts.length - 1][0].toUpperCase() + '.' : '';
            return (
              <p className="text-xs mt-1" style={{ color: '#9a8070' }}>
                Shown on your profile as <strong style={{ color: '#5a4035' }}>{fn}{li ? ' ' + li : ''}</strong>
              </p>
            );
          })()}
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
          <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5" style={{ color: '#4a3328' }}>
            <MapPin className="w-3.5 h-3.5" /> Postcode
          </label>
          <div className="relative">
            <input
              className="input-sprout uppercase"
              placeholder="e.g. SW1A 1AA"
              value={form.postcode}
              onChange={(e) => { setForm((f) => ({ ...f, postcode: e.target.value.toUpperCase() })); setGeocodeStatus('idle'); }}
              onBlur={async (e) => {
                const pc = e.target.value.trim();
                const fullPattern = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}$/i;
                if (!pc || !fullPattern.test(pc)) return;
                setGeocoding(true);
                try {
                  const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(pc)}`);
                  const data = await res.json();
                  if (data.status === 200 && data.result) {
                    setGeocodeStatus('ok');
                  }
                } catch { /* ignore */ }
                setGeocoding(false);
              }}
            />
            {geocoding && (
              <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin" style={{ color: '#c4a090' }} />
            )}
          </div>
          {geocodeStatus === 'ok' && (
            <p className="text-xs mt-1 font-medium" style={{ color: '#059669' }}>Location found — postcode updated!</p>
          )}
          {geocodeStatus === 'error' && (
            <p className="text-xs mt-1 font-medium" style={{ color: '#b45309' }}>Postcode not recognised — check spelling and try again.</p>
          )}
          <p className="text-xs mt-1" style={{ color: '#c4a090' }}>Enter your full postcode (e.g. SW1A 1AA). Only your area is ever shown to others — never your full address.</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: '#4a3328' }}>Family status</label>
          <div className="space-y-2.5">
            {PARENT_TYPES.map(({ id, title, desc, Icon }) => {
              const sel = parentType === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setParentType(id)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all"
                  style={{ borderColor: sel ? 'var(--brand)' : 'var(--border-color)', background: sel ? 'var(--brand-light)' : 'white' }}
                >
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: sel ? 'var(--brand)' : '#f0ece5' }}>
                    <Icon className="w-5 h-5" style={{ color: sel ? 'white' : '#9a7060' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: sel ? 'var(--brand)' : '#2a1f18' }}>{title}</p>
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

        {(parentType === 'parent' || parentType === 'both' || children.length > 0) && (
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#4a3328' }}>Your children</label>
            <div className="space-y-4">
              {children.map((child, i) => (
                <div key={i} className="p-3 rounded-xl" style={{ background: '#f8f6f3', border: '1px solid var(--border-color)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium" style={{ color: '#9a8070' }}>Child {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => setChildren(prev => prev.filter((_, idx) => idx !== i))}
                      className="p-1 rounded-lg transition-colors hover:bg-red-50"
                      style={{ color: '#c4a090' }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {CHILD_AGE_OPTIONS.map(age => {
                      const months = AGE_LABEL_TO_MONTHS[age] ?? 0;
                      const sel = child.age_months === months;
                      return (
                        <button
                          key={age}
                          type="button"
                          onClick={() => setChildren(prev => prev.map((c, idx) => idx === i ? { ...c, age_months: months } : c))}
                          className="py-2 px-2 rounded-xl border text-xs font-medium transition-all"
                          style={{
                            borderColor: sel ? 'var(--brand)' : 'var(--border-color)',
                            background: sel ? 'var(--brand-light)' : 'white',
                            color: sel ? 'var(--brand)' : '#5a4035',
                          }}
                        >{age}</button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setChildren(prev => [...prev, { id: null, age_months: 0 }])}
                className="flex items-center gap-2 text-sm font-medium py-1" style={{ color: 'var(--brand)' }}
              >
                <Plus className="w-4 h-4" /> Add a child
              </button>
            </div>
          </div>
        )}

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
