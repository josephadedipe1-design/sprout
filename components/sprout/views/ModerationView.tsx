'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Shield, Flag, CheckCircle, XCircle, Loader2, User, MessageSquare, FileText, Filter, Trash2, Ban, ShieldCheck, ShoppingBag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const ADMIN_ID = '4848415f-2bbe-409a-8443-eb925b0b88e8';

type StatusFilter = 'pending' | 'dismissed' | 'actioned' | 'all';

interface ReportRow {
  id: string;
  reason: string;
  detail: string | null;
  status: string;
  created_at: string;
  reporter_id: string;
  user_id: string | null;
  post_id: string | null;
  message_id: string | null;
  reported_listing_id: string | null;
}

interface ReportedUser {
  first_name: string | null;
  last_initial: string | null;
  suspended: boolean;
}

interface ReporterInfo {
  first_name: string | null;
  last_initial: string | null;
}

interface ContentPreview {
  kind: 'post' | 'user' | 'message' | 'listing' | 'unknown';
  text: string | null;
  image_url: string | null;
  authorName: string | null;
}

interface EnrichedReport extends ReportRow {
  reporter?: ReporterInfo;
  preview?: ContentPreview;
  reportedUser?: ReportedUser;
}

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  inappropriate_content: 'Inappropriate content',
  safety_concern: 'Safety concern',
  other: 'Other',
};

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: '#FEF3C7', color: '#92400E', label: 'Pending' },
  dismissed: { bg: '#F1F5F9', color: '#475569', label: 'Dismissed' },
  actioned: { bg: '#DCFCE7', color: '#166534', label: 'Action taken' },
  reviewed: { bg: '#E0E7FF', color: '#3730A3', label: 'Reviewed' },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatName(first: string | null, last: string | null): string {
  if (!first) return 'Unknown user';
  return last ? `${first} ${last}.` : first;
}

interface ModerationViewProps {
  onBack: () => void;
}

