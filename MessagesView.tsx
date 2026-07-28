'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Search, MoreHorizontal, ArrowLeft, Edit2, X, Users, ShoppingBag, Car, Moon, Tag, Gamepad2, Package, Utensils, Home, BookOpen, Box } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { sendNotificationEmail, truncatePreview } from '@/lib/notifications';
import type { DbMessage, DbProfile } from '@/lib/types';
import type { ListingSnap } from './ListingDetailView';
import { formatLocation, formatName, getCategoryStyle } from '@/lib/utils';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Travel: Car, Sleep: Moon, Clothing: Tag, Toys: Gamepad2,
  Gear: Package, Feeding: Utensils, Furniture: Home, Education: BookOpen, Miscellaneous: Box,
};

interface ConvDisplay {
  id: string;
  name: string;
  avatar: string;
  lastMsg: string;
  time: string;
  about: string;
  otherUserId: string;
  listing_id: string | null;
  listing: ListingSnap | null;
  last_message_at: string;
}

interface MsgDisplay {
  id: string;
  from: 'me' | 'them';
  text: string;
  time: string;
}

function formatTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatMsgTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function ListingCard({ listing, compact }: { listing: ListingSnap; compact?: boolean }) {
  const showIcon = !listing.image_url || listing.image_url.includes('1148998');
  const catStyle = getCategoryStyle(listing.category);
  const CategoryIcon = CATEGORY_ICONS[listing.category] ?? ShoppingBag;

  if (compact) {
    return (
      <div className="flex items-center gap-2.5 pb-2.5 flex-1">
        <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: catStyle.bg }}>
          {showIcon ? (
            <CategoryIcon className="w-4 h-4" style={{ color: catStyle.color, opacity: 0.8 }} />
          ) : (
            <img src={listing.image_url} alt={listing.title} className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs" style={{ color: '#9a8070' }}>Enquiring about</p>
          <p className="text-sm font-semibold truncate" style={{ color: '#2a1f18' }}>{listing.title}</p>
        </div>
        <span className="text-sm font-bold flex-shrink-0" style={{ color: listing.price === 0 ? '#16a34a' : 'var(--brand)' }}>
          {listing.price === 0 ? 'Free' : `£${listing.price}`}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ background: '#fffcf8', borderColor: 'var(--border-color)' }}>
      <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: catStyle.bg }}>
        {showIcon ? (
          <CategoryIcon className="w-7 h-7" style={{ color: catStyle.color, opacity: 0.8 }} />
        ) : (
          <img src={listing.image_url} alt={listing.title} className="w-full h-full object-cover" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: '#2a1f18' }}>{listing.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#f4f3f0', color: '#5a4035' }}>{listing.condition}</span>
          <span className="text-sm font-bold" style={{ color: listing.price === 0 ? '#16a34a' : 'var(--brand)' }}>
            {listing.price === 0 ? 'Free' : `£${listing.price}`}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function MessagesView({ openWithUserId, onConversationOpened, messageListing, onActiveChatChange }: {
  openWithUserId?: string | null;
  onConversationOpened?: () => void;
  messageListing?: ListingSnap | null;
  onActiveChatChange?: (active: boolean) => void;
}) {
  const { user, profile } = useAuth();
  const [conversations, setConversations] = useState<ConvDisplay[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MsgDisplay[]>([]);
  const [input, setInput] = useState('');
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [connections, setConnections] = useState<DbProfile[]>([]);
  const [connSearch, setConnSearch] = useState('');
  const [readMap, setReadMap] = useState<Record<string, string>>({});

  const [conversationsLoaded, setConversationsLoaded] = useState(false);

  // Load read timestamps from localStorage on mount
  useEffect(() => {
    if (!user) return;
    const stored = localStorage.getItem(`sprout_conv_reads_${user.id}`);
    if (stored) { try { setReadMap(JSON.parse(stored)); } catch { /* ignore */ } }
  }, [user]);

  function markRead(convId: string) {
    if (!user) return;
    const now = new Date().toISOString();
    setReadMap(prev => {
      const next = { ...prev, [convId]: now };
      localStorage.setItem(`sprout_conv_reads_${user.id}`, JSON.stringify(next));
      return next;
    });
  }

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data: convData } = await supabase
      .from('conversations')
      .select('*')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false });

    const rows = convData ?? [];

    const otherIds = Array.from(new Set(
      rows.map((c: any) => c.user1_id === user.id ? c.user2_id : c.user1_id)
    ));
    const profileMap: Record<string, DbProfile> = {};
    if (otherIds.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles').select('*').in('id', otherIds);
      (profileRows ?? []).forEach((p: DbProfile) => { profileMap[p.id] = p; });
    }

    const listingIds = Array.from(new Set(rows.filter((c: any) => c.listing_id).map((c: any) => c.listing_id)));
    const listingMap: Record<string, ListingSnap> = {};
    if (listingIds.length > 0) {
      const { data: lRows } = await supabase
        .from('listings').select('id, title, price_pence, condition, category').in('id', listingIds);
      (lRows ?? []).forEach((l: any) => { listingMap[l.id] = { ...l, price: l.price_pence / 100, image_url: '' }; });
    }

    const mapped: ConvDisplay[] = rows.map((c: any) => {
      const otherId = c.user1_id === user.id ? c.user2_id : c.user1_id;
      const other = profileMap[otherId];
      return {
        id: c.id,
        name: formatName(other?.first_name || '', other?.last_initial) || 'Unknown',
        avatar: other?.avatar_url || '',
        lastMsg: c.last_message || 'No messages yet',
        time: c.last_message_at ? formatTime(c.last_message_at) : '',
        about: c.about,
        otherUserId: otherId,
        listing_id: c.listing_id || null,
        listing: c.listing_id ? listingMap[c.listing_id] ?? null : null,
        last_message_at: c.last_message_at || '',
      };
    });

    setConversations(mapped);
    setConversationsLoaded(true);
  }, [user]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const loadConnections = useCallback(async () => {
    if (!user) return;
    const { data: connData } = await supabase
      .from('match_requests')
      .select('*')
      .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
      .eq('status', 'connected');

    const rows = connData ?? [];
    const otherIds = rows.map((c: any) =>
      c.from_user_id === user.id ? c.to_user_id : c.from_user_id
    ).filter(Boolean);

    if (otherIds.length === 0) { setConnections([]); return; }

    const { data: profileRows } = await supabase
      .from('profiles').select('*').in('id', otherIds);
    setConnections((profileRows ?? []) as DbProfile[]);
  }, [user]);

  async function startNewConversation(otherProfile: DbProfile) {
    if (!user) return;
    setShowCompose(false);
    setConnSearch('');
    const existing = conversations.find(c => c.otherUserId === otherProfile.id);
    if (existing) { openConv(existing.id); return; }
    const u1 = user.id < otherProfile.id ? user.id : otherProfile.id;
    const u2 = user.id < otherProfile.id ? otherProfile.id : user.id;
    const { data } = await supabase
      .from('conversations')
      .upsert({ user1_id: u1, user2_id: u2 }, { onConflict: 'user1_id,user2_id' })
      .select()
      .maybeSingle();
    if (data) {
      await loadConversations();
      openConv(data.id);
    }
  }

  useEffect(() => {
    if (!openWithUserId || !user || !conversationsLoaded) return;
    (async () => {
      const existing = conversations.find(c => c.otherUserId === openWithUserId);
      if (existing) {
        if (messageListing) {
          await supabase.from('conversations').update({
            listing_id: messageListing.id,
            about: messageListing.title,
          }).eq('id', existing.id);
          await loadConversations();
        }
        openConv(existing.id);
        if (messageListing) setInput(`Hi! Is the "${messageListing.title}" still available?`);
        onConversationOpened?.();
        return;
      }
      const u1 = user.id < openWithUserId ? user.id : openWithUserId;
      const u2 = user.id < openWithUserId ? openWithUserId : user.id;
      const { data: upserted } = await supabase
        .from('conversations')
        .upsert(
          { user1_id: u1, user2_id: u2, about: messageListing?.title ?? '', listing_id: messageListing?.id ?? null },
          { onConflict: 'user1_id,user2_id' }
        )
        .select()
        .maybeSingle();
      if (upserted) {
        await loadConversations();
        openConv(upserted.id);
        if (messageListing) setInput(`Hi! Is the "${messageListing.title}" still available?`);
      }
      onConversationOpened?.();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openWithUserId, conversationsLoaded]);

  async function loadMessages(convId: string) {
    setLoadingMsgs(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    const mapped: MsgDisplay[] = (data ?? []).map((m: DbMessage) => ({
      id: m.id,
      from: m.sender_id === user?.id ? 'me' : 'them',
      text: m.body,
      time: formatMsgTime(m.created_at),
    }));

    setMessages(mapped);
    setLoadingMsgs(false);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function openConv(id: string) {
    setActiveId(id);
    setMobileShowChat(true);
    onActiveChatChange?.(true);
    markRead(id);
    loadMessages(id);
  }

  async function send() {
    if (!input.trim() || !activeId || !user) return;
    const text = input.trim();
    setInput('');

    const optimistic: MsgDisplay = {
      id: `tmp-${Date.now()}`,
      from: 'me',
      text,
      time: 'just now',
    };
    setMessages(prev => [...prev, optimistic]);

    const { data: inserted } = await supabase.from('messages').insert({
      conversation_id: activeId,
      sender_id: user.id,
      body: text,
    }).select().maybeSingle();

    // Update time on the optimistic message if realtime hasn't fired yet
    if (inserted) {
      setMessages(prev => prev.map(m =>
        m.id === optimistic.id ? { ...m, id: inserted.id, time: formatMsgTime(inserted.created_at) } : m
      ));
    }

    await supabase.from('conversations').update({
      last_message: text,
      last_message_at: new Date().toISOString(),
    }).eq('id', activeId);

    markRead(activeId);

    await loadConversations();

    const conv = conversations.find(c => c.id === activeId);
    if (conv) {
      const senderName = profile?.first_name
        ? (profile.last_initial ? `${profile.first_name} ${profile.last_initial}.` : profile.first_name)
        : 'Someone';
      sendNotificationEmail({
        type: 'message',
        recipientUserId: conv.otherUserId,
        emailData: {
          actorUserId: user.id,
          senderName,
          preview: truncatePreview(text),
        },
      });
    }
  }

  // Realtime subscription for incoming messages
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as DbMessage;
          if (msg.conversation_id === activeIdRef.current) {
            const display: MsgDisplay = {
              id: msg.id,
              from: msg.sender_id === user.id ? 'me' : 'them',
              text: msg.body,
              time: formatMsgTime(msg.created_at),
            };
            setMessages(prev => {
              // Replace optimistic message if it matches content + sender, else append
              const optimisticIdx = prev.findIndex(
                m => m.id.startsWith('tmp-') && m.text === msg.body && m.from === display.from
              );
              if (optimisticIdx !== -1) {
                const next = [...prev];
                next[optimisticIdx] = display;
                return next;
              }
              // Avoid duplicates
              if (prev.some(m => m.id === msg.id)) return prev;
              return [...prev, display];
            });
            if (msg.sender_id !== user.id) {
              markRead(msg.conversation_id);
            }
          }
          // Refresh conversation list to update last message preview
          loadConversations();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const activeConv = conversations.find(c => c.id === activeId);
  const filteredConversations = searchQuery.trim()
    ? conversations.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.lastMsg.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : conversations;

  return (
    <div className="flex h-[calc(100vh-0px)] lg:h-[calc(100vh-0px)] overflow-hidden" style={{ maxHeight: 'calc(100dvh - 0px)' }}>
      {/* Conversation list */}
      <div
        className={`${mobileShowChat ? 'hidden' : 'flex'} lg:flex flex-col border-r flex-shrink-0`}
        style={{ width: '100%', maxWidth: 360, borderColor: 'var(--border-color)', background: 'white' }}
      >
        <div className="p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold" style={{ color: '#2a1f18' }}>Messages</h1>
            <button
              onClick={() => { setShowCompose(true); loadConnections(); }}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-opacity hover:opacity-70"
              style={{ background: 'var(--brand-light)' }}
              title="New conversation"
            >
              <Edit2 className="w-4 h-4" style={{ color: 'var(--brand)' }} />
            </button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#c4a090' }} />
            <input
              className="input-sprout pl-9 text-sm"
              placeholder="Search conversations…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: 'var(--brand-light)' }}>
                <Send className="w-6 h-6" style={{ color: 'var(--brand)' }} />
              </div>
              <p className="text-sm font-semibold mb-1" style={{ color: '#2a1f18' }}>No conversations yet</p>
              <p className="text-sm" style={{ color: '#9a8070' }}>Connect with a parent to start messaging</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <Search className="w-8 h-8 mb-3" style={{ color: '#c4a090' }} />
              <p className="text-sm font-semibold" style={{ color: '#2a1f18' }}>No results</p>
              <p className="text-sm mt-1" style={{ color: '#9a8070' }}>No conversations match &ldquo;{searchQuery}&rdquo;</p>
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isUnread = c.last_message_at && (readMap[c.id] ?? '') < c.last_message_at && c.id !== activeId;
              return (
              <button
                key={c.id}
                onClick={() => openConv(c.id)}
                className="w-full flex items-start gap-3 p-4 text-left transition-colors hover:bg-orange-50 border-b"
                style={{
                  borderColor: 'var(--border-color)',
                  background: activeId === c.id ? 'var(--brand-light)' : 'transparent',
                }}
              >
                <div className="relative flex-shrink-0">
                  {c.avatar ? (
                    <img src={c.avatar} alt={c.name} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white" style={{ background: 'var(--brand)' }}>
                      {c.name.charAt(0)}
                    </div>
                  )}
                  {isUnread && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white" style={{ background: '#E53E3E' }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className={`text-sm ${isUnread ? 'font-bold' : 'font-semibold'}`} style={{ color: '#2a1f18' }}>{c.name}</p>
                    <span className="text-xs" style={{ color: isUnread ? '#E53E3E' : '#9a8070', fontWeight: isUnread ? 600 : 400 }}>{c.time}</span>
                  </div>
                  {c.about && (
                    <p className="text-xs font-medium mb-0.5" style={{ color: 'var(--brand)' }}>Re: {c.about}</p>
                  )}
                  <p className="text-xs truncate" style={{ color: isUnread ? '#3a2820' : '#9a8070', fontWeight: isUnread ? 600 : 400 }}>{c.lastMsg}</p>
                </div>
              </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat panel */}
      <div className={`${!mobileShowChat ? 'hidden' : 'flex'} lg:flex flex-1 flex-col`} style={{ background: 'var(--bg)' }}>
        {activeConv ? (
          <>
            <div className="flex items-center gap-3 p-4 border-b" style={{ background: 'white', borderColor: 'var(--border-color)' }}>
              <button className="lg:hidden mr-1" style={{ color: 'var(--brand)' }} onClick={() => { setMobileShowChat(false); onActiveChatChange?.(false); }}>
                <ArrowLeft className="w-5 h-5" />
              </button>
              {activeConv.avatar ? (
                <img src={activeConv.avatar} alt={activeConv.name} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: 'var(--brand)' }}>
                  {activeConv.name.charAt(0)}
                </div>
              )}
              <div className="flex-1">
                <p className="font-semibold" style={{ color: '#2a1f18' }}>{activeConv.name}</p>
                {activeConv.about && <p className="text-xs" style={{ color: 'var(--brand)' }}>Re: {activeConv.about}</p>}
              </div>
              <button style={{ color: '#c4a090' }}><MoreHorizontal className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3" style={{ paddingBottom: '72px' }}>
              {loadingMsgs && (
                <div className="flex justify-center">
                  <p className="text-xs" style={{ color: '#c4a090' }}>Loading messages…</p>
                </div>
              )}
              {!loadingMsgs && messages.length === 0 && (
                <div className="flex justify-center mt-8">
                  <p className="text-sm" style={{ color: '#c4a090' }}>No messages yet. Say hello!</p>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.from === 'me' ? 'justify-end' : 'justify-start'}`}>
                  {m.from === 'them' && activeConv.avatar && (
                    <img src={activeConv.avatar} alt="" className="w-7 h-7 rounded-full object-cover mr-2 mt-auto flex-shrink-0" />
                  )}
                  {m.from === 'them' && !activeConv.avatar && (
                    <div className="w-7 h-7 rounded-full mr-2 mt-auto flex-shrink-0 flex items-center justify-center text-xs font-bold text-white" style={{ background: 'var(--brand)' }}>
                      {activeConv.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div
                      className="max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                      style={{
                        background: m.from === 'me' ? 'var(--brand)' : 'white',
                        color: m.from === 'me' ? 'white' : '#2a1f18',
                        borderRadius: m.from === 'me' ? '1.25rem 1.25rem 0.25rem 1.25rem' : '1.25rem 1.25rem 1.25rem 0.25rem',
                        border: m.from === 'them' ? '1px solid var(--border-color)' : 'none',
                      }}
                    >
                      {m.text}
                    </div>
                    <p className={`text-xs mt-1 ${m.from === 'me' ? 'text-right' : ''}`} style={{ color: '#9a8070' }}>{m.time}</p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="fixed bottom-0 left-0 right-0 lg:static border-t" style={{ background: 'white', borderColor: 'var(--border-color)' }}>
              {activeConv?.listing && (
                <div className="px-3 pt-2.5 pb-0 flex items-center gap-2.5 border-b" style={{ borderColor: 'var(--border-color)' }}>
                  <ListingCard listing={activeConv.listing} compact />
                </div>
              )}
              <div className="flex items-center gap-2 max-w-3xl mx-auto p-3">
                <input
                  className="input-sprout flex-1 text-sm"
                  placeholder="Message…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                />
                <button
                  onClick={send}
                  disabled={!input.trim()}
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity"
                  style={{ background: 'var(--brand)', opacity: input.trim() ? 1 : 0.4 }}
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center" style={{ color: '#c4a090' }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'var(--brand-light)' }}>
              <Send className="w-7 h-7" style={{ color: 'var(--brand)' }} />
            </div>
            <p className="font-semibold" style={{ color: '#7a6055' }}>Select a conversation</p>
            <p className="text-sm mt-1" style={{ color: '#c4a090' }}>Choose from the list to start chatting</p>
          </div>
        )}
      </div>

      {/* Compose modal */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(42,31,24,0.4)' }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl" style={{ background: 'white' }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                <h2 className="font-semibold text-sm" style={{ color: '#2a1f18' }}>New conversation</h2>
              </div>
              <button onClick={() => { setShowCompose(false); setConnSearch(''); }} className="transition-opacity hover:opacity-60">
                <X className="w-5 h-5" style={{ color: '#9a8070' }} />
              </button>
            </div>
            <div className="p-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#c4a090' }} />
                <input
                  autoFocus
                  className="input-sprout pl-9 text-sm"
                  placeholder="Search your connections…"
                  value={connSearch}
                  onChange={(e) => setConnSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
              {connections.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <Users className="w-8 h-8 mb-2" style={{ color: '#c4a090' }} />
                  <p className="text-sm font-semibold" style={{ color: '#2a1f18' }}>No connections yet</p>
                  <p className="text-xs mt-1" style={{ color: '#9a8070' }}>Connect with parents in Discover first</p>
                </div>
              ) : (
                connections
                  .filter(p => !connSearch.trim() || p.first_name.toLowerCase().includes(connSearch.toLowerCase()))
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={() => startNewConversation(p)}
                      className="w-full flex items-center gap-3 p-3 text-left border-b transition-colors hover:opacity-80"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt={p.first_name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0" style={{ background: 'var(--brand)' }}>
                          {p.first_name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: '#2a1f18' }}>{formatName(p.first_name, p.last_initial)}</p>
                        <p className="text-xs" style={{ color: '#9a8070' }}>{p.postcode_district ? formatLocation(p.postcode_district) : 'Nearby'}</p>
                      </div>
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
