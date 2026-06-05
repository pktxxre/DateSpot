import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Image, AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { T } from '@/lib/theme';
import { fetchNotifications, markAllRead, Notification } from '@/lib/notifications';
import { acceptFriendRequest, declineFriendRequest, notifyFriendAccepted } from '@/lib/friends';
import { getVisitById } from '@/lib/visits';
import { useShimmer, SkBox } from '@/components/SkeletonBox';
import AsyncStorage from '@react-native-async-storage/async-storage';

const INBOX_CACHE_KEY = 'datespot:notifications_cache_v1';

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

function ActorAvatar({ notification }: { notification: Notification }) {
  const { actor } = notification;
  if (!actor) return (
    <View style={s.avatar}>
      <Text style={s.avatarText}>:)</Text>
    </View>
  );
  if (actor.profilePhotoUri) {
    return (
      <View style={s.avatar}>
        <Image source={{ uri: actor.profilePhotoUri }} style={s.avatarImg} resizeMode="cover" />
      </View>
    );
  }
  return (
    <View style={s.avatar}>
      <Text style={s.avatarText}>{actor.avatarEmoticon || ':)'}</Text>
    </View>
  );
}

function FriendRequestRow({
  notification,
  onAccepted,
  onDeclined,
}: {
  notification: Notification;
  onAccepted: (id: string) => void;
  onDeclined: (id: string) => void;
}) {
  const initialStatus =
    notification.friendStatus === 'accepted' ? 'accepted'
    : notification.friendStatus === 'declined' ? 'declined'
    : 'pending';
  const [status, setStatus] = useState<'pending' | 'accepted' | 'declined' | 'loading'>(initialStatus);
  const actorName = notification.actor?.username ?? 'Someone';

  async function handleAccept() {
    if (!notification.refId) return;
    setStatus('loading');
    const { error } = await acceptFriendRequest(notification.refId);
    if (error) { setStatus('pending'); return; }
    // Notify the requester that their request was accepted
    await notifyFriendAccepted(notification.actorId, notification.refId);
    setStatus('accepted');
    onAccepted(notification.id);
  }

  async function handleDecline() {
    if (!notification.refId) return;
    setStatus('loading');
    const { error } = await declineFriendRequest(notification.refId);
    if (error) { setStatus('pending'); return; }
    setStatus('declined');
    onDeclined(notification.id);
  }

  return (
    <View style={s.row}>
      <ActorAvatar notification={notification} />
      <View style={s.rowContent}>
        <Text style={s.rowText}>
          <Text style={s.rowBold}>{actorName}</Text>
          {' sent you a friend request'}
        </Text>
        <Text style={s.rowTime}>{timeAgo(notification.createdAt)}</Text>
        {status === 'pending' && (
          <View style={s.actionRow}>
            <Pressable style={s.acceptBtn} onPress={handleAccept}>
              <Text style={s.acceptBtnText}>Accept</Text>
            </Pressable>
            <Pressable style={s.declineBtn} onPress={handleDecline}>
              <Text style={s.declineBtnText}>Decline</Text>
            </Pressable>
          </View>
        )}
        {status === 'loading' && <ActivityIndicator size="small" color={T.accent} style={{ marginTop: 8 }} />}
        {status === 'declined' && <Text style={[s.statusText, { color: T.muted }]}>Declined</Text>}
      </View>
    </View>
  );
}

function FriendAcceptedRow({ notification }: { notification: Notification }) {
  const actorName = notification.actor?.username ?? 'Someone';
  return (
    <View style={s.row}>
      <ActorAvatar notification={notification} />
      <View style={s.rowContent}>
        <Text style={s.rowText}>
          <Text style={s.rowBold}>{actorName}</Text>
          {' accepted your friend request'}
        </Text>
        <Text style={s.rowTime}>{timeAgo(notification.createdAt)}</Text>
        <Text style={s.statusText}>Friends now!</Text>
      </View>
    </View>
  );
}

