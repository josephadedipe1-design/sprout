'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { BookOpen, ArrowLeft, Plus, Pencil, Loader2, CheckCircle, X, ImagePlus, Trash2, Power, PowerOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatLocation, objectPosition } from '@/lib/utils';
import type { DbServiceListing } from '@/lib/types';

const ADMIN_ID = '4848415f-2bbe-409a-8443-eb925b0b88e8';

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'pregnancy_birth', label: 'Pregnancy & Birth' },
  { id: 'health_wellbeing', label: 'Health & Wellbeing' },
  { id: 'childcare', label: 'Childcare' },
  { id: 'classes_activities', label: 'Classes & Activities' },
  { id: 'home_family', label: 'Home & Family' },
  { id: 'education_development', label: 'Education & Development' },
];

interface DirectoryAdminViewProps {
  onBack: () => void;
}

interface FormState {
  business_name: string;
  category: string;
  description: string;
  phone: string;
  email: string;
  website: string;
  postcode_district: string;
  verified: boolean;
  featured: boolean;
}

const EMPTY_FORM: FormState = {
  business_name: '',
  category: 'pregnancy_birth',
  description: '',
  phone: '',
  email: '',
  website: '',
  postcode_district: '',
  verified: false,
  featured: false,
};

export default function DirectoryAdminView({ onBack }: DirectoryAdminViewProps) {
  const { user } = useAuth();
  const [listings, setListings] = useState<DbServiceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadListings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('service_listings')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      setListings(data as DbServiceListing[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

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

  async function geocodeOutcode(outcode: string): Promise<{ lat: number; lng: number } | null> {
    const clean = outcode.trim().toUpperCase();
    if (!clean) return null;
    try {
      const res = await fetch(`https://api.postcodes.io/outcodes/${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (data.status === 200 && data.result) {
        return { lat: data.result.latitude, lng: data.result.longitude };
      }
    } catch { /* non-fatal */ }
    return null;
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `directory-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('service-listing-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      const { data: pub } = supabase.storage.from('service-listing-images').getPublicUrl(fileName);
      setImageUrl(pub.publicUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to upload image.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function openCreateForm() {
    setForm(EMPTY_FORM);
    setImageUrl('');
    setEditingId(null);
    setError('');
    setSuccess('');
    setShowForm(true);
  }

  function openEditForm(listing: DbServiceListing) {
    setForm({
      business_name: listing.business_name,
      category: listing.category,
      description: listing.description,
      phone: listing.phone || '',
      email: listing.email || '',
      website: listing.website || '',
      postcode_district: listing.postcode_district,
      verified: listing.verified,
      featured: listing.featured,
    });
    setImageUrl(listing.image_url || '');
    setEditingId(listing.id);
    setError('');
    setSuccess('');
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.business_name.trim() || !form.postcode_district.trim()) {
      setError('Business name and postcode district are required.');
      return;
    }
    setSaving(true);
    setError('');

    const outcode = form.postcode_district.trim().toUpperCase();
    let lat = listings.find(l => l.id === editingId)?.lat ?? null;
    let lng = listings.find(l => l.id === editingId)?.lng ?? null;

    if (!lat || !lng || (listings.find(l => l.id === editingId)?.postcode_district || '').toUpperCase() !== outcode) {
      setGeocoding(true);
      const coords = await geocodeOutcode(outcode);
      setGeocoding(false);
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
      } else {
        lat = null;
        lng = null;
      }
    }

    const payload: Record<string, unknown> = {
      business_name: form.business_name.trim(),
      category: form.category,
      description: form.description.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      website: form.website.trim() || null,
      postcode_district: outcode,
      lat,
      lng,
      image_url: imageUrl || null,
      verified: form.verified,
      featured: form.featured,
      created_by: user!.id,
    };

    if (editingId) {
      const { error: updateError } = await supabase
        .from('service_listings')
        .update(payload)
        .eq('id', editingId);
      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
      setSuccess('Listing updated successfully.');
    } else {
      const { error: insertError } = await supabase
        .from('service_listings')
        .insert(payload);
      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
      setSuccess('Listing created successfully.');
    }

    setSaving(false);
    setShowForm(false);
    setForm(EMPTY_FORM);
    setImageUrl('');
    setEditingId(null);
    loadListings();
    setTimeout(() => setSuccess(''), 4000);
  }

  async function toggleStatus(listing: DbServiceListing) {
    const newStatus = listing.status === 'active' ? 'inactive' : 'active';
    await supabase.from('service_listings').update({ status: newStatus }).eq('id', listing.id);
    loadListings();
  }

  async function handleDelete(listing: DbServiceListing) {
    if (!confirm(`Delete "${listing.business_name}"? This cannot be undone.`)) return;
    await supabase.from('service_listings').delete().eq('id', listing.id);
    loadListings();
  }

  if (showForm) {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6 pb-24 lg:pb-6">
        <button onClick={() => setShowForm(false)} className="flex items-center gap-2 text-sm font-medium mb-5 hover:opacity-70 transition-opacity" style={{ color: '#7a6055' }}>
          <ArrowLeft className="w-4 h-4" /> Back to listings
        </button>

        <div className="card-sprout p-6">
          <h1 className="text-lg font-bold mb-5" style={{ color: '#2a1f18' }}>
            {editingId ? 'Edit Listing' : 'New Directory Listing'}
          </h1>

          {error && (
            <div className="mb-4 p-3 rounded-xl" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
              <p className="text-sm font-medium" style={{ color: '#DC2626' }}>{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#3a2820' }}>Business name *</label>
              <input
                className="input-sprout w-full text-sm"
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                placeholder="e.g. Little Stars Baby Massage"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#3a2820' }}>Category *</label>
              <select
                className="input-sprout w-full text-sm"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#3a2820' }}>Description</label>
              <textarea
                className="input-sprout w-full text-sm resize-none"
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Short description of the service…"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#3a2820' }}>Postcode district * <span className="font-normal" style={{ color: '#9a8070' }}>(outcode only, e.g. ME5)</span></label>
              <input
                className="input-sprout w-full text-sm uppercase"
                value={form.postcode_district}
                onChange={(e) => setForm({ ...form, postcode_district: e.target.value.toUpperCase() })}
                placeholder="ME5"
                style={{ paddingLeft: '0.75rem' }}
              />
              {geocoding && <p className="text-xs mt-1" style={{ color: '#9a8070' }}>Geocoding postcode…</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#3a2820' }}>Phone</label>
                <input
                  className="input-sprout w-full text-sm"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="020 1234 5678"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1.5" style={{ color: '#3a2820' }}>Email</label>
                <input
                  className="input-sprout w-full text-sm"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="hello@example.co.uk"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: '#3a2820' }}>Website</label>
              <input
                className="input-sprout w-full text-sm"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                placeholder="https://example.co.uk"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: '#3a2820' }}>Image</label>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              {imageUrl ? (
                <div className="relative inline-block">
                  <img src={imageUrl} alt="Preview" className="rounded-xl max-h-32 object-cover" style={{ border: '1px solid var(--border-color)' }} />
                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-md"
                    style={{ background: '#DC2626', color: 'white' }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', color: '#7a6055' }}
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                  {uploading ? 'Uploading…' : 'Add image'}
                </button>
              )}
            </div>

            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer" style={{ color: '#3a2820' }}>
                <input
                  type="checkbox"
                  checked={form.verified}
                  onChange={(e) => setForm({ ...form, verified: e.target.checked })}
                  className="w-4 h-4"
                />
                Verified
              </label>
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer" style={{ color: '#3a2820' }}>
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                  className="w-4 h-4"
                />
                Featured
              </label>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !form.business_name.trim() || !form.postcode_district.trim()}
              className="btn-brand w-full flex items-center justify-center gap-2"
              style={{ opacity: saving || !form.business_name.trim() || !form.postcode_district.trim() ? 0.5 : 1 }}
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : editingId ? 'Save Changes' : 'Create Listing'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 pb-24 lg:pb-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium mb-5 hover:opacity-70 transition-opacity" style={{ color: '#7a6055' }}>
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand)' }}>
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: '#2a1f18' }}>Directory Admin</h1>
            <p className="text-xs" style={{ color: '#9a8070' }}>Manage local service listings</p>
          </div>
        </div>
        <button onClick={openCreateForm} className="btn-brand text-sm flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> New
        </button>
      </div>

      {success && (
        <div className="mb-4 p-3 rounded-xl flex items-center gap-2" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <CheckCircle className="w-4 h-4" style={{ color: '#16A34A' }} />
          <p className="text-sm font-medium" style={{ color: '#15803D' }}>{success}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-14">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--brand)' }} />
        </div>
      ) : listings.length === 0 ? (
        <div className="card-sprout p-8 text-center">
          <p className="text-sm font-medium mb-4" style={{ color: '#9a8070' }}>No directory listings yet.</p>
          <button onClick={openCreateForm} className="btn-brand text-sm flex items-center gap-1.5 mx-auto">
            <Plus className="w-4 h-4" /> Create your first listing
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => (
            <div key={listing.id} className="card-sprout p-4">
              <div className="flex items-start gap-3">
                {listing.image_url ? (
                  <img src={listing.image_url} alt={listing.business_name} className="w-12 h-12 rounded-full object-cover flex-shrink-0" style={{ objectPosition: objectPosition(50, 50) }} />
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface)' }}>
                    <BookOpen className="w-6 h-6" style={{ color: '#c4a090' }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <h3 className="text-sm font-bold truncate" style={{ color: '#2a1f18' }}>{listing.business_name}</h3>
                    {listing.verified && <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--brand)' }} />}
                  </div>
                  <p className="text-xs mb-1" style={{ color: '#9a8070' }}>
                    {formatLocation(listing.postcode_district)}
                    {listing.featured && <span className="ml-2 font-semibold" style={{ color: 'var(--brand)' }}>Featured</span>}
                  </p>
                  <span
                    className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{
                      background: listing.status === 'active' ? '#ECFDF5' : '#F5F0EC',
                      color: listing.status === 'active' ? '#166534' : '#7a6055',
                    }}
                  >
                    {listing.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <button onClick={() => openEditForm(listing)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-orange-50" style={{ color: '#7a6055' }}>
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => toggleStatus(listing)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-orange-50" style={{ color: listing.status === 'active' ? '#92400E' : '#166534' }}>
                  {listing.status === 'active' ? <><PowerOff className="w-3.5 h-3.5" /> Deactivate</> : <><Power className="w-3.5 h-3.5" /> Activate</>}
                </button>
                <button onClick={() => handleDelete(listing)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-red-50 ml-auto" style={{ color: '#DC2626' }}>
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
