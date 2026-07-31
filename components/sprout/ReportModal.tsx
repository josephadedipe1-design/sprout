'use client';

import { useState } from 'react';
import { Flag, X, Loader2, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export type ReportTarget =
  | { type: 'post'; postId: string; userId?: string }
  | { type: 'message'; messageId: string; userId?: string }
  | { type: 'user'; userId: string };

interface ReportModalProps {
  target: ReportTarget | null;
  open: boolean;
  onClose: () => void;
}

const REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'safety_concern', label: 'Safety concern' },
  { value: 'other', label: 'Other' },
];

export default function ReportModal({ target, open, onClose }: ReportModalProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  if (!open || !target) return null;

  const targetLabel =
    target.type === 'post' ? 'this post'
      : target.type === 'message' ? 'this message'
      : 'this user';

  async function handleSubmit() {
    if (!user || !reason || submitting || !target) return;
    setSubmitting(true);
    setError('');

    const row: Record<string, unknown> = {
      reporter_id: user.id,
      reason,
      details: details.trim() || null,
    };

    if (target.type === 'post') {
      row.reported_post_id = target.postId;
      if (target.userId) row.reported_user_id = target.userId;
    } else if (target.type === 'message') {
      row.reported_message_id = target.messageId;
      if (target.userId) row.reported_user_id = target.userId;
    } else {
      row.reported_user_id = target.userId;
    }

    const { error: insertError } = await supabase.from('reports').insert(row);

    if (insertError) {
      setError('Could not submit report. Please try again.');
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  function handleClose() {
    setReason('');
    setDetails('');
    setError('');
    setSubmitted(false);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(42,31,24,0.4)' }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'white' }}
        onClick={(e) => e.stopPropagation()}
      >
        {submitted ? (
          <div className="p-6 text-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: '#f0fdf4' }}
            >
              <CheckCircle className="w-6 h-6" style={{ color: '#16a34a' }} />
            </div>
            <h2 className="font-semibold text-base mb-1" style={{ color: '#2a1f18' }}>
              Report submitted
            </h2>
            <p className="text-sm mb-5" style={{ color: '#9a8070' }}>
              Thanks, we&apos;ve received your report and will review it.
            </p>
            <button onClick={handleClose} className="btn-brand w-full text-sm">
              Done
            </button>
          </div>
        ) : (
          <>
            <div
              className="flex items-center justify-between p-4 border-b"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4" style={{ color: '#E53E3E' }} />
                <h2 className="font-semibold text-sm" style={{ color: '#2a1f18' }}>
                  Report {targetLabel}
                </h2>
              </div>
              <button onClick={handleClose} className="transition-opacity hover:opacity-60">
                <X className="w-5 h-5" style={{ color: '#9a8070' }} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: '#7a6055' }}>
                  Reason
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="input-sprout w-full text-sm"
                >
                  <option value="">Select a reason…</option>
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: '#7a6055' }}>
                  Details (optional)
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Add any extra context that might help us review this…"
                  rows={3}
                  className="input-sprout w-full text-sm resize-none"
                />
              </div>

              {error && (
                <p className="text-xs font-medium" style={{ color: '#ef4444' }}>{error}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={!reason || submitting}
                className="btn-brand w-full text-sm"
                style={{ opacity: reason && !submitting ? 1 : 0.5 }}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Submit report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
