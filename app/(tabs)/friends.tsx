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

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG       = '#FFFFFF';
const CARD     = '#FFFFFF';
const BORDER   = '#EDE8E0';
const PRIMARY  = '#4B3621';
const MUTED    = '#8B7762';
const PLACEHOLDER_CLR = '#B0A090';
const ACCENT   = '#E76F51';
const NOTE_CLR = '#A0927E';

// Avatar palette — rotated by deterministic index from id
const AVATAR_PALETTE = ['#F2C18B', '#B5D5C5', '#E8B4D8', '#C9B6E4', '#F4C2A1'];

function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function initial(name: string): string {
  return (name?.[0] ?? '?').toUpperCase();
}

// Rating color ramp
function ratingColor(r: number): string {
  if (r >= 9.0) return '#2E7D32';
  if (r >= 8.0) return '#558B2F';
  if (r >= 7.0) return '#F9A825';
  if (r >= 6.0) return '#EF6C00';
  return '#C62828';
}

const ACTIVITY_LABEL: Record<string, string> = {
  food: 'Food', bars: 'Drinks', cafes: 'Cafes',
  outdoors: 'Outdoors', indoors: 'Indoors', view: 'Views',
  entertainment: 'Entertainment', shopping: 'Shopping', other: 'Other',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ id, name, photoUri, emoticon, size }: { id: string; name: string; photoUri: string | null; emoticon?: string; size: number }) {
  const color = avatarColor(id);
  if (photoUri) {
    return <Image source={{ uri: photoUri }} style={{ width: size, height: size, borderRadius: size / 2 }} resizeMode="cover" />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.42 }}>{emoticon || initial(name)}</Text>
    </View>
  );
}

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
              <Ionicons name="close" size={20} color={PRIMARY} />
            </Pressable>
          </View>
          <View style={m.searchRow}>
            <Ionicons name="search-outline" size={16} color={MUTED} />
            <TextInput
              style={m.searchInput} placeholder="Search by name or @handle"
              placeholderTextColor={PLACEHOLDER_CLR} value={query} onChangeText={setQuery}
              autoFocus autoCapitalize="none" autoCorrect={false} returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={MUTED} />
              </Pressable>
            )}
          </View>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 48 }} color={ACCENT} />
          ) : results.length > 0 ? (
            <FlatList
              data={results} keyExtractor={item => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={m.listContent}
              renderItem={({ item }) => {
                const sent = sentRequests.has(item.id);
                return (
                  <View style={m.resultRow}>
                    <Avatar id={item.id} name={item.username} photoUri={item.profilePhotoUri} size={40} />
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
              <Ionicons name="person-outline" size={40} color={BORDER} />
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

// ─── Activity card ────────────────────────────────────────────────────────────

function ActivityCard({ item }: { item: FriendActivityItem }) {
  const actLabel = ACTIVITY_LABEL[item.activityType] ?? item.activityType;
  const showRating = item.rating > 0;
  const rColor = showRating ? ratingColor(item.rating) : null;

  return (
    <Pressable style={s.card} onPress={() => router.push(`/spot/${item.visitId}` as any)}>
      {/* Top: avatar + meta + rating pill */}
      <View style={s.cardTop}>
        <Avatar
          id={item.friend.id}
          name={item.friend.username}
          photoUri={item.friend.profilePhotoUri}
          emoticon={item.friend.avatarEmoticon}
          size={36}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.cardSentence} numberOfLines={1}>
            <Text style={s.cardWho}>{item.friend.username}</Text>
            <Text style={s.cardVerb}>{' logged '}</Text>
            <Text style={s.cardSpot}>{item.venueName}</Text>
          </Text>
          <View style={s.metaRow}>
            <Text style={s.metaCat}>{actLabel}</Text>
            <Text style={s.cardTime}>{timeAgo(item.visitedAt)}</Text>
          </View>
        </View>
        {/* Rating pill — top right, matches app-wide style */}
        {showRating && rColor && (
          <View style={[s.ratingPill, { borderColor: rColor }]}>
            <Text style={[s.ratingPillText, { color: rColor }]}>{item.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>

      {/* Note — always reserve space so all cards are uniform height */}
      <Text style={s.noteText} numberOfLines={2}>
        {item.notes ? `"${item.notes}"` : ''}
      </Text>

      {/* Action row */}
      <View style={s.actionRow}>
        {/* Log button — circle + icon only */}
        <Pressable style={s.actionCircleBtn} onPress={(e) => { e.stopPropagation(); }}>
          <Ionicons name="add" size={16} color={ACCENT} />
        </Pressable>
        {/* Save / want to go button — bookmark icon only */}
        <Pressable style={s.actionCircleBtn} onPress={(e) => { e.stopPropagation(); }}>
          <Ionicons name="bookmark-outline" size={14} color={MUTED} />
        </Pressable>
      </View>
    </Pressable>
  );
}

// ─── Activity empty state ─────────────────────────────────────────────────────

function ActivityEmpty({ onAddFriends }: { onAddFriends: () => void }) {
  return (
    <View style={s.activityEmpty}>
      <Text style={s.activityEmptyTitle}>It's quiet here.</Text>
      <Text style={s.activityEmptySub}>When friends log dates or save spots, you'll see them here.</Text>
      <Pressable style={s.findFriendsBtn} onPress={onAddFriends}>
        <Text style={s.findFriendsBtnText}>Find friends to follow</Text>
      </Pressable>
    </View>
  );
}

// ─── Recommendation card ──────────────────────────────────────────────────────

function RecCard({ rec }: { rec: FriendRecommendation }) {
  const actLabel = (ACTIVITY_LABEL[rec.activityType] ?? rec.activityType).toUpperCase();
  const displayFriends = rec.friends.slice(0, 3);
  const overflow = rec.friends.length - 3;

  return (
    <Pressable style={s.recCard} onPress={() => {}}>
      {/* Top row */}
      <View style={s.recTopRow}>
        <Text style={s.recCat}>{actLabel}</Text>
        {(() => { const c = ratingColor(rec.avgRating); return (
          <View style={[s.ratingPill, { borderColor: c }]}>
            <Text style={[s.ratingPillText, { color: c }]}>{rec.avgRating.toFixed(1)}</Text>
          </View>
        ); })()}
      </View>

      {/* Venue name */}
      <Text style={s.recVenue} numberOfLines={2}>{rec.venueName}</Text>

      {/* Neighborhood — placeholder since we don't have it */}

      {/* Friend stack */}
      <View style={s.recFooter}>
        <View style={s.avatarCluster}>
          {displayFriends.map((f, i) => (
            <View key={i} style={[s.clusterItem, i > 0 && { marginLeft: -6 }, { zIndex: 3 - i }]}>
              {overflow > 0 && i === 2 ? (
                <View style={[s.overflowBubble]}>
                  <Text style={s.overflowText}>+{overflow + 1}</Text>
                </View>
              ) : (
                <Avatar id={f.username} name={f.username} photoUri={null} emoticon={f.avatarEmoticon} size={20} />
              )}
            </View>
          ))}
        </View>
        <Text style={s.recFriendCount}>
          {rec.friends.length} friend{rec.friends.length !== 1 ? 's' : ''} loved this
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Friend row ───────────────────────────────────────────────────────────────

function FriendRow({ friend, isLast }: { friend: FriendWithStats; isLast: boolean }) {
  return (
    <Pressable style={[s.friendRow, !isLast && s.friendRowBorder]}>
      <Avatar id={friend.id} name={friend.username} photoUri={friend.profilePhotoUri} emoticon={friend.avatarEmoticon} size={40} />
      <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
        <Text style={s.friendName} numberOfLines={1}>{friend.username}</Text>
        <Text style={s.friendSub}>
          {friend.handle ? `@${friend.handle} · ` : ''}{friend.spotCount} spot{friend.spotCount !== 1 ? 's' : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={MUTED} />
    </Pressable>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: string }) {
  return (
    <View style={s.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>{title}</Text>
        {!!subtitle && <Text style={s.sectionSub}>{subtitle}</Text>}
      </View>
      {!!action && <Text style={s.sectionAction}>{action} →</Text>}
    </View>
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
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [fr, act, recs, count] = await Promise.all([
      getFriendsWithStats(),
      getFriendActivity(),
      getFriendRecommendations(),
      getUnreadCount(),
    ]);
    // Sort friends alphabetically
    setFriends(fr.sort((a, b) => a.username.localeCompare(b.username)));
    setActivity(act);
    setRecommendations(recs);
    setUnreadCount(count);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const hasFriends = friends.length > 0;

  // When search is active, filter friends list only
  const q = searchQuery.trim().toLowerCase();
  const filteredFriends = q
    ? friends.filter(f =>
        f.username.toLowerCase().includes(q) ||
        f.handle.toLowerCase().includes(q)
      )
    : friends;
  const isSearching = q.length > 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.friendCountLabel}>{friends.length} FRIENDS</Text>
          <Text style={s.pageTitle}>Friends</Text>
        </View>
        <View style={s.headerIcons}>
          <Pressable style={s.iconBtn} hitSlop={8} onPress={() => router.push('/inbox')}>
            <Ionicons name="notifications-outline" size={20} color={PRIMARY} />
            {unreadCount > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable style={s.iconBtn} hitSlop={8} onPress={() => setAddModalOpen(true)}>
            <Ionicons name="person-add-outline" size={20} color={PRIMARY} />
          </Pressable>
          <ProfileAvatar onPress={() => router.push('/(tabs)/profile')} />
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={ACCENT} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Search field */}
          <View style={s.searchWrap}>
            <Ionicons name="search-outline" size={16} color={MUTED} style={{ marginRight: 8 }} />
            <TextInput
              style={s.searchInput}
              placeholder="Find friends by name or @handle"
              placeholderTextColor={PLACEHOLDER_CLR}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={15} color={MUTED} />
              </Pressable>
            )}
          </View>

          {/* Search mode: show filtered friends only */}
          {isSearching ? (
            <View style={{ paddingHorizontal: 20, paddingBottom: 110 }}>
              {filteredFriends.length === 0 ? (
                <View style={{ alignItems: 'center', paddingTop: 40, gap: 10 }}>
                  <Ionicons name="person-outline" size={40} color={BORDER} />
                  <Text style={{ fontSize: 14, color: MUTED }}>No friends match "{searchQuery}"</Text>
                  <Pressable style={s.findFriendsBtn} onPress={() => { setSearchQuery(''); setAddModalOpen(true); }}>
                    <Text style={s.findFriendsBtnText}>Add friends</Text>
                  </Pressable>
                </View>
              ) : (
                filteredFriends.map((f, i) => (
                  <FriendRow key={f.id} friend={f} isLast={i === filteredFriends.length - 1} />
                ))
              )}
            </View>
          ) : !hasFriends ? (
            /* No friends at all */
            <View style={s.noFriendsWrap}>
              <Ionicons name="people-outline" size={52} color={BORDER} />
              <Text style={s.noFriendsTitle}>No friends yet</Text>
              <Text style={s.noFriendsSub}>Invite people you trust to share spots and see what they love.</Text>
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
              {/* ── Recent activity ── */}
              <View style={s.sectionWrap}>
                <SectionHeader title="Recent activity" />
                {activity.length === 0 ? (
                  <View style={{ paddingHorizontal: 20 }}>
                    <ActivityEmpty onAddFriends={() => setAddModalOpen(true)} />
                  </View>
                ) : (
                  <View style={s.cardsStack}>
                    {activity.slice(0, 10).map(item => (
                      <ActivityCard key={item.visitId} item={item} />
                    ))}
                  </View>
                )}
              </View>

              {/* ── Recommended by friends ── */}
              {recommendations.length > 0 && (
                <View style={s.sectionWrap}>
                  <SectionHeader
                    title="Recommended by friends"
                    subtitle="Loved by people you trust"
                    action="See all"
                  />
                  <ScrollView
                    horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={s.recScroll}
                  >
                    {recommendations.map((rec, i) => (
                      <RecCard key={i} rec={rec} />
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* ── Your friends ── */}
              <View style={s.sectionWrap}>
                <SectionHeader
                  title="Your friends"
                  action={friends.length > 8 ? 'See all' : undefined}
                />
                <View style={s.friendsList}>
                  {friends.map((f, i) => (
                    <FriendRow key={f.id} friend={f} isLast={i === friends.length - 1} />
                  ))}
                </View>
              </View>
            </>
          )}
        </ScrollView>
      )}

      <AddFriendModal visible={addModalOpen} onClose={() => setAddModalOpen(false)} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 4, paddingBottom: 14,
  },
  friendCountLabel: {
    fontSize: 11, fontWeight: '700', color: MUTED, letterSpacing: 1.5, marginBottom: 2,
  },
  pageTitle: { fontSize: 34, color: PRIMARY, fontFamily: Fonts.serif, lineHeight: 38 },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 4 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EDE7DE', alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: 0, right: 0,
    minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#E53935',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: BG,
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },

  // Search field
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: CARD, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 11,
    borderWidth: 1, borderColor: BORDER,
  },
  searchInput: { flex: 1, fontSize: 14, color: PRIMARY, padding: 0 },

  // Section wrapper spacing
  sectionWrap: { marginBottom: 0 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10,
  },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: PRIMARY, fontFamily: Fonts.serif, letterSpacing: -0.2 },
  sectionSub: { fontSize: 11, color: MUTED, marginTop: 1 },
  sectionAction: { fontSize: 13, fontWeight: '600', color: ACCENT },

  // Activity cards stack
  cardsStack: { paddingHorizontal: 20, gap: 10, marginBottom: 18 },
  card: {
    backgroundColor: CARD, borderRadius: 14,
    borderWidth: 1, borderColor: BORDER,
    padding: 12,
  },
  cardTop: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
  },
  cardSentence: { fontSize: 13, lineHeight: 18, color: PRIMARY },
  cardWho:  { fontWeight: '600' },
  cardVerb: { color: MUTED, fontWeight: '400' },
  cardSpot: { fontWeight: '600' },
  cardTime: { fontSize: 11, color: PLACEHOLDER_CLR },
  metaRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  metaCat:  { fontSize: 11, color: MUTED },
  // Rating pill — matches app-wide spots list style
  ratingPill: {
    borderWidth: 1.5, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: 'transparent',
  },
  ratingPillText: { fontSize: 12, fontWeight: '800' },
  noteText: {
    fontSize: 12, fontStyle: 'italic', color: NOTE_CLR,
    lineHeight: 17, marginTop: 8, minHeight: 34,
  },

  // Action buttons
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionCircleBtn: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },

  // Activity empty state
  activityEmpty: {
    borderWidth: 1.5, borderColor: `${ACCENT}66`, borderStyle: 'dashed',
    borderRadius: 16, padding: 22, alignItems: 'center', gap: 6,
  },
  activityEmptyTitle: { fontSize: 18, fontFamily: Fonts.serif, color: PRIMARY },
  activityEmptySub: { fontSize: 13, color: MUTED, textAlign: 'center', lineHeight: 18 },
  findFriendsBtn: {
    marginTop: 6, borderWidth: 1.5, borderColor: ACCENT, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 7,
  },
  findFriendsBtnText: { fontSize: 13, fontWeight: '600', color: ACCENT },

  // Rec cards
  recScroll: { paddingLeft: 20, paddingRight: 20, gap: 12, marginBottom: 24 },
  recCard: {
    width: 220, backgroundColor: CARD, borderRadius: 16,
    borderWidth: 1, borderColor: BORDER, padding: 14,
    flexDirection: 'column', gap: 8,
  },
  recTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  recCat: { fontSize: 11, fontWeight: '600', color: MUTED, letterSpacing: 0.3 },
  recVenue: { fontSize: 15, fontWeight: '600', color: PRIMARY, fontFamily: Fonts.serif, lineHeight: 18 },
  recFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 'auto' as any },
  avatarCluster: { flexDirection: 'row' },
  clusterItem: { borderWidth: 2, borderColor: CARD, borderRadius: 12 },
  overflowBubble: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#EDE8E0', alignItems: 'center', justifyContent: 'center',
  },
  overflowText: { fontSize: 7, fontWeight: '700', color: PRIMARY },
  recFriendCount: { fontSize: 11, color: MUTED },

  // Friends list
  friendsList: { paddingHorizontal: 20, paddingBottom: 110 },
  friendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  friendRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  friendName: { fontSize: 14, fontWeight: '600', color: PRIMARY },
  friendSub: { fontSize: 11, color: MUTED, marginTop: 1 },

  // No friends
  noFriendsWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 12 },
  noFriendsTitle: { fontSize: 20, fontWeight: '700', color: PRIMARY, fontFamily: Fonts.serif },
  noFriendsSub: { fontSize: 15, color: MUTED, textAlign: 'center', lineHeight: 22 },
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: ACCENT, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  inviteBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});

// ─── Modal styles ─────────────────────────────────────────────────────────────

const m = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  handleWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: BORDER },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  title: { fontSize: 20, fontWeight: '700', color: PRIMARY, fontFamily: Fonts.serif },
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
  searchInput: { flex: 1, fontSize: 15, color: PRIMARY, padding: 0 },
  listContent: { paddingHorizontal: 20, paddingTop: 4 },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER, gap: 12,
  },
  resultInfo: { flex: 1, gap: 2 },
  resultName: { fontSize: 15, fontWeight: '600', color: PRIMARY },
  resultHandle: { fontSize: 13, color: MUTED },
  addBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: ACCENT },
  addBtnSent: { backgroundColor: T.inputBg },
  addBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  addBtnTextSent: { color: MUTED },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', color: PRIMARY },
  emptyHint: { fontSize: 14, color: MUTED, textAlign: 'center' },
});
