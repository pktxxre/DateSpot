import { supabase } from './supabase';

export interface FriendProfile {
  id: string;
  username: string;
  handle: string;
  avatarEmoticon: string;
  profilePhotoUri: string | null;
  city: string;
}

export async function searchProfiles(query: string): Promise<FriendProfile[]> {
  if (!supabase || !query.trim()) return [];
  const q = query.trim();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, handle, avatar_emoticon, profile_photo_uri, city')
    .or(`handle.ilike.%${q}%,username.ilike.%${q}%`)
    .limit(20);
  if (error || !data) return [];
  return data.map(row => ({
    id: row.id,
    username: row.username,
    handle: row.handle,
    avatarEmoticon: row.avatar_emoticon,
    profilePhotoUri: row.profile_photo_uri,
    city: row.city,
  }));
}

export async function sendFriendRequest(
  myUserId: string,
  friendId: string,
): Promise<{ error?: string }> {
  if (!supabase) return { error: 'Not connected' };
  const { data, error } = await supabase
    .from('friends')
    .insert({ user_id: myUserId, friend_id: friendId, status: 'pending' })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') return { error: 'already_sent' };
    return { error: error.message };
  }
  // Notify the recipient
  if (data?.id) {
    await supabase.from('notifications').insert({
      user_id: friendId,
      actor_id: myUserId,
      type: 'friend_request',
      ref_id: data.id,
    });
  }
  return {};
}

export async function acceptFriendRequest(
  friendRowId: string,
): Promise<{ error?: string }> {
  if (!supabase) return { error: 'Not connected' };
  const { error } = await supabase.rpc('accept_friend_request', { request_id: friendRowId });
  if (error) return { error: error.message };
  return {};
}

export async function notifyFriendAccepted(
  toUserId: string,
  friendRowId: string,
): Promise<void> {
  if (!supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  const myUserId = userData.user?.id;
  if (!myUserId) return;
  await supabase.from('notifications').insert({
    user_id: toUserId,
    actor_id: myUserId,
    type: 'friend_accepted',
    ref_id: friendRowId,
  });
}

export async function declineFriendRequest(
  friendRowId: string,
): Promise<{ error?: string }> {
  if (!supabase) return { error: 'Not connected' };
  const { error } = await supabase
    .from('friends')
    .delete()
    .eq('id', friendRowId);
  if (error) return { error: error.message };
  return {};
}

export interface AcceptedFriend {
  id: string;
  username: string;
  handle: string;
  avatarEmoticon: string;
  profilePhotoUri: string | null;
}

export interface FriendActivityItem {
  visitId: string;
  venueName: string;
  visitedAt: string;
  triage: string;
  activityType: string;
  friend: AcceptedFriend;
}

async function getAcceptedFriendIds(myUserId: string): Promise<string[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('friends')
    .select('user_id, friend_id')
    .eq('status', 'accepted')
    .or(`user_id.eq.${myUserId},friend_id.eq.${myUserId}`);
  if (!data || data.length === 0) return [];
  return [...new Set(data.map((r: any) =>
    r.user_id === myUserId ? r.friend_id : r.user_id
  ))];
}

export async function getFriends(): Promise<AcceptedFriend[]> {
  if (!supabase) return [];
  const { data: userData } = await supabase.auth.getUser();
  const myUserId = userData.user?.id;
  if (!myUserId) return [];

  const friendIds = await getAcceptedFriendIds(myUserId);
  if (friendIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, handle, avatar_emoticon, profile_photo_uri')
    .in('id', friendIds);

  return (profiles ?? []).map((p: any) => ({
    id: p.id,
    username: p.username,
    handle: p.handle,
    avatarEmoticon: p.avatar_emoticon,
    profilePhotoUri: p.profile_photo_uri,
  }));
}

export async function getFriendActivity(): Promise<FriendActivityItem[]> {
  if (!supabase) return [];
  const { data: userData } = await supabase.auth.getUser();
  const myUserId = userData.user?.id;
  if (!myUserId) return [];

  const friendIds = await getAcceptedFriendIds(myUserId);
  if (friendIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, handle, avatar_emoticon, profile_photo_uri')
    .in('id', friendIds);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  const { data: visits } = await supabase
    .from('visits')
    .select('id, venue_name, visited_at, triage, activity_type, user_id')
    .in('user_id', friendIds)
    .eq('is_seed', false)
    .order('visited_at', { ascending: false })
    .limit(50);

  if (!visits) return [];

  return visits.map((v: any) => {
    const p = profileMap.get(v.user_id);
    return {
      visitId: v.id,
      venueName: v.venue_name,
      visitedAt: v.visited_at,
      triage: v.triage,
      activityType: v.activity_type,
      friend: {
        id: v.user_id,
        username: p?.username ?? 'Someone',
        handle: p?.handle ?? '',
        avatarEmoticon: p?.avatar_emoticon ?? ':)',
        profilePhotoUri: p?.profile_photo_uri ?? null,
      },
    };
  });
}
