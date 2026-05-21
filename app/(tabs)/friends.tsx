import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, Pressable, Share, Modal,
  TextInput, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { T } from '@/lib/theme';
import {
  searchProfiles, sendFriendRequest, getFriends, getFriendActivity,
  FriendProfile, AcceptedFriend, FriendActivityItem,
} from '@/lib/friends';
import { getUnreadCount } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

function AddFriendModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    supabase?.auth.getUser().then(({ data }) => {
      setMyUserId(data.user?.id ?? null);
    });
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setSentRequests(new Set());
      return;
    }
  }, [visible]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      const found = await searchProfiles(query);
      setResults(myUserId ? found.filter(p => p.id !== myUserId) : found);
      setLoading(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [query, myUserId]);

  const handleAdd = async (profile: FriendProfile) => {
    if (!myUserId) return;
    const { error } = await sendFriendRequest(myUserId, profile.id);
    if (!error || error === 'already_sent') {
      setSentRequests(prev => new Set(prev).add(profile.id));
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={m.safe} edges={['top']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Handle bar */}
          <View style={m.handleWrap}>
            <View style={m.handle} />
          </View>

          {/* Header */}
          <View style={m.header}>
            <Text style={m.title}>Add Friend</Text>
            <Pressable style={m.closeBtn} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={T.primary} />
            </Pressable>
          </View>

          {/* Search input */}
          <View style={m.searchRow}>
            <Ionicons name="search-outline" size={16} color={T.muted} />
            <TextInput
              style={m.searchInput}
              placeholder="Search by name or @handle"
              placeholderTextColor={T.placeholder}
              value={query}
              onChangeText={setQuery}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={T.muted} />
              </Pressable>
            )}
          </View>

          {/* Results / states */}
          {loading ? (
            <ActivityIndicator style={{ marginTop: 48 }} color={T.accent} />
          ) : results.length > 0 ? (
            <FlatList
              data={results}
              keyExtractor={item => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={m.listContent}
              renderItem={({ item }) => {
                const sent = sentRequests.has(item.id);
                return (
                  <View style={m.resultRow}>
                    <View style={m.avatar}>
                      <Text style={m.avatarText}>{item.avatarEmoticon || ':)'}</Text>
                    </View>
                    <View style={m.resultInfo}>
                      <Text style={m.resultName} numberOfLines={1}>{item.username}</Text>
                      {item.handle ? (
                        <Text style={m.resultHandle}>@{item.handle}</Text>
                      ) : null}
                    </View>
                    <Pressable
                      style={[m.addBtn, sent && m.addBtnSent]}
                      onPress={() => handleAdd(item)}
                      disabled={sent}
                    >
                      <Text style={[m.addBtnText, sent && m.addBtnTextSent]}>
                        {sent ? 'Sent' : 'Add'}
                      </Text>
                    </Pressable>
                  </View>
                );
              }}
            />
          ) : query.trim().length > 0 ? (
            <View style={m.emptyWrap}>
              <Ionicons name="person-outline" size={40} color={T.border} />
              <Text style={m.emptyText}>No users found</Text>
              <Text style={m.emptyHint}>Try a different name or handle</Text>
            </View>
          ) : (
            <View style={m.emptyWrap}>
              <Text style={m.emptyHint}>Search by name or @handle to find friends</Text>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

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

function FriendAvatar({ friend }: { friend: AcceptedFriend | FriendActivityItem['friend'] }) {
  if (friend.profilePhotoUri) {
    return (
      <View style={s.avatar}>
        <Image source={{ uri: friend.profilePhotoUri }} style={s.avatarImg} resizeMode="cover" />
      </View>
    );
  }
  return (
    <View style={s.avatar}>
      <Text style={s.avatarText}>{friend.avatarEmoticon || ':)'}</Text>
    </View>
  );
}

function ActivityRow({ item }: { item: FriendActivityItem }) {
  const triageColor = item.triage === 'great' ? '#4CAF50' : item.triage === 'bad' ? '#E53935' : T.muted;
  const triageLabel = item.triage === 'great' ? '★ Great' : item.triage === 'bad' ? '✕ Skip' : '— Okay';

  return (
    <Pressable style={s.activityRow} onPress={() => router.push(`/spot/${item.visitId}`)}>
      <FriendAvatar friend={item.friend} />
      <View style={s.activityContent}>
        <Text style={s.activityText} numberOfLines={2}>
          <Text style={s.activityBold}>{item.friend.username}</Text>
          {' logged '}
          <Text style={s.activityBold}>{item.venueName}</Text>
        </Text>
        <Text style={s.activityMeta}>
          <Text style={{ color: triageColor }}>{triageLabel}</Text>
          {'  ·  '}
          <Text style={{ color: T.muted }}>{timeAgo(item.visitedAt)}</Text>
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={T.border} />
    </Pressable>
  );
}

export default function FriendsScreen() {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [friends, setFriends] = useState<AcceptedFriend[]>([]);
  const [activity, setActivity] = useState<FriendActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [fr, act, count] = await Promise.all([
      getFriends(),
      getFriendActivity(),
      getUnreadCount(),
    ]);
    setFriends(fr);
    setActivity(act);
    setUnreadCount(count);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const hasFriends = friends.length > 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={[s.statLabel, { opacity: 0 }]}> </Text>
          <Text style={s.title}>Friends</Text>
        </View>
        <View style={s.headerActions}>
          <Pressable style={s.iconBtn} hitSlop={8} onPress={() => router.push('/inbox')}>
            <Ionicons name="notifications-outline" size={20} color={T.primary} />
            {unreadCount > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable style={s.iconBtn} hitSlop={8} onPress={() => setAddModalOpen(true)}>
            <Ionicons name="person-add-outline" size={20} color={T.primary} />
          </Pressable>
          <ProfileAvatar onPress={() => router.push('/(tabs)/profile')} />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={T.accent} />
      ) : !hasFriends ? (
        <View style={s.emptyWrap}>
          <Ionicons name="people-outline" size={52} color={T.border} />
          <Text style={s.emptyTitle}>No friends yet</Text>
          <Text style={s.emptySub}>Invite people you trust to share spots and see what they love.</Text>
          <Pressable
            style={s.inviteBtn}
            onPress={() => Share.share({ message: 'Join me on DateSpot!' }).catch(() => {})}
          >
            <Ionicons name="link-outline" size={16} color="#fff" />
            <Text style={s.inviteBtnText}>Share invite link</Text>
          </Pressable>
        </View>
      ) : activity.length === 0 ? (
        <View style={s.emptyWrap}>
          <Ionicons name="map-outline" size={52} color={T.border} />
          <Text style={s.emptyTitle}>No spots logged yet</Text>
          <Text style={s.emptySub}>When your friends log a spot, it'll appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={activity}
          keyExtractor={item => item.visitId}
          contentContainerStyle={s.listContent}
          renderItem={({ item }) => <ActivityRow item={item} />}
        />
      )}

      <AddFriendModal visible={addModalOpen} onClose={() => setAddModalOpen(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: T.bg,
  },
  statLabel: { fontSize: 11, fontWeight: '700', color: T.muted, letterSpacing: 1.5, marginBottom: 2 },
  title: { fontSize: 32, fontWeight: '700', color: T.primary, fontFamily: 'InstrumentSerif-Regular', lineHeight: 36 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: T.inputBg, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 0, right: 0,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#E53935',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: T.bg,
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: T.primary, fontFamily: 'InstrumentSerif-Regular' },
  emptySub: { fontSize: 15, color: T.muted, textAlign: 'center', lineHeight: 22 },
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: T.accent, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  inviteBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  listContent: { paddingVertical: 4 },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
    gap: 12,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: T.inputBg,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 44, height: 44 },
  avatarText: { fontSize: 14, color: T.primary },
  activityContent: { flex: 1, gap: 4 },
  activityText: { fontSize: 14, color: T.primary, lineHeight: 20 },
  activityBold: { fontWeight: '700' },
  activityMeta: { fontSize: 12, color: T.muted },
});

const m = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  handleWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: T.border },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: { fontSize: 20, fontWeight: '700', color: T.primary, fontFamily: 'InstrumentSerif-Regular' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: T.inputBg, alignItems: 'center', justifyContent: 'center',
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: T.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: T.primary,
    fontFamily: 'InstrumentSans-Variable',
    padding: 0,
  },

  listContent: { paddingHorizontal: 20, paddingTop: 4 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
    gap: 12,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: T.inputBg,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 14, color: T.primary },
  resultInfo: { flex: 1, gap: 2 },
  resultName: { fontSize: 15, fontWeight: '600', color: T.primary },
  resultHandle: { fontSize: 13, color: T.muted },

  addBtn: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: T.accent,
  },
  addBtnSent: { backgroundColor: T.inputBg },
  addBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  addBtnTextSent: { color: T.muted },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', color: T.primary },
  emptyHint: { fontSize: 14, color: T.muted, textAlign: 'center' },
});
