'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { DbProfile } from '@/lib/types';
import { formatName } from '@/lib/utils';

// Fix leaflet's default icon paths broken by webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function brandIcon(initial: string, highlight = false) {
  const bg = highlight ? '#2d7a52' : '#c87e5a';
  return L.divIcon({
    className: '',
    html: `<div style="
      width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      background:${bg};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25);
      display:flex;align-items:center;justify-content:center;
    "><span style="transform:rotate(45deg);color:white;font-weight:700;font-size:13px;line-height:1;font-family:sans-serif">${initial}</span></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38],
  });
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

interface UKMapProps {
  profiles: (DbProfile & { lat?: number | null; lng?: number | null })[];
  center?: [number, number];
  zoom?: number;
  currentUserId?: string;
  onPinClick?: (profile: DbProfile) => void;
}

export default function UKMapInner({ profiles, center, zoom = 11, currentUserId, onPinClick }: UKMapProps) {
  const mapped = profiles.filter(p => p.lat != null && p.lng != null);
  const defaultCenter: [number, number] = center ?? (mapped.length > 0
    ? [mapped[0].lat!, mapped[0].lng!]
    : [52.48, -1.9]); // Birmingham — central UK fallback

  return (
    <MapContainer
      center={defaultCenter}
      zoom={zoom}
      style={{ width: '100%', height: '100%', borderRadius: 'inherit' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {center && <RecenterMap lat={center[0]} lng={center[1]} />}
      {mapped.map(p => (
        <Marker
          key={p.id}
          position={[p.lat!, p.lng!]}
          icon={brandIcon(p.first_name.charAt(0).toUpperCase(), p.id === currentUserId)}
          eventHandlers={onPinClick ? { click: () => onPinClick(p) } : {}}
        >
          <Popup>
            <div style={{ minWidth: 140 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt={p.first_name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#c87e5a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14 }}>
                    {p.first_name.charAt(0)}
                  </div>
                )}
                <div>
                  <p style={{ fontWeight: 700, fontSize: 13, margin: 0, color: '#2a1f18' }}>{p.id === currentUserId ? 'You' : formatName(p.first_name, p.last_initial)}</p>
                  {p.postcode_district && <p style={{ fontSize: 11, color: '#9a8070', margin: 0 }}>{p.postcode_district}</p>}
                </div>
              </div>
              {p.parent_type && <p style={{ fontSize: 11, color: '#7a6055', marginTop: 4, marginBottom: 0, textTransform: 'capitalize' }}>{p.parent_type}</p>}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
