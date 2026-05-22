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
  lat: number;
  lng: number;
  visitedAt: string;
  triage: string;
  activityType: string;
  occasionType: string | null;
  rating: number;
  notes: string | null;
  friend: AcceptedFriend;
}

export interface FriendWithStats extends AcceptedFriend {
  spotCount: number;
}

export interface FriendRecommendation {
  venueName: string;
  activityType: string;
  avgRating: number;
  friends: Array<{ username: string; avatarEmoticon: string }>;
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
    .select('id, venue_name, lat, lng, visited_at, triage, activity_type, occasion_type, rating, notes, user_id')
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
      lat: v.lat ?? 0,
      lng: v.lng ?? 0,
      visitedAt: v.visited_at,
      triage: v.triage,
      activityType: v.activity_type,
      occasionType: v.occasion_type ?? null,
      rating: v.rating ?? 0,
      notes: v.notes ?? null,
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

export async function getFriendsWithStats(): Promise<FriendWithStats[]> {
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

  const counts = await Promise.all(friendIds.map(async (id) => {
    const { count } = await supabase!
      .from('visits')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', id)
      .eq('is_seed', false);
    return { id, count: count ?? 0 };
  }));
  const countMap = new Map(counts.map(r => [r.id, r.count]));

  return (profiles ?? []).map((p: any) => ({
    id: p.id,
    username: p.username,
    handle: p.handle,
    avatarEmoticon: p.avatar_emoticon,
    profilePhotoUri: p.profile_photo_uri,
    spotCount: countMap.get(p.id) ?? 0,
  }));
}

export async function getFriendRecommendations(): Promise<FriendRecommendation[]> {
  if (!supabase) return [];
  const { data: userData } = await supabase.auth.getUser();
  const myUserId = userData.user?.id;
  if (!myUserId) return [];

  const friendIds = await getAcceptedFriendIds(myUserId);
  if (friendIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, avatar_emoticon')
    .in('id', friendIds);
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

  const { data: visits } = await supabase
    .from('visits')
    .select('venue_name, activity_type, rating, user_id')
    .in('user_id', friendIds)
    .eq('is_seed', false)
    .gte('rating', 7)
    .order('rating', { ascending: false })
    .limit(60);

  if (!visits || visits.length === 0) return [];

  const venueMap = new Map<string, { activityType: string; ratings: number[]; friendIds: string[] }>();
  for (const v of visits as any[]) {
    if (!venueMap.has(v.venue_name)) {
      venueMap.set(v.venue_name, { activityType: v.activity_type, ratings: [], friendIds: [] });
    }
    const entry = venueMap.get(v.venue_name)!;
    entry.ratings.push(v.rating);
    if (!entry.friendIds.includes(v.user_id)) entry.friendIds.push(v.user_id);
  }

  return Array.from(venueMap.entries())
    .map(([name, data]) => ({
      venueName: name,
      activityType: data.activityType,
      avgRating: Math.round((data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length) * 10) / 10,
      friends: data.friendIds.slice(0, 3).map(id => {
        const p = profileMap.get(id);
        return { username: p?.username ?? '?', avatarEmoticon: p?.avatar_emoticon ?? ':)' };
      }),
    }))
    .sort((a, b) => b.friends.length - a.friends.length || b.avgRating - a.avgRating)
    .slice(0, 10);
}
