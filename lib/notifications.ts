import { supabase } from './supabase';

export interface ActorProfile {
  username: string;
  handle: string;
  avatarEmoticon: string;
  profilePhotoUri: string | null;
}

export interface Notification {
  id: string;
  type: 'friend_request' | 'friend_accepted' | 'reaction' | string;
  refId: string | null;
  readAt: string | null;
  createdAt: string;
  actor: ActorProfile | null;
  actorId: string;
  // Only set for friend_request type: reflects current DB status so UI initializes correctly
  friendStatus?: 'pending' | 'accepted' | 'declined';
}

export async function fetchNotifications(): Promise<Notification[] | null> {
  if (!supabase) return null;
  const { data: userData } = await supabase.auth.getUser();
  const myUserId = userData.user?.id;
  if (!myUserId) return null;

  const { data: notifs, error } = await supabase
    .from('notifications')
    .select('id, type, ref_id, read_at, created_at, actor_id')
    .eq('user_id', myUserId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return null;
  if (!notifs || notifs.length === 0) return [];

  const actorIds = [...new Set(notifs.map((n: any) => n.actor_id as string))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, handle, avatar_emoticon, profile_photo_uri')
    .in('id', actorIds);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  // For friend_request notifications, fetch current DB status so the row
  // initializes with the right state instead of always showing pending.
  const friendRequestRefIds = notifs
    .filter((n: any) => n.type === 'friend_request' && n.ref_id)
    .map((n: any) => n.ref_id as string);

  const friendStatusMap = new Map<string, 'pending' | 'accepted' | 'declined'>();
  if (friendRequestRefIds.length > 0) {
    const { data: friendRows } = await supabase
      .from('friends')
      .select('id, status')
      .in('id', friendRequestRefIds);
    const found = new Set((friendRows ?? []).map((r: any) => r.id));
    for (const refId of friendRequestRefIds) {
      if (!found.has(refId)) {
        friendStatusMap.set(refId, 'declined');
      } else {
        const row = (friendRows ?? []).find((r: any) => r.id === refId);
        friendStatusMap.set(refId, row?.status === 'accepted' ? 'accepted' : 'pending');
      }
    }
  }

  return notifs.map((row: any) => {
    const p = profileMap.get(row.actor_id);
    const result: Notification = {
      id: row.id,
      type: row.type,
      refId: row.ref_id,
      readAt: row.read_at,
      createdAt: row.created_at,
      actorId: row.actor_id,
      actor: p
        ? {
            username: p.username,
            handle: p.handle,
            avatarEmoticon: p.avatar_emoticon,
            profilePhotoUri: p.profile_photo_uri,
          }
        : null,
    };
    if (row.type === 'friend_request' && row.ref_id) {
      result.friendStatus = friendStatusMap.get(row.ref_id) ?? 'pending';
    }
    return result;
  });
}

export async function getUnreadCount(): Promise<number> {
  if (!supabase) return 0;
  const { data: userData } = await supabase.auth.getUser();
  const myUserId = userData.user?.id;
  if (!myUserId) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', myUserId)
    .is('read_at', null);

  if (error) return 0;
  return count ?? 0;
}

export async function notifyActivity(
  recipientId: string,
  type: 'like' | 'log' | 'save',
  refId: string,
): Promise<void> {
  if (!supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  const myUserId = userData.user?.id;
  if (!myUserId || myUserId === recipientId) return;

  await supabase.from('notifications').insert({
    user_id: recipientId,
    actor_id: myUserId,
    type,
    ref_id: refId,
  });
}

export async function markAllRead(): Promise<void> {
  if (!supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  const myUserId = userData.user?.id;
  if (!myUserId) return;

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', myUserId)
    .is('read_at', null);
}
