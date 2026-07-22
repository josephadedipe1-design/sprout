'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Bell, Lock, Shield, Moon, Trash2, LogOut, ChevronRight, Eye, Globe, MessageCircle, X, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

interface SettingsViewProps {
  onBack: () => void;
}

interface NotifPrefs { conn: boolean; likes: boolean; comments: boolean; messages: boolean; events: boolean; }
interface PrivacyPrefs { neighborhood: boolean; activity: boolean; requests: boolean; }

const DEFAULT_NOTIF: NotifPrefs = { conn: true, likes: true, comments: true, messages: true, events: false };
const DEFAULT_PRIVACY: PrivacyPrefs = { neighborhood: true, activity: true, requests: true };

export default function SettingsView({ onBack }: SettingsViewProps) {
  const { signOut, user, profile } = useAuth();
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [showChangePw, setShowChangePw] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwDone, setPwDone] = useState(false);

  const [notifications, setNotifications] = useState<NotifPrefs>(DEFAULT_NOTIF);
  const [privacy, setPrivacy] = useState<PrivacyPrefs>(DEFAULT_PRIVACY);
  const [theme, setTheme] = useState<'light' | 'system' | 'dark'>('light');
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const loadSettings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setNotifications(data.notification_prefs ?? DEFAULT_NOTIF);
      setPrivacy(data.privacy_prefs ?? DEFAULT_PRIVACY);
      setTheme(data.theme ?? 'light');
    }
    setSettingsLoaded(true);
  }, [user]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const [settingsError, setSettingsError] = useState('');

  async function saveSettings(notif: NotifPrefs, priv: PrivacyPrefs, th: string) {
    if (!user) return;
    setSettingsError('');
    const { error } = await supabase.from('user_settings').upsert({
      user_id: user.id,
      notification_prefs: notif,
      privacy_prefs: priv,
      theme: th,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) setSettingsError('Failed to save settings. Please try again.');
  }

  function toggleNotif(key: keyof NotifPrefs) {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    saveSettings(updated, privacy, theme);
  }

  function togglePrivacy(key: keyof PrivacyPrefs) {
    const updated = { ...privacy, [key]: !privacy[key] };
    setPrivacy(updated);
    saveSettings(notifications, updated, theme);
  }

  function selectTheme(t: 'light' | 'system' | 'dark') {
    setTheme(t);
    saveSettings(notifications, privacy, t);
  }

  async function handleSignOut() {
    await signOut();
    router.push('/');
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-user`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to delete account');
      await signOut();
      router.push('/');
    } catch (err) {
      setDeleteError((err as Error).message);
      setDeleting(false);
    }
  }

  async function handleChangePw(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters.'); return; }
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwLoading(false);
    if (error) { setPwError(error.message); return; }
    setPwDone(true);
    setTimeout(() => { setPwDone(false); setShowChangePw(false); setNewPw(''); setConfirmPw(''); }, 2000);
  }

  const [comingSoon, setComingSoon] = useState('');

  function showComingSoon(label: string) {
    setComingSoon(label);
    setTimeout(() => setComingSoon(''), 2200);
  }

  const NOTIF_ITEMS = [
    { label: 'New connections', description: 'When someone connects with you', key: 'conn' as keyof NotifPrefs },
    { label: 'Post likes', description: 'When someone likes your post', key: 'likes' as keyof NotifPrefs },
    { label: 'Comments', description: 'When someone comments on your post', key: 'comments' as keyof NotifPrefs },
    { label: 'Messages', description: 'New message notifications', key: 'messages' as keyof NotifPrefs },
    { label: 'Community events', description: 'Local meetups and events near you', key: 'events' as keyof NotifPrefs },
  ];

  const PRIVACY_ITEMS = [
    { label: 'Show my neighborhood', description: 'Visible to other community members', key: 'neighborhood' as keyof PrivacyPrefs },
    { label: 'Show my activity', description: 'Let others see your posts and activity', key: 'activity' as keyof PrivacyPrefs },
    { label: 'Allow connection requests', description: 'Parents can send you requests', key: 'requests' as keyof PrivacyPrefs },
  ];

  const SAFETY_LINKS: { label: string; href: string }[] = [
    { label: 'Community Guidelines', href: '/guidelines' },
    { label: 'Report a Problem', href: '/help#report' },
    { label: 'Help & Support', href: '/help' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
  ];

  function Toggle({ value, onToggle, disabled }: { value: boolean; onToggle: () => void; disabled?: boolean }) {
    return (
      <button
        onClick={onToggle}
        disabled={disabled}
        className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
        style={{ background: value ? 'var(--brand)' : '#d0c8c0', opacity: disabled ? 0.5 : 1 }}
      >
        <span
          className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform"
          style={{ transform: value ? 'translateX(1.375rem)' : 'translateX(0.25rem)' }}
        />
      </button>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 lg:pb-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="w-9 h-9 rounded-xl border flex items-center justify-center transition-opacity hover:opacity-70" style={{ borderColor: 'var(--border-color)', color: '#5a4035', background: 'white' }}>
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#2a1f18' }}>Settings</h1>
          <p className="text-sm" style={{ color: '#9a8070' }}>{profile?.first_name ? (profile.last_initial ? `${profile.first_name} ${profile.last_initial}.` : profile.first_name) : 'Your account'}</p>
        </div>
      </div>

      <div className="space-y-5">
        {settingsError && (
          <div className="p-3 rounded-xl text-sm font-medium" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
            {settingsError}
          </div>
        )}
        {/* Account */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#b8a090' }}>Account</p>
          <div className="card-sprout overflow-hidden">
            <button
              onClick={() => { setShowChangePw(true); setPwDone(false); setPwError(''); setNewPw(''); setConfirmPw(''); }}
              className="w-full flex items-center gap-3 p-4 text-left transition-colors hover:opacity-80"
              style={{ borderBottom: '1px solid var(--border-color)' }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand-light)' }}>
                <Lock className="w-4 h-4" style={{ color: 'var(--brand)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: '#2a1f18' }}>Change password</p>
                <p className="text-xs" style={{ color: '#9a8070' }}>Update your password</p>
              </div>
              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: '#c4a090' }} />
            </button>
            {[
              { Icon: MessageCircle, label: 'Blocked users', sub: 'Manage who you\'ve blocked' },
              { Icon: Globe, label: 'Language', sub: 'English (UK)' },
            ].map(({ Icon, label, sub }) => (
              <button
                key={label}
                onClick={() => showComingSoon(label)}
                className="w-full flex items-center gap-3 p-4 text-left transition-colors hover:opacity-80"
                style={{ borderBottom: '1px solid var(--border-color)' }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--brand-light)' }}>
                  <Icon className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: '#2a1f18' }}>{label}</p>
                  <p className="text-xs" style={{ color: '#9a8070' }}>{sub}</p>
                </div>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: '#c4a090' }} />
              </button>
            ))}
          </div>
        </section>

        {/* Notifications */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4" style={{ color: '#b8a090' }} />
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#b8a090' }}>Notifications</p>
          </div>
          <div className="card-sprout overflow-hidden">
            {NOTIF_ITEMS.map((n, i) => (
              <div key={n.key} className="flex items-center gap-3 p-4" style={{ borderTop: i > 0 ? '1px solid var(--border-color)' : 'none' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: '#2a1f18' }}>{n.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9a8070' }}>{n.description}</p>
                </div>
                <Toggle value={notifications[n.key]} onToggle={() => toggleNotif(n.key)} disabled={!settingsLoaded} />
              </div>
            ))}
          </div>
        </section>

        {/* Privacy */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4" style={{ color: '#b8a090' }} />
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#b8a090' }}>Privacy</p>
          </div>
          <div className="card-sprout overflow-hidden">
            {PRIVACY_ITEMS.map((p, i) => (
              <div key={p.key} className="flex items-center gap-3 p-4" style={{ borderTop: i > 0 ? '1px solid var(--border-color)' : 'none' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: '#2a1f18' }}>{p.label}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9a8070' }}>{p.description}</p>
                </div>
                <Toggle value={privacy[p.key]} onToggle={() => togglePrivacy(p.key)} disabled={!settingsLoaded} />
              </div>
            ))}
          </div>
        </section>

        {/* Appearance */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Moon className="w-4 h-4" style={{ color: '#b8a090' }} />
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#b8a090' }}>Appearance</p>
          </div>
          <div className="card-sprout p-4">
            <p className="text-sm font-semibold mb-3" style={{ color: '#2a1f18' }}>Theme</p>
            <div className="flex gap-3">
              {([
                { id: 'light' as const, label: 'Light', preview: '#f9f7f5' },
                { id: 'system' as const, label: 'System', preview: 'linear-gradient(135deg, #f9f7f5 50%, #1a1a1a 50%)' },
                { id: 'dark' as const, label: 'Dark', preview: '#1a1a1a' },
              ]).map(({ id, label, preview }) => (
                <button key={id} onClick={() => selectTheme(id)} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full h-12 rounded-xl border-2 transition-all" style={{ background: preview, borderColor: theme === id ? 'var(--brand)' : 'var(--border-color)' }} />
                  <span className="text-xs font-medium" style={{ color: theme === id ? 'var(--brand)' : '#9a8070' }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Safety */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4" style={{ color: '#b8a090' }} />
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#b8a090' }}>Safety & Support</p>
          </div>
          <div className="card-sprout overflow-hidden">
            {SAFETY_LINKS.map((item, i) => (
              <button
                key={item.label}
                onClick={() => window.open(item.href, '_blank')}
                className="w-full flex items-center gap-3 p-4 text-left transition-opacity hover:opacity-70"
                style={{ borderTop: i > 0 ? '1px solid var(--border-color)' : 'none' }}
              >
                <p className="flex-1 text-sm" style={{ color: '#2a1f18' }}>{item.label}</p>
                <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: '#c4a090' }} />
              </button>
            ))}
          </div>
        </section>

        {/* Sign out / delete */}
        <section className="space-y-2">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border font-semibold text-sm transition-opacity hover:opacity-70"
            style={{ borderColor: 'var(--border-color)', color: '#5a4035', background: 'white' }}
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
          {showDeleteConfirm ? (
            <div className="p-4 rounded-xl border space-y-3" style={{ borderColor: '#fecaca', background: '#FEF2F2' }}>
              <p className="text-sm font-semibold" style={{ color: '#991B1B' }}>Are you sure you want to delete your account?</p>
              <p className="text-xs" style={{ color: '#991B1B' }}>This action is permanent and cannot be undone. All your posts, connections, and listings will be removed.</p>
              {deleteError && <p className="text-xs font-medium" style={{ color: '#ef4444' }}>{deleteError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold transition-opacity hover:opacity-70 flex items-center justify-center gap-2"
                  style={{ background: '#ef4444', color: 'white', opacity: deleting ? 0.7 : 1 }}
                >
                  {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {deleting ? 'Deleting…' : 'Yes, delete account'}
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteError(''); }}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold border transition-opacity hover:opacity-70"
                  style={{ borderColor: '#d0c8c0', color: '#5a4035', background: 'white' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-opacity hover:opacity-70"
              style={{ color: '#ef4444' }}
            >
              <Trash2 className="w-4 h-4" /> Delete account
            </button>
          )}
        </section>

        <p className="text-center text-xs pb-4" style={{ color: '#c4a090' }}>Sprout v1.0 · Made with love for parents</p>
      </div>

      {/* Coming soon toast */}
      {comingSoon && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium pointer-events-none" style={{ background: '#2a1f18', color: 'white' }}>
          {comingSoon} — coming soon
        </div>
      )}

      {/* Change password modal */}
      {showChangePw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: 'white' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <h2 className="text-base font-bold" style={{ color: '#2a1f18' }}>Change password</h2>
              <button onClick={() => setShowChangePw(false)} style={{ color: '#9a8070' }}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5">
              {pwDone ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#ECFDF5' }}>
                    <CheckCircle className="w-6 h-6" style={{ color: '#059669' }} />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: '#2a1f18' }}>Password updated!</p>
                </div>
              ) : (
                <form onSubmit={handleChangePw} className="space-y-4">
                  {pwError && (
                    <div className="p-3 rounded-xl text-sm" style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
                      {pwError}
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#3a2820' }}>New Password</label>
                    <input className="input-sprout" type="password" placeholder="At least 8 characters" value={newPw} onChange={e => setNewPw(e.target.value)} required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#3a2820' }}>Confirm Password</label>
                    <input className="input-sprout" type="password" placeholder="Repeat new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required />
                  </div>
                  <button type="submit" className="btn-brand w-full text-sm py-3" disabled={pwLoading}>
                    {pwLoading ? 'Updating…' : 'Update password'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
