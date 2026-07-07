'use client';

import dynamic from 'next/dynamic';
import type { DbProfile } from '@/lib/types';

const UKMapInner = dynamic(() => import('./UKMapInner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" style={{ background: '#f0ece5', borderRadius: 'inherit' }}>
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-2" style={{ borderColor: 'var(--brand)', borderTopColor: 'transparent' }} />
        <p className="text-xs" style={{ color: '#9a8070' }}>Loading map…</p>
      </div>
    </div>
  ),
});

export interface UKMapProps {
  profiles: (DbProfile & { lat?: number | null; lng?: number | null })[];
  center?: [number, number];
  zoom?: number;
  currentUserId?: string;
  onPinClick?: (profile: DbProfile) => void;
}

export default function UKMap(props: UKMapProps) {
  return <UKMapInner {...props} />;
}
