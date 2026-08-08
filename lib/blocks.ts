import { supabase } from '@/lib/supabase';

export interface BlockedUser {
  userId: string;
  first_name: string | null;
  last_initial: string | null;
  avatar_url: string | null;
  created_at: string;
}

export async function fetchBlockedUsers(): Promise<BlockedUser[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('blocks')
    .select(`
      blocked_id,
      created_at,
      profiles:blocked_id (first_name, last_initial, avatar_url)
    `)
    .eq('blocker_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return (data as any[]).map((row) => ({
    userId: row.blocked_id,
    first_name: row.profiles?.first_name ?? null,
    last_initial: row.profiles?.last_initial ?? null,
    avatar_url: row.profiles?.avatar_url ?? null,
    created_at: row.created_at,
  }));
}

export async function blockUser(blockedId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: user.id, blocked_id: blockedId });
  if (error) return false;
  return true;
}

export async function unblockUser(blockedId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', blockedId);
  if (error) return false;
  return true;
}

export async function isUserBlockedByMe(userId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', user.id)
    .eq('blocked_id', userId)
    .maybeSingle();
  return !!data;
}
