'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, MapPin, Heart, MessageCircle, Share2, CheckCircle, Trash2, Car, Moon, Tag, Gamepad2, Package, Utensils, Home, BookOpen, Box, ShoppingBag, Pencil, X, ImagePlus, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { DbListing, DbProfile } from '@/lib/types';
import { getCategoryStyle, formatLocation } from '@/lib/utils';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Travel: Car, Sleep: Moon, Clothing: Tag, Toys: Gamepad2,
  Gear: Package, Feeding: Utensils, Furniture: Home, Education: BookOpen, Miscellaneous: Box,
};

const EDIT_CATEGORIES = ['Travel', 'Sleep', 'Clothing', 'Toys', 'Gear', 'Feeding', 'Furniture', 'Education', 'Miscellaneous'];
const EDIT_CONDITIONS: { label: string; value: string }[] = [
  { label: 'Like new', value: 'new' },
  { label: 'Excellent condition', value: 'excellent' },
  { label: 'Good condition', value: 'good' },
  { label: 'Fair condition', value: 'fair' },
  { label: 'Poor condition', value: 'poor' },
];

export interface ListingSnap {
  id: string;
  title: string;
  price: number;
  condition: string;
  category: string;
  image_url: string;
}

interface ListingDetailViewProps {
  listingId: string;
  onBack: () => void;
  onMessage: (sellerUserId: string, listing: ListingSnap) => void;
}

type FullListing = DbListing & { profiles: DbProfile | null };

