import { supabase } from '@/lib/supabase';

export interface BlockedUser {
  blockId: string;
  userId: string;
  first_name: string | null;
  last_initial: string | null;
  avatar_url: string | null;
  created_at: string;
}

export async function fetchBlockedUsers(): Promise<BlockedUser[]> {
  const { data, error } = await supabase
    .from('blocks')
    .select(`
      id,
      blocked_id,
      created_at,
      profiles:blocked_id (first_name, last_initial, avatar_url)
    `)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return (data as any[]).map((row) => ({
    blockId: row.id,
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

export async function unblockUser(blockId: string): Promise<boolean> {
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('id', blockId);
  if (error) return false;
  return true;
}

export async function isUserBlockedByMe(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('blocks')
    .select('id')
    .eq('blocked_id', userId)
    .maybeSingle();
  return !!data;
}
