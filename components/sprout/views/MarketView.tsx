'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, MapPin, Heart, X, ChevronDown, ShoppingBag, CheckCircle, Trash2, ImagePlus, Loader2, Car, Moon, Tag, Gamepad2, Package, Utensils, Home, BookOpen, Box } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { DbListing } from '@/lib/types';
import { getCategoryStyle, formatLocation } from '@/lib/utils';

const DEMO_LISTINGS: never[] = [];

const CATEGORIES = ['All', 'Free', 'Travel', 'Sleep', 'Clothing', 'Toys', 'Gear', 'Feeding', 'Furniture', 'Education', 'Miscellaneous'];
const CONDITIONS: { label: string; value: string }[] = [
  { label: 'Like new', value: 'new' },
  { label: 'Excellent condition', value: 'excellent' },
  { label: 'Good condition', value: 'good' },
  { label: 'Fair condition', value: 'fair' },
  { label: 'Poor condition', value: 'poor' },
];
const PLACEHOLDER_IMG = 'https://images.pexels.com/photos/1148998/pexels-photo-1148998.jpeg';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Travel: Car, Sleep: Moon, Clothing: Tag, Toys: Gamepad2,
  Gear: Package, Feeding: Utensils, Furniture: Home, Education: BookOpen, Miscellaneous: Box,
};

interface DisplayListing {
  id: string; title: string; price: number; condition: string; category: string;
  seller: string; neighborhood: string; postcode_district: string; image: string; saved: boolean;
  sold: boolean; isDb?: boolean; isOwn?: boolean;
}

interface NewListing {
  title: string; category: string; price: string; free: boolean; condition: string; description: string;
}

interface MarketViewProps {
  onOpenListing: (id: string) => void;
  triggerNewListing?: boolean;
  onNewListingTriggered?: () => void;
  triggerOpenListingId?: string | null;
  onTriggerOpenListingHandled?: () => void;
}

