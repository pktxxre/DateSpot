import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, View, Text, Pressable, Share, Modal,
  TextInput, FlatList, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { T, Fonts } from '@/lib/theme';
import {
  searchProfiles, sendFriendRequest, getFriendsWithStats, getFriendActivity,
  getFriendRecommendations,
  FriendProfile, FriendWithStats, FriendActivityItem, FriendRecommendation,
} from '@/lib/friends';
import { getUnreadCount } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

// ─── Avatar color palette ────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#E8A87C', '#6DBFB8', '#C3A7D4', '#A0C4A8', '#E88C8C',
  '#7BA7CC', '#D4B896', '#9BBFA8', '#C4A0B8', '#E8C47A',
];

function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initial(username: string): string {
  return (username?.[0] ?? '?').toUpperCase();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

const ACTIVITY_LABEL: Record<string, string> = {
  food: 'Food', bars: 'Drinks', cafes: 'Cafes',
  outdoors: 'Outdoors', indoors: 'Indoors', view: 'Views',
  entertainment: 'Entertainment', shopping: 'Shopping', other: 'Other',
};

// ─── Add Friend Modal ─────────────────────────────────────────────────────────

function AddFriendModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    supabase?.auth.getUser().then(({ data }) => setMyUserId(data.user?.id ?? null));
  }, [visible]);

  useEffect(() => {
    if (!visible) { setQuery(''); setResults([]); setSentRequests(new Set()); }
  }, [visible]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const found = await searchProfiles(query);
      setResults(myUserId ? found.filter(p => p.id !== myUserId) : found);
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [query, myUserId]);

  const handleAdd = async (profile: FriendProfile) => {
    if (!myUserId) return;
    const { error } = await sendFriendRequest(myUserId, profile.id);
    if (!error || error === 'already_sent') setSentRequests(prev => new Set(prev).add(profile.id));
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <SafeAreaView style={m.safe} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={m.handleWrap}><View style={m.handle} /></View>
          <View style={m.header}>
            <Text style={m.title}>Add Friend</Text>
            <Pressable style={m.closeBtn} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={T.primary} />
            </Pressable>
          </View>
          <View style={m.searchRow}>
            <Ionicons name="search-outline" size={16} color={T.muted} />
            <TextInput
              style={m.searchInput} placeholder="Search by name or @handle"
              placeholderTextColor={T.placeholder} value={query} onChangeText={setQuery}
              autoFocus autoCapitalize="none" autoCorrect={false} returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={T.muted} />
              </Pressable>
            )}
          </View>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 48 }} color={T.accent} />
          ) : results.length > 0 ? (
            <FlatList
              data={results} keyExtractor={item => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={m.listContent}
              renderItem={({ item }) => {
                const sent = sentRequests.has(item.id);
                const color = avatarColor(item.id);
                return (
                  <View style={m.resultRow}>
                    <View style={[m.avatar, { backgroundColor: color }]}>
                      <Text style={m.avatarLetter}>{initial(item.username)}</Text>
                    </View>
                    <View style={m.resultInfo}>
                      <Text style={m.resultName} numberOfLines={1}>{item.username}</Text>
                      {item.handle ? <Text style={m.resultHandle}>@{item.handle}</Text> : null}
                    </View>
                    <Pressable style={[m.addBtn, sent && m.addBtnSent]} onPress={() => handleAdd(item)} disabled={sent}>
                      <Text style={[m.addBtnText, sent && m.addBtnTextSent]}>{sent ? 'Sent' : 'Add'}</Text>
                    </Pressable>
                  </View>
                );
              }}
            />
          ) : query.trim().length > 0 ? (
            <View style={m.emptyWrap}>
              <Ionicons name="person-outline" size={40} color={T.border} />
              <Text style={m.emptyText}>No users found</Text>
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

// ─── Friend initial avatar ────────────────────────────────────────────────────

function FriendAvatar({ friend, size = 44 }: { friend: { id: string; username: string; profilePhotoUri: string | null }; size?: number }) {
  const color = avatarColor(friend.id);
  const radius = size / 2;
  if (friend.profilePhotoUri) {
    return (
      <Image
        source={{ uri: friend.profilePhotoUri }}
        style={{ width: size, height: size, borderRadius: radius }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.38, fontWeight: '700', color: '#fff' }}>{initial(friend.username)}</Text>
    </View>
  );
}

// ─── Activity card ────────────────────────────────────────────────────────────

function ActivityCard({ item }: { item: FriendActivityItem }) {
  const actLabel = ACTIVITY_LABEL[item.activityType] ?? item.activityType;
  const showRating = item.rating > 0;

  return (
    <View style={s.card}>
      {/* Top row */}
      <View style={s.cardTop}>
        <FriendAvatar friend={item.friend} size={42} />
        <View style={s.cardMeta}>
          <Text style={s.cardTitle} numberOfLines={2}>
            <Text style={s.cardFriendName}>{item.friend.username}</Text>
            <Text style={s.cardAction}>{' logged '}</Text>
            <Text style={s.cardVenue}>{item.venueName}</Text>
          </Text>
          <View style={s.cardSubRow}>
            {showRating && (
              <View style={s.ratingBadge}>
                <Text style={s.ratingText}>{item.rating.toFixed(1)}</Text>
              </View>
            )}
            <Text style={s.cardType}>{actLabel}</Text>
          </View>
        </View>
        <Text style={s.cardTime}>{timeAgo(item.visitedAt)}</Text>
      </View>

      {/* Notes */}
      {!!item.notes && (
        <Text style={s.cardNotes} numberOfLines={2}>"{item.notes}"</Text>
      )}

      {/* Actions */}
      <View style={s.cardActions}>
        <Pressable style={s.actionBtn} onPress={() => {}}>
          <Ionicons name="add" size={13} color={T.accent} />
          <Text style={s.actionBtnText}>Want to go</Text>
        </Pressable>
        <Pressable style={s.actionBtn} onPress={() => router.push(`/spot/${item.visitId}`)}>
          <Ionicons name="heart-outline" size={13} color={T.accent} />
          <Text style={s.actionBtnText}>React</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Recommendation card ──────────────────────────────────────────────────────

function RecommendationCard({ rec }: { rec: FriendRecommendation }) {
  const actLabel = ACTIVITY_LABEL[rec.activityType] ?? rec.activityType;
  return (
    <View style={s.recCard}>
      <View style={s.recTop}>
        <Text style={s.recType}>{actLabel.toUpperCase()}</Text>
        <View style={s.ratingBadge}>
          <Text style={s.ratingText}>{rec.avgRating.toFixed(1)}</Text>
        </View>
      </View>
      <Text style={s.recVenue} numberOfLines={2}>{rec.venueName}</Text>
      <View style={s.recFriendsRow}>
        {rec.friends.slice(0, 3).map((f, i) => (
          <View key={i} style={[s.recAvatarWrap, { marginLeft: i > 0 ? -8 : 0, zIndex: 3 - i }]}>
            <FriendAvatar friend={{ id: f.username, username: f.username, profilePhotoUri: null }} size={22} />
          </View>
        ))}
        <Text style={s.recFriendCount}>
          {' '}{rec.friends.length} friend{rec.friends.length !== 1 ? 's' : ''} loved this
        </Text>
      </View>
    </View>
  );
}

// ─── Friend list row ──────────────────────────────────────────────────────────

function FriendRow({ friend }: { friend: FriendWithStats }) {
  return (
    <Pressable style={s.friendRow}>
      <FriendAvatar friend={friend} size={46} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.friendName}>{friend.username}</Text>
        <Text style={s.friendSub}>
          {friend.handle ? `@${friend.handle} · ` : ''}{friend.spotCount} spot{friend.spotCount !== 1 ? 's' : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={T.border} />
    </Pressable>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function FriendsScreen() {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [friends, setFriends] = useState<FriendWithStats[]>([]);
  const [activity, setActivity] = useState<FriendActivityItem[]>([]);
  const [recommendations, setRecommendations] = useState<FriendRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [fr, act, recs, count] = await Promise.all([
      getFriendsWithStats(),
      getFriendActivity(),
      getFriendRecommendations(),
      getUnreadCount(),
    ]);
    setFriends(fr);
    setActivity(act);
    setRecommendations(recs);
    setUnreadCount(count);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const hasFriends = friends.length > 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.friendCount}>{friends.length} FRIENDS</Text>
          <Text style={s.title}>Friends</Text>
        </View>
        <View style={s.headerIcons}>
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
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
          {/* Inline search bar */}
          <Pressable style={s.searchBar} onPress={() => setAddModalOpen(true)}>
            <Ionicons name="search-outline" size={16} color={T.muted} />
            <Text style={s.searchPlaceholder}>Find friends by name or @handle</Text>
          </Pressable>

          {!hasFriends ? (
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
          ) : (
            <>
              {/* Recent activity */}
              {activity.length > 0 && (
                <View style={s.section}>
                  <Text style={s.sectionTitle}>Recent activity</Text>
                  {activity.slice(0, 10).map(item => (
                    <ActivityCard key={item.visitId} item={item} />
                  ))}
                </View>
              )}

              {/* Recommended by friends */}
              {recommendations.length > 0 && (
                <View style={s.section}>
                  <View style={s.sectionRow}>
                    <View>
                      <Text style={s.sectionTitle}>Recommended by friends</Text>
                      <Text style={s.sectionSub}>Loved by people you trust</Text>
                    </View>
                    <Pressable hitSlop={8}>
                      <Text style={s.seeAll}>See all →</Text>
                    </Pressable>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recScroll}>
                    {recommendations.map((rec, i) => (
                      <RecommendationCard key={i} rec={rec} />
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Your friends */}
              <View style={s.section}>
                <View style={s.sectionRow}>
                  <Text style={s.sectionTitle}>Your friends</Text>
                  <Pressable hitSlop={8}>
                    <Text style={s.seeAll}>See all →</Text>
                  </Pressable>
                </View>
                {friends.map(f => <FriendRow key={f.id} friend={f} />)}
              </View>
            </>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      <AddFriendModal visible={addModalOpen} onClose={() => setAddModalOpen(false)} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F0EB' },
  scroll: { paddingBottom: 20 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14,
    backgroundColor: '#F5F0EB',
  },
  friendCount: {
    fontSize: 11, fontWeight: '700', color: T.muted,
    letterSpacing: 1.5, marginBottom: 2,
  },
  title: {
    fontSize: 34, color: T.primary,
    fontFamily: Fonts.serif, lineHeight: 38,
  },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 4 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EDE7DE', alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: 0, right: 0,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#E53935', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: '#F5F0EB',
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },

  // Search bar
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 20,
    backgroundColor: '#FFFFFF', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 13,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  searchPlaceholder: { fontSize: 15, color: T.placeholder, fontFamily: Fonts.sans },

  // Sections
  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 20, color: T.primary, fontFamily: Fonts.serif,
    marginHorizontal: 16, marginBottom: 2,
  },
  sectionSub: { fontSize: 13, color: T.muted, marginHorizontal: 16, marginBottom: 12 },
  sectionRow: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    marginHorizontal: 16, marginBottom: 12,
  },
  seeAll: { fontSize: 14, fontWeight: '600', color: T.accent },

  // Activity card
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, marginHorizontal: 16,
    marginBottom: 12, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardMeta: { flex: 1 },
  cardTitle: { fontSize: 14, color: T.primary, lineHeight: 20, marginBottom: 4 },
  cardFriendName: { fontWeight: '700' },
  cardAction: { fontWeight: '400', color: T.muted },
  cardVenue: { fontWeight: '700' },
  cardSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardType: { fontSize: 12, color: T.muted },
  cardTime: { fontSize: 12, color: T.muted },
  ratingBadge: {
    borderWidth: 1.5, borderColor: '#3D8B5E', borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  ratingText: { fontSize: 12, fontWeight: '700', color: '#3D8B5E' },
  cardNotes: {
    fontSize: 13, color: T.muted, fontStyle: 'italic',
    marginTop: 8, lineHeight: 18,
  },
  cardActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: T.border, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  actionBtnText: { fontSize: 13, fontWeight: '500', color: T.primary },

  // Recommendation cards
  recScroll: { paddingLeft: 16, paddingRight: 8 },
  recCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14,
    padding: 14, marginRight: 10, width: 190,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  recTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  recType: { fontSize: 10, fontWeight: '700', color: T.muted, letterSpacing: 1 },
  recVenue: { fontSize: 16, fontWeight: '700', color: T.primary, fontFamily: Fonts.serif, marginBottom: 10 },
  recFriendsRow: { flexDirection: 'row', alignItems: 'center' },
  recAvatarWrap: { borderWidth: 1.5, borderColor: '#F5F0EB', borderRadius: 12 },
  recFriendCount: { fontSize: 12, color: T.muted, marginLeft: 6 },

  // Friend list
  friendRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border,
  },
  friendName: { fontSize: 15, fontWeight: '600', color: T.primary },
  friendSub: { fontSize: 13, color: T.muted, marginTop: 1 },

  // Empty state
  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: T.primary, fontFamily: Fonts.serif },
  emptySub: { fontSize: 15, color: T.muted, textAlign: 'center', lineHeight: 22 },
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: T.accent, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  inviteBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});

// ─── Modal styles ─────────────────────────────────────────────────────────────

const m = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  handleWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: T.border },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  title: { fontSize: 20, fontWeight: '700', color: T.primary, fontFamily: Fonts.serif },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: T.inputBg, alignItems: 'center', justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginBottom: 12,
    backgroundColor: T.inputBg, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: T.primary, fontFamily: Fonts.sans, padding: 0 },
  listContent: { paddingHorizontal: 20, paddingTop: 4 },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border, gap: 12,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 17, fontWeight: '700', color: '#fff' },
  resultInfo: { flex: 1, gap: 2 },
  resultName: { fontSize: 15, fontWeight: '600', color: T.primary },
  resultHandle: { fontSize: 13, color: T.muted },
  addBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: T.accent },
  addBtnSent: { backgroundColor: T.inputBg },
  addBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  addBtnTextSent: { color: T.muted },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', color: T.primary },
  emptyHint: { fontSize: 14, color: T.muted, textAlign: 'center' },
});
