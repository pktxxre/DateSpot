import { supabase } from './supabase';

export interface Reaction {
  id: string;
  visitId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export async function getReactionsForVisit(visitId: string): Promise<Reaction[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('reactions')
    .select('id, visit_id, user_id, emoji, created_at')
    .eq('visit_id', visitId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data.map(r => ({
    id: r.id,
    visitId: r.visit_id,
    userId: r.user_id,
    emoji: r.emoji,
    createdAt: r.created_at,
  }));
}

export async function addReaction(
  visitId: string,
  visitOwnerId: string,
  emoji: string,
): Promise<{ error?: string }> {
  if (!supabase) return { error: 'Not connected' };
  const { data: userData } = await supabase.auth.getUser();
  const myUserId = userData.user?.id;
  if (!myUserId) return { error: 'Not signed in' };

  const { error } = await supabase
    .from('reactions')
    .upsert({ visit_id: visitId, user_id: myUserId, emoji }, { onConflict: 'visit_id,user_id' });
  if (error) return { error: error.message };

  // Write notification to visit owner (skip if reacting to own visit)
  if (visitOwnerId !== myUserId) {
    const { error: notifError } = await supabase.from('notifications').upsert({
      user_id: visitOwnerId,
      actor_id: myUserId,
      type: 'reaction',
      ref_id: visitId,
    }, { onConflict: 'user_id,actor_id,type,ref_id', ignoreDuplicates: true });
    if (notifError) console.warn('[reactions] notification insert:', notifError.message);
  }

  return {};
}

export async function removeReaction(visitId: string): Promise<{ error?: string }> {
  if (!supabase) return { error: 'Not connected' };
  const { data: userData } = await supabase.auth.getUser();
  const myUserId = userData.user?.id;
  if (!myUserId) return { error: 'Not signed in' };

  const { error } = await supabase
    .from('reactions')
    .delete()
    .eq('visit_id', visitId)
    .eq('user_id', myUserId);
  if (error) return { error: error.message };
  return {};
}