function ReactionRow({ notification }: { notification: Notification }) {
  const actorName = notification.actor?.username ?? 'Someone';
  const visitId = notification.refId;
  const visit = visitId ? getVisitById(visitId) : null;
  const venueName = visit?.venue_name ?? null;

  function handlePress() {
    if (visitId) router.push(`/spot/${visitId}`);
  }

  return (
    <Pressable style={s.row} onPress={handlePress}>
      <ActorAvatar notification={notification} />
      <View style={s.rowContent}>
        <Text style={s.rowText}>
          <Text style={s.rowBold}>{actorName}</Text>
          {' reacted to your spot'}
          {venueName ? <Text>{' at '}<Text style={s.rowBold}>{venueName}</Text></Text> : null}
        </Text>
        <Text style={s.rowTime}>{timeAgo(notification.createdAt)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={T.border} />
    </Pressable>
  );
}

function LikeRow({ notification }: { notification: Notification }) {
  const actorName = notification.actor?.username ?? 'Someone';
  const visitId = notification.refId;
  const visit = visitId ? getVisitById(visitId) : null;
  const venueName = visit?.venue_name ?? null;

  return (
    <Pressable style={s.row} onPress={() => { if (visitId) router.push(`/spot/${visitId}`); }}>
      <ActorAvatar notification={notification} />
      <View style={s.rowContent}>
        <Text style={s.rowText}>
          <Text style={s.rowBold}>{actorName}</Text>
          {' liked your spot'}
          {venueName ? <Text>{' at '}<Text style={s.rowBold}>{venueName}</Text></Text> : null}
        </Text>
        <Text style={s.rowTime}>{timeAgo(notification.createdAt)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={T.border} />
    </Pressable>
  );
}

function SaveRow({ notification }: { notification: Notification }) {
  const actorName = notification.actor?.username ?? 'Someone';
  const visitId = notification.refId;
  const visit = visitId ? getVisitById(visitId) : null;
  const venueName = visit?.venue_name ?? null;

  return (
    <Pressable style={s.row} onPress={() => { if (visitId) router.push(`/spot/${visitId}`); }}>
      <ActorAvatar notification={notification} />
      <View style={s.rowContent}>
        <Text style={s.rowText}>
          <Text style={s.rowBold}>{actorName}</Text>
          {' saved your spot'}
          {venueName ? <Text>{' at '}<Text style={s.rowBold}>{venueName}</Text></Text> : null}
        </Text>
        <Text style={s.rowTime}>{timeAgo(notification.createdAt)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={T.border} />
    </Pressable>
  );
}

function LogRow({ notification }: { notification: Notification }) {
  const actorName = notification.actor?.username ?? 'Someone';
  const visitId = notification.refId;
  const visit = visitId ? getVisitById(visitId) : null;
  const venueName = visit?.venue_name ?? null;

  return (
    <Pressable style={s.row} onPress={() => { if (visitId) router.push(`/spot/${visitId}`); }}>
      <ActorAvatar notification={notification} />
      <View style={s.rowContent}>
        <Text style={s.rowText}>
          <Text style={s.rowBold}>{actorName}</Text>
          {' logged your spot'}
          {venueName ? <Text>{' at '}<Text style={s.rowBold}>{venueName}</Text></Text> : null}
        </Text>
        <Text style={s.rowTime}>{timeAgo(notification.createdAt)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={T.border} />
    </Pressable>
  );
}

function InboxSkeleton() {
  const { shimmer, screenW } = useShimmer();
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
      {[0, 1, 2, 3].map(i => (
        <View key={i} style={{ flexDirection: 'row', gap: 12, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border }}>
          <SkBox shimmer={shimmer} screenW={screenW} w={44} h={44} r={22} />
          <View style={{ flex: 1, gap: 8 }}>
            <SkBox shimmer={shimmer} screenW={screenW} w="85%" h={13} r={6} />
            <SkBox shimmer={shimmer} screenW={screenW} w="40%" h={11} r={5} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default function InboxScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    // Stale-while-revalidate: show cached notifications immediately
    const cached = await AsyncStorage.getItem(INBOX_CACHE_KEY);
    if (cached) {
      setNotifications(JSON.parse(cached));
      setLoading(false);
    } else {
      setLoading(true);
    }
    const data = await fetchNotifications();
    if (data === null) {
      if (!cached) setError(true);
    } else {
      setNotifications(data);
      AsyncStorage.setItem(INBOX_CACHE_KEY, JSON.stringify(data));
    }
    setLoading(false);
    await markAllRead();
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    // Keep notifications live while the screen is open.
    const interval = setInterval(load, 15000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => { clearInterval(interval); sub.remove(); };
  }, [load]));

  function handleAccepted(notifId: string) {
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, readAt: new Date().toISOString() } : n));
  }

  function handleDeclined(notifId: string) {
    setNotifications(prev => prev.filter(n => n.id !== notifId));
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.backBtn}>
          <Ionicons name="chevron-back" size={22} color={T.primary} />
        </Pressable>
        <Text style={s.title}>Notifications</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <InboxSkeleton />
      ) : error ? (
        <View style={s.centerWrap}>
          <Text style={s.emptyTitle}>Couldn't load notifications</Text>
          <Pressable onPress={load} style={s.retryBtn}>
            <Text style={s.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : notifications.length === 0 ? (
        <View style={s.centerWrap}>
          <Ionicons name="notifications-outline" size={48} color={T.border} />
          <Text style={s.emptyTitle}>No notifications yet</Text>
          <Text style={s.emptySub}>When friends send requests or react to your spots, you'll see them here.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          contentContainerStyle={s.listContent}
          renderItem={({ item }) => {
            if (item.type === 'friend_request') {
              return (
                <FriendRequestRow
                  notification={item}
                  onAccepted={handleAccepted}
                  onDeclined={handleDeclined}
                />
              );
            }
            if (item.type === 'friend_accepted') {
              return <FriendAcceptedRow notification={item} />;
            }
            if (item.type === 'reaction') {
              return <ReactionRow notification={item} />;
            }
            if (item.type === 'like') {
              return <LikeRow notification={item} />;
            }
            if (item.type === 'save') {
              return <SaveRow notification={item} />;
            }
            if (item.type === 'log') {
              return <LogRow notification={item} />;
            }
            return null;
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  backBtn: {
    width: 38, height: 38, alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.inputBg, borderRadius: 19,
  },
  title: {
    fontSize: 18, fontWeight: '400', color: T.primary,
    fontFamily: 'Fraunces-Regular',
  },
  listContent: { paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
    gap: 12,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    // Matches the follow-list / following-tab avatar placeholder for consistency.
    backgroundColor: '#E8C5B8',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 44, height: 44 },
  avatarText: { fontSize: 14, color: T.primary },
  rowContent: { flex: 1, gap: 4 },
  rowText: { fontSize: 14, color: T.primary, lineHeight: 20 },
  rowBold: { fontWeight: '700' },
  rowTime: { fontSize: 12, color: T.muted },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  acceptBtn: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20, backgroundColor: T.accent,
  },
  acceptBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  declineBtn: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20, backgroundColor: T.inputBg,
  },
  declineBtnText: { fontSize: 13, fontWeight: '600', color: T.muted },
  statusText: { fontSize: 13, fontWeight: '600', color: T.accent, marginTop: 6 },
  centerWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '400', color: T.primary, fontFamily: 'Fraunces-Regular', },
  emptySub: { fontSize: 14, color: T.muted, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 12, backgroundColor: T.inputBg, marginTop: 4,
  },
  retryText: { fontSize: 14, fontWeight: '600', color: T.primary },
});
