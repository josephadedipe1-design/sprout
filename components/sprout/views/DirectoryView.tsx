'use client';

import { useState, useEffect, useCallback } from 'react';
import { BookOpen, MapPin, Phone, Mail, Globe, BadgeCheck, Loader2, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { haversineKm, kmToMiles, formatLocation, objectPosition } from '@/lib/utils';
import type { DbServiceListing } from '@/lib/types';

const DIRECTORY_RADIUS_MILES = 10;

const CATEGORIES: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pregnancy_birth', label: 'Pregnancy & Birth' },
  { id: 'health_wellbeing', label: 'Health & Wellbeing' },
  { id: 'childcare', label: 'Childcare' },
  { id: 'classes_activities', label: 'Classes & Activities' },
  { id: 'home_family', label: 'Home & Family' },
  { id: 'education_development', label: 'Education & Development' },
];

const CATEGORY_STYLES: Record<string, { bg: string; color: string }> = {
  pregnancy_birth:         { bg: '#FCE7F3', color: '#9D174D' },
  health_wellbeing:        { bg: '#DBEAFE', color: '#1E40AF' },
  childcare:               { bg: '#FEF3C7', color: '#92400E' },
  classes_activities:      { bg: '#DCFCE7', color: '#166534' },
  home_family:             { bg: '#FFEDD5', color: '#9A3412' },
  education_development:   { bg: '#ECFDF5', color: '#065F46' },
};

function categoryLabel(id: string): string {
  return CATEGORIES.find(c => c.id === id)?.label ?? id;
}

function categoryStyle(id: string): { bg: string; color: string } {
  return CATEGORY_STYLES[id] ?? { bg: '#f4f3f0', color: '#7a6055' };
}

interface DirectoryViewProps {
  onBack?: () => void;
}

export default function DirectoryView({ }: DirectoryViewProps) {
  const { user, profile } = useAuth();
  const [listings, setListings] = useState<DbServiceListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadListings = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('service_listings')
      .select('*')
      .eq('status', 'active')
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false });

    if (error || !data) {
      setLoading(false);
      return;
    }

    const myLat = profile?.lat ?? null;
    const myLng = profile?.lng ?? null;

    const filtered = (data as DbServiceListing[]).filter((l) => {
      if (!l.lat || !l.lng) return false;
      if (!myLat || !myLng) return true;
      const distMiles = kmToMiles(haversineKm(myLat, myLng, l.lat, l.lng));
      return distMiles <= DIRECTORY_RADIUS_MILES;
    });

    setListings(filtered);
    setLoading(false);
  }, [user, profile]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const visible = listings.filter((l) => {
    if (activeCategory !== 'all' && l.category !== activeCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        l.business_name.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.postcode_district.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 lg:pb-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#2a1f18' }}>Directory</h1>
          <p className="text-sm" style={{ color: '#9a8070' }}>Local services for parents nearby</p>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand-light)' }}>
          <BookOpen className="w-5 h-5" style={{ color: 'var(--brand)' }} />
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#b8a090' }} />
        <input
          className="input-sprout w-full text-sm"
          placeholder="Search services, businesses…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ paddingLeft: '2.5rem' }}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-5 -mx-4 px-4">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="flex-shrink-0 text-sm font-medium px-4 py-1.5 rounded-full transition-all"
              style={{
                background: isActive ? 'var(--brand)' : 'white',
                color: isActive ? 'white' : '#7a6055',
                border: `1px solid ${isActive ? 'var(--brand)' : 'var(--border-color)'}`,
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-14">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--brand)' }} />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center text-center py-14">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--brand-light)' }}>
            <BookOpen className="w-7 h-7" style={{ color: 'var(--brand)' }} />
          </div>
          <p className="text-base font-semibold mb-1" style={{ color: '#2a1f18' }}>No services found nearby</p>
          <p className="text-sm" style={{ color: '#9a8070' }}>
            {searchQuery.trim() ? 'Try a different search term.' : 'Check back soon — new services are being added.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((listing) => {
            const catStyle = categoryStyle(listing.category);
            return (
              <article key={listing.id} className="card-sprout overflow-hidden">
                {listing.image_url ? (
                  <img
                    src={listing.image_url}
                    alt={listing.business_name}
                    className="w-full h-36 object-cover"
                    style={{ objectPosition: objectPosition(50, 50) }}
                  />
                ) : (
                  <div className="w-full h-28 flex items-center justify-center" style={{ background: catStyle.bg }}>
                    <BookOpen className="w-10 h-10" style={{ color: catStyle.color, opacity: 0.6 }} />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-base font-bold" style={{ color: '#2a1f18' }}>{listing.business_name}</h3>
                      {listing.verified && (
                        <BadgeCheck className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--brand)' }} />
                      )}
                    </div>
                    {listing.featured && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>
                        Featured
                      </span>
                    )}
                  </div>

                  <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full mb-2.5" style={{ background: catStyle.bg, color: catStyle.color }}>
                    {categoryLabel(listing.category)}
                  </span>

                  {listing.description && (
                    <p className="text-sm leading-relaxed mb-3" style={{ color: '#5a4035', lineHeight: 1.6 }}>
                      {listing.description}
                    </p>
                  )}

                  <div className="flex items-center gap-1 text-xs mb-3" style={{ color: '#9a8070' }}>
                    <MapPin className="w-3 h-3" />
                    {formatLocation(listing.postcode_district)}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {listing.phone && (
                      <a href={`tel:${listing.phone}`} className="flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--brand)' }}>
                        <Phone className="w-3.5 h-3.5" /> Call
                      </a>
                    )}
                    {listing.email && (
                      <a href={`mailto:${listing.email}`} className="flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70" style={{ color: 'var(--brand)' }}>
                        <Mail className="w-3.5 h-3.5" /> Email
                      </a>
                    )}
                    {listing.website && (
                      <a
                        href={listing.website.startsWith('http') ? listing.website : `https://${listing.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
                        style={{ color: 'var(--brand)' }}
                      >
                        <Globe className="w-3.5 h-3.5" /> Website
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