export default function ListingDetailView({ listingId, onBack, onMessage }: ListingDetailViewProps) {
  const { user } = useAuth();
  const [listing, setListing] = useState<FullListing | null>(null);
  const [primaryImageUrl, setPrimaryImageUrl] = useState('');
  const [primaryImageId, setPrimaryImageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', price: '', free: false, condition: 'good', category: 'Toys' });
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');
  const editFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('listings')
        .select('*')
        .eq('id', listingId)
        .maybeSingle();

      if (data) {
        const [profileRes, imageRes, saveRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', data.seller_id).maybeSingle(),
          supabase.from('listing_images').select('id, url').eq('listing_id', listingId).order('position', { ascending: true }).limit(1).maybeSingle(),
          user ? supabase.from('listing_saves').select('listing_id').eq('listing_id', listingId).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
        ]);

        setListing({ ...data, profiles: profileRes.data ?? null } as FullListing);
        setPrimaryImageUrl(imageRes.data?.url ?? '');
        setPrimaryImageId(imageRes.data?.id ?? null);
        setSaved(!!saveRes.data);
      }
      setLoading(false);
    }
    load();
  }, [listingId, user]);

  async function toggleSave() {
    if (!user || !listing) return;
    if (saved) {
      await supabase.from('listing_saves').delete().eq('listing_id', listing.id).eq('user_id', user.id);
    } else {
      await supabase.from('listing_saves').insert({ listing_id: listing.id, user_id: user.id });
    }
    setSaved(s => !s);
  }

  async function markSold() {
    if (!listing) return;
    await supabase.from('listings').update({ status: 'sold' }).eq('id', listing.id);
    setListing(l => l ? { ...l, status: 'sold' } : l);
  }

  async function handleDelete() {
    if (!listing) return;
    setDeleting(true);
    await supabase.from('listings').delete().eq('id', listing.id);
    onBack();
  }

  function openEdit() {
    if (!listing) return;
    const priceInPounds = listing.price_pence / 100;
    setEditForm({
      title: listing.title,
      description: listing.description || '',
      price: priceInPounds === 0 ? '' : priceInPounds.toFixed(2),
      free: priceInPounds === 0,
      condition: listing.condition,
      category: listing.category,
    });
    setEditImageFile(null);
    setEditImagePreview('');
    setEditError('');
    setShowEdit(true);
  }

  async function uploadEditImage(file: File): Promise<string> {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${user!.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('listing-images').upload(path, file, { upsert: false });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(path);
    return publicUrl;
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!listing || !user) return;
    setEditSubmitting(true);
    setEditError('');

    // Upload new image if provided
    let newImageUrl = '';
    if (editImageFile) {
      try { newImageUrl = await uploadEditImage(editImageFile); }
      catch { /* keep existing */ }
    }

    const priceInPounds = editForm.free ? 0 : Math.round(parseFloat(editForm.price || '0') * 100) / 100;

    const { error } = await supabase.from('listings').update({
      title: editForm.title,
      description: editForm.description,
      price_pence: priceInPounds * 100,
      condition: editForm.condition,
      category: editForm.category,
    }).eq('id', listing.id);

    if (!error && newImageUrl) {
      if (primaryImageId) {
        await supabase.from('listing_images').update({ url: newImageUrl }).eq('id', primaryImageId);
      } else {
        await supabase.from('listing_images').insert({ listing_id: listing.id, url: newImageUrl, position: 0 });
      }
      setPrimaryImageUrl(newImageUrl);
    }

    setEditSubmitting(false);
    if (!error) {
      setListing(l => l ? {
        ...l,
        title: editForm.title,
        description: editForm.description,
        price_pence: priceInPounds * 100,
        condition: editForm.condition,
        category: editForm.category,
      } : l);
      setShowEdit(false);
    } else {
      setEditError(error.message || 'Failed to update listing.');
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto pb-32 lg:pb-8 animate-pulse">
        <div className="w-full h-72 lg:h-96" style={{ background: '#e8e4de', borderRadius: '0 0 1.25rem 1.25rem' }} />
        <div className="px-4 py-5 space-y-4">
          <div className="h-6 rounded" style={{ background: '#e8e4de', width: '60%' }} />
          <div className="h-4 rounded" style={{ background: '#e8e4de', width: '40%' }} />
          <div className="h-20 rounded" style={{ background: '#e8e4de' }} />
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-sm" style={{ color: '#9a8070' }}>Listing not found.</p>
        <button onClick={onBack} className="btn-brand mt-4 text-sm">Go back</button>
      </div>
    );
  }

  const isSold = listing.status === 'sold';
  const isOwner = user?.id === listing.seller_id;
  const seller = listing.profiles;
  const hasRealImage = !!primaryImageUrl;
  const priceInPounds = listing.price_pence / 100;
  const sellerName = seller?.first_name || 'Community Member';
  const sellerNeighborhood = seller?.postcode_district
    ? formatLocation(seller.postcode_district)
    : '';
  const sellerAvatar = seller?.avatar_url || '';
  const catStyle = getCategoryStyle(listing.category);
  const CategoryIcon = CATEGORY_ICONS[listing.category] ?? ShoppingBag;

  return (
    <div className="max-w-2xl mx-auto pb-32 lg:pb-8">
      {/* Image / placeholder */}
      <div className="relative">
        {hasRealImage ? (
          <img
            src={primaryImageUrl}
            alt={listing.title}
            className={`w-full h-72 lg:h-96 object-cover ${isSold ? 'opacity-70' : ''}`}
            style={{ borderRadius: '0 0 1.25rem 1.25rem' }}
          />
        ) : (
          <div
            className={`w-full h-72 lg:h-96 flex flex-col items-center justify-center gap-4 ${isSold ? 'opacity-70' : ''}`}
            style={{ background: catStyle.bg, borderRadius: '0 0 1.25rem 1.25rem' }}
          >
            <CategoryIcon className="w-20 h-20" style={{ color: catStyle.color, opacity: 0.75 }} />
            <span className="text-sm font-semibold" style={{ color: catStyle.color }}>{listing.category}</span>
          </div>
        )}

        {isSold && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ borderRadius: '0 0 1.25rem 1.25rem', background: 'rgba(0,0,0,0.3)' }}>
            <span className="text-xl font-bold text-white px-5 py-2 rounded-full" style={{ background: '#374151' }}>Sold</span>
          </div>
        )}

        <button
          onClick={onBack}
          className="absolute top-4 left-4 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)' }}
        >
          <ArrowLeft className="w-5 h-5" style={{ color: '#2a1f18' }} />
        </button>

        {!isOwner && !isSold && (
          <button
            onClick={toggleSave}
            className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)' }}
          >
            <Heart className="w-5 h-5" style={{ color: saved ? '#E53E3E' : '#9a8070' }} fill={saved ? '#E53E3E' : 'none'} />
          </button>
        )}
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* Price & title */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold mb-1" style={{ color: '#2a1f18' }}>{listing.title}</h1>
            <div className="flex items-center gap-2">
              <span className="tag-sprout" style={{ background: '#FFF7ED', color: '#D97706' }}>{listing.condition}</span>
              <span className="tag-sprout" style={{ background: '#f4f3f0', color: '#7a6055' }}>{listing.category}</span>
              {isSold && (
                <span className="tag-sprout" style={{ background: '#f3f4f6', color: '#374151' }}>Sold</span>
              )}
            </div>
          </div>
          <span className="text-2xl font-bold" style={{ color: isSold ? '#9a8070' : (priceInPounds === 0 ? '#16a34a' : 'var(--brand)') }}>
            {priceInPounds === 0 ? 'Free' : `£${priceInPounds.toFixed(2)}`}
          </span>
        </div>

        {/* Seller card */}
        <div className="card-sprout p-4 flex items-center gap-3">
          {sellerAvatar ? (
            <img src={sellerAvatar} alt={sellerName} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0" style={{ background: 'var(--brand)' }}>
              {sellerName.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold" style={{ color: '#2a1f18' }}>{isOwner ? 'Your listing' : sellerName}</p>
            <div className="flex items-center gap-2 text-xs" style={{ color: '#9a8070' }}>
              {sellerNeighborhood && (
                <>
                  <MapPin className="w-3 h-3" />{sellerNeighborhood}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {listing.description && (
          <div>
            <h3 className="font-semibold mb-2" style={{ color: '#2a1f18' }}>Description</h3>
            <p className="text-sm leading-relaxed" style={{ color: '#5a4035', lineHeight: 1.65 }}>{listing.description}</p>
          </div>
        )}

        {/* Owner actions */}
        {isOwner && !isSold && (
          <div className="space-y-2 pt-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#b8a090' }}>Manage your listing</p>
            <div className="flex gap-2">
              <button
                onClick={openEdit}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all hover:opacity-80"
                style={{ borderColor: 'var(--brand)', color: 'var(--brand)', background: 'var(--brand-light)' }}
              >
                <Pencil className="w-4 h-4" /> Edit
              </button>
              <button
                onClick={markSold}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all hover:opacity-80"
                style={{ borderColor: '#16a34a', color: '#16a34a', background: '#f0fdf4' }}
              >
                <CheckCircle className="w-4 h-4" /> Mark Sold
              </button>
              {confirmDelete ? (
                <div className="flex gap-1.5">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2.5 rounded-xl font-semibold text-sm transition-opacity hover:opacity-80"
                    style={{ background: '#ef4444', color: 'white' }}
                  >
                    {deleting ? 'Deleting…' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-4 py-2.5 rounded-xl border font-semibold text-sm"
                    style={{ borderColor: 'var(--border-color)', color: '#7a6055', background: 'white' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all hover:opacity-80"
                  style={{ borderColor: '#fecaca', color: '#ef4444', background: '#FEF2F2' }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* CTA bar — only for non-owners on active listings */}
      {!isOwner && !isSold && (
        <div
          className="fixed bottom-0 left-0 right-0 lg:static px-4 py-4 flex gap-3 border-t lg:border-0 lg:px-4"
          style={{ background: 'var(--bg)', borderColor: 'var(--border-color)' }}
        >
          <button
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold text-sm"
            style={{ borderColor: 'var(--brand)', color: 'var(--brand)', background: 'var(--brand-light)' }}
          >
            <Share2 className="w-4 h-4" /> Share
          </button>
          <button
            onClick={() => listing.seller_id && onMessage(listing.seller_id, {
              id: listing.id,
              title: listing.title,
              price: priceInPounds,
              condition: listing.condition,
              category: listing.category,
              image_url: primaryImageUrl,
            })}
            className="btn-brand flex-1 text-sm gap-2"
          >
            <MessageCircle className="w-4 h-4" /> Message Seller
          </button>
        </div>
      )}

      {/* Sold state CTA */}
      {!isOwner && isSold && (
        <div
          className="fixed bottom-0 left-0 right-0 lg:static px-4 py-4 lg:px-4"
          style={{ background: 'var(--bg)', borderTop: '1px solid var(--border-color)' }}
        >
          <div className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm" style={{ background: '#f3f4f6', color: '#6b7280' }}>
            <CheckCircle className="w-4 h-4" /> This item has been sold
          </div>
        </div>
      )}

      {/* Edit modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full lg:max-w-lg rounded-t-2xl lg:rounded-2xl overflow-hidden flex flex-col" style={{ background: 'white', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <h2 className="text-lg font-bold" style={{ color: '#2a1f18' }}>Edit listing</h2>
              <button onClick={() => setShowEdit(false)} style={{ color: '#9a8070' }}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEditSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {editError && <p className="text-sm text-red-500">{editError}</p>}

              {/* Image */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: '#7a6055' }}>Photo</p>
                {(() => {
                  const editCurrentImg = editImagePreview || primaryImageUrl;
                  const EditCategoryIcon = CATEGORY_ICONS[editForm.category] ?? ShoppingBag;
                  const editCatStyle = { bg: 'var(--brand-light)', color: 'var(--brand)' };
                  return (
                    <button type="button" onClick={() => editFileRef.current?.click()}
                      className="w-full h-36 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors hover:opacity-80 overflow-hidden"
                      style={{ borderColor: 'var(--border-color)', background: editCurrentImg ? 'transparent' : editCatStyle.bg }}>
                      {editCurrentImg ? (
                        <img src={editCurrentImg} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <EditCategoryIcon className="w-10 h-10" style={{ color: editCatStyle.color }} />
                          <span className="text-xs font-medium" style={{ color: editCatStyle.color }}>Tap to add a photo</span>
                        </>
                      )}
                    </button>
                  );
                })()}
                <input ref={editFileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setEditImageFile(f);
                    const r = new FileReader();
                    r.onloadend = () => setEditImagePreview(r.result as string);
                    r.readAsDataURL(f);
                  }} />
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#7a6055' }}>Title</label>
                <input required className="w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: 'var(--border-color)' }}
                  value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#7a6055' }}>Category</label>
                <select className="w-full rounded-xl border px-3 py-2.5 text-sm" style={{ borderColor: 'var(--border-color)' }}
                  value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
                  {EDIT_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              {/* Condition */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#7a6055' }}>Condition</label>
                <div className="flex flex-wrap gap-2">
                  {EDIT_CONDITIONS.map(c => (
                    <button type="button" key={c.value}
                      onClick={() => setEditForm(f => ({ ...f, condition: c.value }))}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
                      style={editForm.condition === c.value
                        ? { background: 'var(--brand)', color: 'white', borderColor: 'var(--brand)' }
                        : { background: 'white', color: '#5a4035', borderColor: 'var(--border-color)' }}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#7a6055' }}>Price</label>
                <div className="flex items-center gap-3 mb-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={editForm.free} onChange={e => setEditForm(f => ({ ...f, free: e.target.checked, price: '' }))} />
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>Free</span>
                  </label>
                </div>
                {!editForm.free && (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: '#9a8070' }}>£</span>
                    <input type="text" inputMode="numeric" min="0" className="w-full rounded-xl border pl-7 pr-3 py-2.5 text-sm" style={{ borderColor: 'var(--border-color)' }}
                      value={editForm.price}
                      onChange={e => {
                        const digits = e.target.value.replace(/\D/g, '');
                        const pence = parseInt(digits || '0', 10);
                        setEditForm(f => ({ ...f, price: (pence / 100).toFixed(2) }));
                      }}
                      placeholder="0.00" />
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#7a6055' }}>Description</label>
                <textarea rows={3} className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none" style={{ borderColor: 'var(--border-color)' }}
                  value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <button type="submit" disabled={editSubmitting}
                className="btn-brand w-full text-sm flex items-center justify-center gap-2">
                {editSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
