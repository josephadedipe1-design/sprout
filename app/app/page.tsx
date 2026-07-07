'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/sprout/Sidebar';
import MobileNav from '@/components/sprout/MobileNav';
import FeedView from '@/components/sprout/views/FeedView';
import ThreadView from '@/components/sprout/views/ThreadView';
import NewPostView from '@/components/sprout/views/NewPostView';
import MarketView from '@/components/sprout/views/MarketView';
import ListingDetailView from '@/components/sprout/views/ListingDetailView';
import MessagesView from '@/components/sprout/views/MessagesView';
import MatchingView from '@/components/sprout/views/MatchingView';
import NotificationsView from '@/components/sprout/views/NotificationsView';
import ProfileView from '@/components/sprout/views/ProfileView';
import PublicProfileView from '@/components/sprout/views/PublicProfileView';
import EditProfileView from '@/components/sprout/views/EditProfileView';
import SearchView from '@/components/sprout/views/SearchView';
import WelcomeView from '@/components/sprout/views/WelcomeView';
import SettingsView from '@/components/sprout/views/SettingsView';
import { Profile } from '@/lib/profiles';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Leaf } from 'lucide-react';
import type { ListingSnap } from '@/components/sprout/views/ListingDetailView';

type MainView = 'feed' | 'market' | 'messages' | 'matching' | 'notifications' | 'profile' | 'search';
type SubView =
  | { type: 'thread'; postId: string }
  | { type: 'newpost' }
  | { type: 'listing'; listingId: string }
  | { type: 'editprofile' }
  | { type: 'settings' }
  | { type: 'publicprofile'; profile: Profile; connected: boolean; pendingRequest?: boolean }
  | null;

function AppContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [mainView, setMainView] = useState<MainView>('feed');
  const [subView, setSubView] = useState<SubView>(null);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);
  const [messageWithUserId, setMessageWithUserId] = useState<string | null>(null);
  const [messageListing, setMessageListing] = useState<ListingSnap | null>(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [mobileChatActive, setMobileChatActive] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [marketTrigger, setMarketTrigger] = useState(false);

  useEffect(() => {
    if (!user) return;
    async function checkUnread() {
      const lastSeen = localStorage.getItem('sprout_notifs_seen_at');
      const since = lastSeen ?? new Date(0).toISOString();

      const { count: connCount } = await supabase
        .from('connections')
        .select('id', { count: 'exact', head: true })
        .eq('addressee_id', user!.id)
        .eq('status', 'pending')
        .gt('created_at', since);

      if ((connCount ?? 0) > 0) { setHasUnread(true); return; }

      const { data: myPosts } = await supabase
        .from('posts')
        .select('id')
        .eq('user_id', user!.id);

      const myPostIds = (myPosts ?? []).map((p: any) => p.id);
      if (myPostIds.length === 0) return;

      const { count: likeCount } = await supabase
        .from('post_likes')
        .select('user_id', { count: 'exact', head: true })
        .in('post_id', myPostIds)
        .neq('user_id', user!.id)
        .gt('created_at', since);

      if ((likeCount ?? 0) > 0) { setHasUnread(true); return; }

      const { count: commentCount } = await supabase
        .from('comments')
        .select('id', { count: 'exact', head: true })
        .in('post_id', myPostIds)
        .neq('user_id', user!.id)
        .gt('created_at', since);

      if ((commentCount ?? 0) > 0) setHasUnread(true);
    }
    checkUnread();

    async function checkUnreadMessages() {
      const key = `sprout_msgs_seen_at_${user!.id}`;
      const lastSeen = localStorage.getItem(key) ?? new Date(0).toISOString();
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .neq('sender_id', user!.id)
        .gt('created_at', lastSeen);
      setUnreadMessages(count ?? 0);
    }
    checkUnreadMessages();
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!authLoading && user && searchParams.get('welcome') === '1') {
      setShowWelcome(true);
      // Remove the query param from the URL without a reload
      router.replace('/app');
    }
  }, [authLoading, user, searchParams, router]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center animate-pulse" style={{ background: 'var(--brand)' }}>
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <p className="text-sm font-medium" style={{ color: '#9a8070' }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (showWelcome) {
    return (
      <WelcomeView
        onDone={() => setShowWelcome(false)}
        onGoToMatching={() => { setShowWelcome(false); setMainView('matching'); }}
      />
    );
  }

  function navigate(view: MainView) {
    setMainView(view);
    setSubView(null);
    if (view !== 'messages') setMobileChatActive(false);
    if (view === 'notifications') {
      setHasUnread(false);
      localStorage.setItem('sprout_notifs_seen_at', new Date().toISOString());
    }
    if (view === 'messages') {
      setUnreadMessages(0);
      if (user) localStorage.setItem(`sprout_msgs_seen_at_${user.id}`, new Date().toISOString());
    }
  }

  function renderContent() {
    if (subView?.type === 'thread') {
      return <ThreadView postId={subView.postId} onBack={() => setSubView(null)} />;
    }
    if (subView?.type === 'newpost') {
      return (
        <NewPostView
          onBack={() => setSubView(null)}
          onPublish={() => { setSubView(null); setMainView('feed'); setFeedRefreshKey(k => k + 1); }}
          onListInMarket={() => { setSubView(null); setMainView('market'); setMarketTrigger(true); }}
        />
      );
    }
    if (subView?.type === 'listing') {
      return (
        <ListingDetailView
          listingId={subView.listingId}
          onBack={() => setSubView(null)}
          onMessage={(sellerUserId, listing) => {
            setSubView(null);
            setMessageWithUserId(sellerUserId);
            setMessageListing(listing);
            navigate('messages');
          }}
        />
      );
    }
    if (subView?.type === 'editprofile') {
      return (
        <EditProfileView
          onBack={() => setSubView(null)}
          onSave={() => setSubView(null)}
        />
      );
    }
    if (subView?.type === 'settings') {
      return <SettingsView onBack={() => setSubView(null)} />;
    }
    if (subView?.type === 'publicprofile') {
      return (
        <PublicProfileView
          profile={subView.profile}
          connected={subView.connected}
          pendingRequest={subView.pendingRequest}
          onBack={() => setSubView(null)}
          onConnect={() => setSubView({ ...subView, connected: true, pendingRequest: false })}
          onMessage={(userId) => {
            setSubView(null);
            setMessageWithUserId(userId ?? null);
            navigate('messages');
          }}
        />
      );
    }

    switch (mainView) {
      case 'feed':
        return (
          <FeedView
            key={feedRefreshKey}
            onOpenThread={(id) => setSubView({ type: 'thread', postId: id })}
            onNewPost={() => setSubView({ type: 'newpost' })}
            onGoToMarket={() => navigate('market')}
            onOpenListing={(id) => setSubView({ type: 'listing', listingId: id })}
          />
        );
      case 'market':
        return <MarketView onOpenListing={(id) => setSubView({ type: 'listing', listingId: id })} triggerNewListing={marketTrigger} onNewListingTriggered={() => setMarketTrigger(false)} />;
      case 'messages':
        return <MessagesView openWithUserId={messageWithUserId} onConversationOpened={() => { setMessageWithUserId(null); setMessageListing(null); }} messageListing={messageListing} onActiveChatChange={setMobileChatActive} />;
      case 'matching':
        return (
          <MatchingView
            onViewProfile={(profile, connected = false, pendingRequest = false) => setSubView({ type: 'publicprofile', profile, connected, pendingRequest })}
          />
        );
      case 'notifications':
        return (
          <NotificationsView
            onGoToFeed={() => navigate('feed')}
            onGoToMatching={() => navigate('matching')}
            onGoToMessages={() => navigate('messages')}
          />
        );
      case 'profile':
        return (
          <ProfileView
            onEditProfile={() => setSubView({ type: 'editprofile' })}
            onSettings={() => setSubView({ type: 'settings' })}
          />
        );
      case 'search':
        return <SearchView onBack={() => setMainView('feed')} />;
    }
  }

  const isMessages = mainView === 'messages' && !subView;

  return (
    <div className="flex" style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <Sidebar
        active={mainView}
        onNav={navigate}
        onNewPost={() => setSubView({ type: 'newpost' })}
        hasUnread={hasUnread}
        unreadMessages={unreadMessages}
      />

      <main
        className={`flex-1 ${isMessages ? 'overflow-hidden' : 'overflow-y-auto'}`}
        style={{ minHeight: '100dvh' }}
      >
        {renderContent()}
      </main>

      {!subView && !mobileChatActive && <MobileNav active={mainView} onNav={navigate} hasUnread={hasUnread} unreadMessages={unreadMessages} />}
    </div>
  );
}

export default function AppPage() {
  return (
    <Suspense>
      <AppContent />
    </Suspense>
  );
}