export default function MarketView({ onOpenListing, triggerNewListing, onNewListingTriggered, triggerOpenListingId, onTriggerOpenListingHandled }: MarketViewProps) {
  const { user, profile } = useAuth();
  const postcodeDistrict = profile?.postcode_district || '';
  const [dbListings, setDbListings] = useState<DisplayListing[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newListing, setNewListing] = useState<NewListing>({ title: '', category: 'Toys', price: '', free: false, condition: 'good', description: '' });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [listError, setListError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadListings = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) return;

    // Fetch profiles separately
    const sellerIds = Array.from(new Set(data.map((l: any) => l.seller_id).filter(Boolean)));
    const profileMap: Record<string, { first_name: string }> = {};
    if (sellerIds.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, first_name')
        .in('id', sellerIds);
      (profileRows ?? []).forEach((p: any) => { profileMap[p.id] = p; });
    }

    // Fetch first image for each listing
    const listingIds = data.map((l: any) => l.id);
    const imageMap: Record<string, string> = {};
    if (listingIds.length > 0) {
      const { data: imageRows } = await supabase
        .from('listing_images')
        .select('listing_id, url, position')
        .in('listing_id', listingIds)
        .order('position', { ascending: true });
      (imageRows ?? []).forEach((img: any) => {
        if (!imageMap[img.listing_id]) imageMap[img.listing_id] = img.url;
      });
    }

    const { data: myLikes } = await supabase.from('listing_saves').select('listing_id').eq('user_id', user.id);
    const savedIds = new Set((myLikes ?? []).map((l: any) => l.listing_id));

    const mapped: DisplayListing[] = (data as DbListing[]).map(l => ({
      id: l.id, title: l.title, price: l.price_pence / 100, condition: l.condition, category: l.category,
      seller: profileMap[l.seller_id]?.first_name || 'Community Member',
      neighborhood: '',
      postcode_district: l.postcode_district,
      image: imageMap[l.id] || '',
      saved: savedIds.has(l.id), sold: l.status === 'sold',
      isDb: true, isOwn: l.seller_id === user.id,
    }));

    setDbListings(mapped);
  }, [user]);

  useEffect(() => { loadListings(); }, [loadListings]);

  useEffect(() => {
    if (triggerNewListing) {
      openModal();
      onNewListingTriggered?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerNewListing]);

  useEffect(() => {
    if (triggerOpenListingId) {
      onOpenListing(triggerOpenListingId);
      onTriggerOpenListingHandled?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerOpenListingId]);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function uploadImage(file: File): Promise<string> {
    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const path = `${user!.id}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from('listing-images').upload(path, file, { upsert: false });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(path);
    return publicUrl;
  }

  async function toggleSave(listing: DisplayListing) {
    if (!listing.isDb) return;
    if (!user) return;
    if (listing.saved) {
      await supabase.from('listing_saves').delete().eq('listing_id', listing.id).eq('user_id', user.id);
    } else {
      await supabase.from('listing_saves').insert({ listing_id: listing.id, user_id: user.id });
    }
    setDbListings(prev => prev.map(l => l.id === listing.id ? { ...l, saved: !l.saved } : l));
  }

  async function markSold(id: string) {
    await supabase.from('listings').update({ status: 'sold' }).eq('id', id);
    setDbListings(prev => prev.map(l => l.id === id ? { ...l, sold: true } : l));
  }

  async function deleteListing(id: string) {
    await supabase.from('listings').delete().eq('id', id);
    setDbListings(prev => prev.filter(l => l.id !== id));
  }

  async function handleList(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setListError('');

    // Step 1: upload image first if provided
    let imageUrl = '';
    if (imageFile) {
      try { imageUrl = await uploadImage(imageFile); }
      catch { /* proceed without image */ }
    }

    const priceInPounds = newListing.free ? 0 : Math.round(parseFloat(newListing.price || '0') * 100) / 100;

    // Step 2: insert listing (no image_url)
    const { data: inserted, error } = await supabase.from('listings').insert({
      seller_id: user.id,
      title: newListing.title,
      description: newListing.description,
      price_pence: priceInPounds * 100,
      condition: newListing.condition,
      category: newListing.category,
      postcode_district: postcodeDistrict,
      status: 'active',
      offers_welcome: false,
    }).select('id').single();

    if (error) {
      setSubmitting(false);
      setListError(error.message || 'Failed to list item. Please try again.');
      return;
    }

    // Step 3: insert image into listing_images if we have one
    if (imageUrl && inserted?.id) {
      await supabase.from('listing_images').insert({
        listing_id: inserted.id,
        url: imageUrl,
        position: 0,
      });
    }

    setSubmitting(false);

    // Also create a feed post
    const priceStr = priceInPounds === 0 ? 'free' : `£${priceInPounds.toFixed(2)}`;
    await supabase.from('posts').insert({
      author_id: user.id,
      post_type: 'listing',
      body: `Just listed for sale: ${newListing.title} — ${newListing.condition} condition, ${priceStr}.`,
      is_anonymous: false,
      postcode_district: postcodeDistrict,
    });

    setNewListing({ title: '', category: 'Toys', price: '', free: false, condition: 'good', description: '' });
    setImageFile(null);
    setImagePreview('');
    setListError('');
    setShowModal(false);
    await loadListings();
  }

  function openModal() {
    setNewListing({ title: '', category: 'Toys', price: '', free: false, condition: 'good', description: '' });
    setImageFile(null);
    setImagePreview('');
    setListError('');
    setShowModal(true);
  }

  const filtered = dbListings.filter(l => {
    const matchCat = category === 'All' ? true : category === 'Free' ? l.price === 0 : l.category === category;
    return matchCat && (!search || l.title.toLowerCase().includes(search.toLowerCase()));
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24 lg:pb-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#2a1f18' }}>Marketplace</h1>
          <p className="text-sm" style={{ color: '#9a8070' }}>Buy, sell and give away kids&apos; items nearby</p>
        </div>
        <button className="btn-brand text-sm" onClick={openModal}>+ List Item</button>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#c4a090' }} />
          <input className="input-sprout pl-9" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-5 -mx-4 px-4">
        {CATEGORIES.map(c => {
          const isFree = c === 'Free';
          const isActive = category === c;
          return (
            <button key={c} onClick={() => setCategory(c)} className="flex-shrink-0 text-sm font-medium px-4 py-1.5 rounded-full transition-all"
              style={{ background: isActive ? (isFree ? '#16a34a' : 'var(--brand)') : 'white', color: isActive ? 'white' : isFree ? '#16a34a' : '#7a6055', border: `1px solid ${isActive ? (isFree ? '#16a34a' : 'var(--brand)') : isFree ? '#bbf7d0' : 'var(--border-color)'}` }}>
              {c}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {filtered.length === 0 && (
          <div className="col-span-2 sm:col-span-3 flex flex-col items-center text-center py-14">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: '#d6ede3' }}>
              <ShoppingBag className="w-7 h-7" style={{ color: '#2d7a52' }} />
            </div>
            <p className="text-base font-semibold mb-1" style={{ color: '#2a1f18' }}>No items found</p>
            <p className="text-sm mb-5" style={{ color: '#9a8070' }}>
              {search ? `No results for "${search}".` : `Nothing in ${category} yet. Be the first!`}
            </p>
            <button onClick={openModal} className="btn-brand text-sm">+ List an Item</button>
          </div>
        )}
        {filtered.map(listing => {
          const showIcon = !listing.image || listing.image.includes('1148998');
          const catStyle = getCategoryStyle(listing.category);
          const CategoryIcon = CATEGORY_ICONS[listing.category] ?? ShoppingBag;
          return (
          <div key={listing.id} className="card-sprout overflow-hidden cursor-pointer group" onClick={() => listing.isDb ? onOpenListing(listing.id) : undefined}>
            <div className="relative">
              {showIcon ? (
                <div className={`w-full h-40 flex flex-col items-center justify-center gap-2 transition-transform duration-300 group-hover:scale-105 ${listing.sold ? 'opacity-60' : ''}`} style={{ background: catStyle.bg }}>
                  <CategoryIcon className="w-12 h-12" style={{ color: catStyle.color, opacity: 0.75 }} />
                  <span className="text-xs font-semibold" style={{ color: catStyle.color }}>{listing.category}</span>
                </div>
              ) : (
                <img src={listing.image} alt={listing.title} className={`w-full h-40 object-cover transition-transform duration-300 group-hover:scale-105 ${listing.sold ? 'opacity-60' : ''}`} />
              )}
              {listing.sold && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.35)' }}>
                  <span className="text-sm font-bold text-white px-3 py-1 rounded-full" style={{ background: '#374151' }}>Sold</span>
                </div>
              )}
              {listing.isOwn && !listing.sold && (
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <button title="Mark as sold" onClick={() => markSold(listing.id)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.95)', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
                    <CheckCircle className="w-3.5 h-3.5" style={{ color: '#16a34a' }} />
                  </button>
                  <button title="Delete listing" onClick={() => deleteListing(listing.id)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.95)', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}>
                    <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                  </button>
                </div>
              )}
              {!listing.isOwn && !listing.sold && (
                <button className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-colors" style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }} onClick={e => { e.stopPropagation(); toggleSave(listing); }}>
                  <Heart className="w-3.5 h-3.5" style={{ color: listing.saved ? '#E53E3E' : '#c4a090' }} fill={listing.saved ? '#E53E3E' : 'none'} />
                </button>
              )}
              <span className="absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'white', color: '#5a4035' }}>{listing.condition}</span>
              {listing.isOwn && (
                <span className="absolute bottom-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: listing.sold ? '#374151' : 'var(--brand)', color: 'white' }}>
                  {listing.sold ? 'Sold' : 'Your listing'}
                </span>
              )}
            </div>
            <div className="p-3">
              <p className="text-sm font-semibold leading-tight mb-1" style={{ color: listing.sold ? '#9a8070' : '#2a1f18' }}>{listing.title}</p>
              <div className="flex items-center justify-between">
                {listing.price === 0 ? (
                  <span className="text-base font-bold" style={{ color: listing.sold ? '#9a8070' : '#16a34a' }}>Free</span>
                ) : (
                  <span className="text-base font-bold" style={{ color: listing.sold ? '#9a8070' : 'var(--brand)' }}>£{listing.price.toFixed(2)}</span>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs mt-1" style={{ color: '#9a8070' }}>
                <MapPin className="w-3 h-3" />{formatLocation(listing.postcode_district) || listing.seller}
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: 'white' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <h2 className="text-lg font-bold" style={{ color: '#2a1f18' }}>List an Item</h2>
              <button onClick={() => setShowModal(false)} style={{ color: '#9a8070' }}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleList} className="px-5 py-5 space-y-4 overflow-y-auto max-h-[75vh]">
              {listError && (
                <div className="p-3 rounded-xl text-sm font-medium" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
                  {listError}
                </div>
              )}
              {/* Photo upload */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#7a6055' }}>Photo</label>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                {imagePreview ? (
                  <div className="relative rounded-xl overflow-hidden h-40">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreview(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.55)' }}
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors hover:opacity-80"
                    style={{ borderColor: 'var(--border-color)', background: '#faf9f7' }}
                  >
                    <ImagePlus className="w-7 h-7" style={{ color: '#c4a090' }} />
                    <span className="text-sm font-medium" style={{ color: '#9a8070' }}>Tap to add a photo</span>
                    <span className="text-xs" style={{ color: '#c4a090' }}>JPG, PNG or HEIC</span>
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#7a6055' }}>Title</label>
                <input className="input-sprout" placeholder="e.g. Uppababy Vista Stroller" required value={newListing.title} onChange={e => setNewListing(n => ({ ...n, title: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#7a6055' }}>Category</label>
                  <div className="relative">
                    <select className="input-sprout pr-8 appearance-none" value={newListing.category} onChange={e => setNewListing(n => ({ ...n, category: e.target.value }))}>
                      {CATEGORIES.filter(c => c !== 'All' && c !== 'Free').map(c => <option key={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#9a8070' }} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#7a6055' }}>Condition</label>
                  <div className="relative">
                    <select className="input-sprout pr-8 appearance-none" value={newListing.condition} onChange={e => setNewListing(n => ({ ...n, condition: e.target.value }))}>
                      {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#9a8070' }} />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#7a6055' }}>Price</label>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={newListing.free} onChange={e => setNewListing(n => ({ ...n, free: e.target.checked, price: '' }))} className="w-4 h-4 rounded" />
                    <span className="text-sm font-medium" style={{ color: '#16a34a' }}>Give away for free</span>
                  </label>
                  {!newListing.free && (
                    <div className="flex-1 flex rounded-xl border overflow-hidden min-w-[120px]" style={{ borderColor: 'var(--border-color)' }}>
                      <span className="flex items-center px-3 text-sm font-semibold border-r flex-shrink-0" style={{ background: '#f4f3f0', color: '#7a6055', borderColor: 'var(--border-color)' }}>£</span>
                      <input
                        className="flex-1 px-3 py-2.5 text-sm outline-none bg-white"
                        type="text" inputMode="numeric" placeholder="0.00"
                        value={newListing.price}
                        onChange={e => {
                          const digits = e.target.value.replace(/\D/g, '');
                          const pence = parseInt(digits || '0', 10);
                          setNewListing(n => ({ ...n, price: (pence / 100).toFixed(2) }));
                        }}
                        style={{ color: '#2a1f18' }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: '#7a6055' }}>
                  Description <span className="font-normal normal-case" style={{ color: '#b8a090' }}>(optional)</span>
                </label>
                <textarea className="input-sprout resize-none" rows={3} placeholder="Describe the item, any wear, collection details…" value={newListing.description} onChange={e => setNewListing(n => ({ ...n, description: e.target.value }))} />
              </div>

              <button type="submit" className="btn-brand w-full flex items-center justify-center gap-2" disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {submitting ? 'Listing…' : 'List Item'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
