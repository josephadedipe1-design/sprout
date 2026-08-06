'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Check, Loader2, Move } from 'lucide-react';

interface ImageRepositionerProps {
  src: string;
  initialX?: number;
  initialY?: number;
  shape: 'circle' | 'rect';
  aspectRatio?: number;
  onSave: (x: number, y: number) => Promise<void>;
  onClose: () => void;
}

export default function ImageRepositioner({ src, initialX = 50, initialY = 50, shape, aspectRatio = 1, onSave, onClose }: ImageRepositionerProps) {
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImgNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = src;
  }, [src]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPos({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  }, [dragging]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setDragging(false);
    try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(Math.round(pos.x), Math.round(pos.y));
    } finally {
      setSaving(false);
    }
  }

  const frameStyle: React.CSSProperties = shape === 'circle'
    ? { width: '100%', aspectRatio: '1 / 1', borderRadius: '50%', overflow: 'hidden', position: 'relative', cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }
    : { width: '100%', aspectRatio: `${aspectRatio} / 1`, borderRadius: '0.75rem', overflow: 'hidden', position: 'relative', cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(42,31,24,0.5)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl" style={{ background: 'white' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center gap-2">
            <Move className="w-4 h-4" style={{ color: 'var(--brand)' }} />
            <h2 className="text-base font-bold" style={{ color: '#2a1f18' }}>Reposition photo</h2>
          </div>
          <button onClick={onClose} className="transition-opacity hover:opacity-60">
            <X className="w-5 h-5" style={{ color: '#9a8070' }} />
          </button>
        </div>

        {/* Frame */}
        <div className="p-5">
          <div
            ref={frameRef}
            style={frameStyle}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <img
              ref={imgRef}
              src={src}
              alt="Reposition"
              draggable={false}
              className="w-full h-full select-none pointer-events-none"
              style={{ objectFit: 'cover', objectPosition: `${pos.x}% ${pos.y}%` }}
            />
            {/* Crosshair overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-white/70 flex items-center justify-center" style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.2)' }}>
                <div className="w-1 h-1 rounded-full bg-white/80" />
              </div>
            </div>
          </div>

          <p className="text-xs mt-3 text-center" style={{ color: '#9a8070' }}>
            Drag the image to set its focal point. This controls how it&apos;s cropped everywhere it appears.
          </p>

          {/* Actions */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border font-semibold text-sm transition-opacity hover:opacity-80"
              style={{ borderColor: 'var(--border-color)', color: '#7a6055', background: 'white' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
              style={{ background: 'var(--brand)', color: 'white' }}
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Check className="w-4 h-4" /> Save</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