export default function ModerationView({ onBack }: ModerationViewProps) {
  const { user } = useAuth();
  const [reports, setReports] = useState<EnrichedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [actingId, setActingId] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(200);
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    const { data, error } = await query;
    if (error || !data) {
      setReports([]);
      setLoading(false);
      return;
    }

    const rows = data as ReportRow[];

    // Fetch reporter profiles
    const reporterIds = Array.from(new Set(rows.map((r) => r.reporter_id).filter(Boolean)));
    const reporterMap: Record<string, ReporterInfo> = {};
    if (reporterIds.length > 0) {
      const { data: reporterRows } = await supabase
        .from('profiles')
        .select('id, first_name, last_initial')
        .in('id', reporterIds);
      (reporterRows ?? []).forEach((p: any) => {
        reporterMap[p.id] = { first_name: p.first_name, last_initial: p.last_initial };
      });
    }

    // Fetch reported posts
    const postIds = Array.from(new Set(rows.map((r) => r.post_id).filter(Boolean))) as string[];
    const postMap: Record<string, { body: string; image_url: string | null; author_id: string }> = {};
    if (postIds.length > 0) {
      const { data: postRows } = await supabase
        .from('posts')
        .select('id, body, image_url, author_id')
        .in('id', postIds);
      (postRows ?? []).forEach((p: any) => {
        postMap[p.id] = { body: p.body, image_url: p.image_url, author_id: p.author_id };
      });
    }

    // Fetch reported messages
    const messageIds = Array.from(new Set(rows.map((r) => r.message_id).filter(Boolean))) as string[];
    const messageMap: Record<string, { body: string; sender_id: string }> = {};
    if (messageIds.length > 0) {
      const { data: msgRows } = await supabase
        .from('messages')
        .select('id, body, sender_id')
        .in('id', messageIds);
      (msgRows ?? []).forEach((m: any) => {
        messageMap[m.id] = { body: m.body, sender_id: m.sender_id };
      });
    }

    const listingIds = Array.from(new Set(rows.map((r) => r.reported_listing_id).filter(Boolean))) as string[];
    const listingMap: Record<string, { title: string; seller_id: string; image_url: string | null }> = {};
    if (listingIds.length > 0) {
      const { data: listingRows } = await supabase.from('listings').select('id, title, seller_id').in('id', listingIds);
      const { data: imageRows } = await supabase.from('listing_images').select('listing_id, url').in('listing_id', listingIds).order('position', { ascending: true });
      const imageMap: Record<string, string> = {};
      (imageRows ?? []).forEach((image: any) => { if (!imageMap[image.listing_id]) imageMap[image.listing_id] = image.url; });
      (listingRows ?? []).forEach((listing: any) => { listingMap[listing.id] = { title: listing.title, seller_id: listing.seller_id, image_url: imageMap[listing.id] ?? null }; });
    }

    // Fetch reported user profiles (and post/message/listing authors for suspend)
    const reportedUserIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
    const authorIdsFromPosts = Array.from(new Set(Object.values(postMap).map((p) => p.author_id).filter(Boolean))) as string[];
    const authorIdsFromMessages = Array.from(new Set(Object.values(messageMap).map((m) => m.sender_id).filter(Boolean))) as string[];
    const authorIdsFromListings = Array.from(new Set(Object.values(listingMap).map((l) => l.seller_id).filter(Boolean))) as string[];
    const allReportedUserIds = Array.from(new Set([...reportedUserIds, ...authorIdsFromPosts, ...authorIdsFromMessages, ...authorIdsFromListings]));
    const reportedUserMap: Record<string, ReportedUser> = {};
    if (allReportedUserIds.length > 0) {
      const { data: userRows } = await supabase
        .from('profiles')
        .select('id, first_name, last_initial, suspended')
        .in('id', allReportedUserIds);
      (userRows ?? []).forEach((p: any) => {
        reportedUserMap[p.id] = { first_name: p.first_name, last_initial: p.last_initial, suspended: !!p.suspended };
      });
    }

    // Also fetch post author names for previews
    const authorIds = Array.from(new Set([...Object.values(postMap).map((p) => p.author_id), ...Object.values(listingMap).map((l) => l.seller_id)].filter(Boolean)));
    const authorMap: Record<string, string> = {};
    if (authorIds.length > 0) {
      const { data: authorRows } = await supabase
        .from('profiles')
        .select('id, first_name, last_initial')
        .in('id', authorIds);
      (authorRows ?? []).forEach((p: any) => {
        authorMap[p.id] = formatName(p.first_name, p.last_initial);
      });
    }

    const enriched: EnrichedReport[] = rows.map((r) => {
      let preview: ContentPreview = { kind: 'unknown', text: null, image_url: null, authorName: null };

      if (r.post_id && postMap[r.post_id]) {
        const p = postMap[r.post_id];
        preview = {
          kind: 'post',
          text: p.body,
          image_url: p.image_url,
          authorName: authorMap[p.author_id] ?? null,
        };
      } else if (r.message_id && messageMap[r.message_id]) {
        const m = messageMap[r.message_id];
        preview = {
          kind: 'message',
          text: m.body,
          image_url: null,
          authorName: null,
        };
      } else if (r.reported_listing_id && listingMap[r.reported_listing_id]) {
        const listing = listingMap[r.reported_listing_id];
        preview = { kind: 'listing', text: listing.title, image_url: listing.image_url, authorName: authorMap[listing.seller_id] ?? null };
      } else if (r.user_id && reportedUserMap[r.user_id]) {
        const u = reportedUserMap[r.user_id];
        preview = {
          kind: 'user',
          text: null,
          image_url: null,
          authorName: formatName(u.first_name, u.last_initial),
        };
      }

      // Determine the reported user for suspend/unsuspend actions
      let reportedUser: ReportedUser | undefined;
      if (r.user_id && reportedUserMap[r.user_id]) {
        reportedUser = reportedUserMap[r.user_id];
      } else if (r.post_id && postMap[r.post_id] && reportedUserMap[postMap[r.post_id].author_id]) {
        reportedUser = reportedUserMap[postMap[r.post_id].author_id];
      } else if (r.message_id && messageMap[r.message_id] && reportedUserMap[messageMap[r.message_id].sender_id]) {
        reportedUser = reportedUserMap[messageMap[r.message_id].sender_id];
      } else if (r.reported_listing_id && listingMap[r.reported_listing_id] && reportedUserMap[listingMap[r.reported_listing_id].seller_id]) {
        reportedUser = reportedUserMap[listingMap[r.reported_listing_id].seller_id];
      }

      return {
        ...r,
        reporter: reporterMap[r.reporter_id],
        preview,
        reportedUser,
      };
    });

    setReports(enriched);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  async function updateStatus(reportId: string, status: 'dismissed' | 'actioned') {
    setActingId(reportId);
    const { error } = await supabase.from('reports').update({ status }).eq('id', reportId);
    setActingId(null);
    if (!error) {
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    }
  }

  async function deleteContent(report: EnrichedReport) {
    setActingId(report.id);
    let delErr: any = null;
    if (report.post_id) {
      ({ error: delErr } = await supabase.from('posts').delete().eq('id', report.post_id));
    } else if (report.message_id) {
      ({ error: delErr } = await supabase.from('messages').delete().eq('id', report.message_id));
    } else if (report.reported_listing_id) {
      ({ error: delErr } = await supabase.from('listings').delete().eq('id', report.reported_listing_id));
    }
    if (delErr) {
      setActingId(null);
      return;
    }
    await supabase.from('reports').update({ status: 'actioned' }).eq('id', report.id);
    setActingId(null);
    setReports((prev) => prev.filter((r) => r.id !== report.id));
  }

  async function suspendUser(report: EnrichedReport) {
    // Resolve the target user id from the report
    let uid: string | null = report.user_id;
    if (!uid && report.post_id) {
      const { data: p } = await supabase.from('posts').select('author_id').eq('id', report.post_id).maybeSingle();
      uid = p?.author_id ?? null;
    }
    if (!uid && report.message_id) {
      const { data: m } = await supabase.from('messages').select('sender_id').eq('id', report.message_id).maybeSingle();
      uid = m?.sender_id ?? null;
    }
    if (!uid && report.reported_listing_id) {
      const { data: l } = await supabase.from('listings').select('seller_id').eq('id', report.reported_listing_id).maybeSingle();
      uid = l?.seller_id ?? null;
    }
    if (!uid) return;
    setActingId(report.id);
    const { error } = await supabase.rpc('admin_set_suspended', { target_uid: uid, val: true });
    if (error) {
      setActingId(null);
      return;
    }
    await supabase.from('reports').update({ status: 'actioned' }).eq('id', report.id);
    setActingId(null);
    setReports((prev) => prev.filter((r) => r.id !== report.id));
  }

  async function unsuspendUser(report: EnrichedReport) {
    const targetUid = report.user_id ?? null;
    if (!targetUid) return;
    setActingId(report.id);
    const { error } = await supabase.rpc('admin_set_suspended', { target_uid: targetUid, val: false });
    setActingId(null);
    if (!error) {
      setReports((prev) => prev.map((r) => r.id === report.id ? { ...r, reportedUser: r.reportedUser ? { ...r.reportedUser, suspended: false } : r.reportedUser } : r));
    }
  }

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

  const FILTERS: { id: StatusFilter; label: string }[] = [
    { id: 'pending', label: 'Pending' },
    { id: 'actioned', label: 'Action taken' },
    { id: 'dismissed', label: 'Dismissed' },
    { id: 'all', label: 'All' },
  ];

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium mb-5 hover:opacity-70 transition-opacity" style={{ color: '#7a6055' }}>
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand)' }}>
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold" style={{ color: '#2a1f18' }}>Moderation Queue</h1>
          <p className="text-xs" style={{ color: '#9a8070' }}>Review reported content and take action</p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto scrollbar-hide">
        <Filter className="w-4 h-4 flex-shrink-0" style={{ color: '#9a8070' }} />
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            className="flex-shrink-0 text-sm font-medium px-3 py-1.5 rounded-full transition-all"
            style={{
              background: statusFilter === f.id ? 'var(--brand)' : 'white',
              color: statusFilter === f.id ? 'white' : '#7a6055',
              border: `1px solid ${statusFilter === f.id ? 'var(--brand)' : 'var(--border-color)'}`,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--brand)' }} />
        </div>
      ) : reports.length === 0 ? (
        <div className="card-sprout p-8 text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'var(--brand-light)' }}>
            <CheckCircle className="w-6 h-6" style={{ color: 'var(--brand)' }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: '#2a1f18' }}>No reports</p>
          <p className="text-sm" style={{ color: '#9a8070' }}>
            {statusFilter === 'pending' ? 'The queue is clear.' : `No ${statusFilter.replace('_', ' ')} reports.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const style = STATUS_STYLES[r.status] ?? STATUS_STYLES.pending;
            const Icon = r.preview?.kind === 'post' ? FileText : r.preview?.kind === 'message' ? MessageSquare : r.preview?.kind === 'listing' ? ShoppingBag : r.preview?.kind === 'user' ? User : Flag;
            return (
              <div key={r.id} className="card-sprout p-4">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: style.bg, color: style.color }}>
                      {style.label}
                    </span>
                    <span className="text-xs font-medium" style={{ color: '#7a6055' }}>
                      {REASON_LABELS[r.reason] ?? r.reason}
                    </span>
                  </div>
                  <span className="text-xs flex-shrink-0" style={{ color: '#b8a090' }}>{formatDate(r.created_at)}</span>
                </div>

                {/* Details */}
                {r.detail && (
                  <p className="text-sm mb-3 p-2.5 rounded-lg" style={{ background: '#faf8f6', color: '#5a4035', lineHeight: 1.5 }}>
                    &ldquo;{r.detail}&rdquo;
                  </p>
                )}

                {/* Reported content preview */}
                {r.preview && r.preview.kind !== 'unknown' && (
                  <div className="mb-3 p-3 rounded-xl border" style={{ borderColor: 'var(--border-color)', background: '#fdfcfa' }}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Icon className="w-3.5 h-3.5" style={{ color: '#9a8070' }} />
                      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#9a8070' }}>
                        {r.preview.kind === 'post' ? 'Reported post' : r.preview.kind === 'message' ? 'Reported message' : r.preview.kind === 'listing' ? 'Reported listing' : 'Reported user'}
                      </span>
                    </div>
                    {r.preview.image_url && (
                      <img src={r.preview.image_url} alt="Reported content" className="rounded-lg max-h-40 object-cover mb-2" />
                    )}
                    {r.preview.text && (
                      <p className="text-sm" style={{ color: '#3a2820', lineHeight: 1.5 }}>{r.preview.text}</p>
                    )}
                    {r.preview.authorName && r.preview.kind === 'user' && (
                      <p className="text-sm font-medium" style={{ color: '#3a2820' }}>{r.preview.authorName}</p>
                    )}
                    {r.preview.authorName && (r.preview.kind === 'post' || r.preview.kind === 'listing') && (
                      <p className="text-xs mt-1.5" style={{ color: '#9a8070' }}>{r.preview.kind === 'listing' ? 'Listed by' : 'Posted by'} {r.preview.authorName}</p>
                    )}
                  </div>
                )}

                {/* Reporter info */}
                <div className="flex items-center gap-1.5 text-xs mb-3" style={{ color: '#9a8070' }}>
                  <User className="w-3 h-3" />
                  <span>Reported by {r.reporter ? formatName(r.reporter.first_name, r.reporter.last_initial) : 'Unknown user'}</span>
                </div>

                {/* Suspend badge for actioned reports */}
                {r.status !== 'pending' && r.reportedUser?.suspended && (
                  <div className="flex items-center gap-1.5 text-xs mb-3" style={{ color: '#B91C1C' }}>
                    <Ban className="w-3.5 h-3.5" />
                    <span className="font-semibold">User suspended</span>
                  </div>
                )}

                {/* Action buttons */}
                {r.status === 'pending' ? (
                  <>
                    {(r.post_id || r.message_id || r.reported_listing_id) && (
                      <button
                        onClick={() => deleteContent(r)}
                        disabled={actingId === r.id}
                        className="w-full text-sm font-semibold py-2 rounded-xl transition-opacity hover:opacity-80 flex items-center justify-center gap-1.5 mb-2"
                        style={{ background: '#FEE2E2', color: '#B91C1C', opacity: actingId === r.id ? 0.5 : 1 }}
                      >
                        {actingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Delete content
                      </button>
                    )}
                    {r.reportedUser && (
                      <button
                        onClick={() => suspendUser(r)}
                        disabled={actingId === r.id}
                        className="w-full text-sm font-semibold py-2 rounded-xl transition-opacity hover:opacity-80 flex items-center justify-center gap-1.5 mb-2"
                        style={{ background: '#FEF3C7', color: '#92400E', opacity: actingId === r.id ? 0.5 : 1 }}
                      >
                        {actingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                        Suspend user
                      </button>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateStatus(r.id, 'actioned')}
                        disabled={actingId === r.id}
                        className="flex-1 text-sm font-semibold py-2 rounded-xl transition-opacity hover:opacity-80 flex items-center justify-center gap-1.5"
                        style={{ background: 'var(--brand)', color: 'white', opacity: actingId === r.id ? 0.5 : 1 }}
                      >
                        {actingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        Mark actioned
                      </button>
                      <button
                        onClick={() => updateStatus(r.id, 'dismissed')}
                        disabled={actingId === r.id}
                        className="flex-1 text-sm font-semibold py-2 rounded-xl border transition-opacity hover:opacity-80 flex items-center justify-center gap-1.5"
                        style={{ borderColor: '#d0c8c0', color: '#5a4035', background: 'white', opacity: actingId === r.id ? 0.5 : 1 }}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Dismiss
                      </button>
                    </div>
                  </>
                ) : (
                  r.reportedUser?.suspended && r.user_id && (
                    <button
                      onClick={() => unsuspendUser(r)}
                      disabled={actingId === r.id}
                      className="w-full text-sm font-semibold py-2 rounded-xl transition-opacity hover:opacity-80 flex items-center justify-center gap-1.5"
                      style={{ background: 'var(--brand-light)', color: 'var(--brand)', opacity: actingId === r.id ? 0.5 : 1 }}
                    >
                      {actingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      Unsuspend user
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
