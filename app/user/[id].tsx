import { useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Pressable, Image,
  Animated, Modal, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useShimmer, SkBox } from '@/components/SkeletonBox';

function UserProfileSkeleton() {
  const { shimmer, screenW } = useShimmer();
  const sk = (w: number | `${number}%`, h: number, r?: number, style?: object) => (
    <SkBox shimmer={shimmer} w={w} h={h} r={r ?? 4} style={style} screenW={screenW} />
  );
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* avatarSection: alignItems center, paddingTop 14, paddingBottom 12 */}
      <View style={{ alignItems: 'center', paddingTop: 14, paddingBottom: 12 }}>
        {/* avatarWrap: marginBottom 12 — mirrors the shadow wrapper */}
        <View style={{ marginBottom: 12 }}>
          {sk(88, 88, 44)}
        </View>
        {/* handle: fontSize 15, marginBottom 6 */}
        {sk(110, 15, 3, { marginBottom: 6 })}
        {/* bio: fontSize 14, two lines */}
        {sk(170, 14, 3, { marginBottom: 4 })}
        {sk(130, 14, 3)}
      </View>

      {/* statsRow: flex row, alignItems center, paddingVertical 16, marginHorizontal 24, marginBottom 4
          Flat structure: statBox[flex:1] | divider | statBox[flex:1] | divider | statBox[flex:1] */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, marginHorizontal: 24, marginBottom: 4 }}>
        <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
          {sk(30, 18, 3)}
          {sk(52, 11, 3)}
        </View>
        <View style={{ width: StyleSheet.hairlineWidth, height: 32, backgroundColor: T.border }} />
        <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
          {sk(30, 18, 3)}
          {sk(52, 11, 3)}
        </View>
        <View style={{ width: StyleSheet.hairlineWidth, height: 32, backgroundColor: T.border }} />
        <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
          {sk(30, 18, 3)}
          {sk(52, 11, 3)}
        </View>
      </View>

      {/* actionRow: marginHorizontal 20 (not paddingHorizontal) so '100%' on sk resolves to screenW-40,
          matching the real Pressable which fills the paddingHorizontal:20 content area */}
      <View style={{ marginHorizontal: 20, marginBottom: 24 }}>
        {sk('100%', 48, 14)}
      </View>

      {/* listSection: marginHorizontal 20, borderRadius 16, borderWidth hairline, overflow hidden, marginBottom 28 */}
      <View style={{ marginHorizontal: 20, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: T.border, overflow: 'hidden', marginBottom: 28, backgroundColor: T.card }}>
        {/* listRow: flex row, alignItems center, gap 12, paddingHorizontal 16, paddingVertical 16 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16 }}>
          {sk(20, 20, 10)}
          {sk(40, 16, 3, { flex: 1 })}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {sk(16, 16, 3)}
            {sk(16, 16, 3)}
          </View>
        </View>
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginHorizontal: 16 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 16 }}>
          {sk(20, 20, 10)}
          {sk(80, 16, 3, { flex: 1 })}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {sk(16, 16, 3)}
            {sk(16, 16, 3)}
          </View>
        </View>
      </View>

      {/* activitySection: paddingHorizontal 20 */}
      <View style={{ paddingHorizontal: 20 }}>
        {/* sectionTitle: fontSize 16, marginBottom 14 */}
        {sk(140, 16, 3, { marginBottom: 14 })}
        {/* activityRow: flex row, alignItems center, paddingVertical 12, borderBottom hairline, gap 12 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border, gap: 12 }}>
          <View style={{ flex: 1, gap: 5 }}>
            {sk('70%', 14, 3)}
            {sk('45%', 12, 3)}
          </View>
          {sk(42, 26, 10)}
        </View>
      </View>
    </ScrollView>
  );
}
import {
  getUserProfile, getUserVisits, getUserFutureSpots, getUserFollowCounts,
  getFollowStatus, followUser, unfollowUser, removeFollower,
  PublicUserProfile,
} from '@/lib/friends';
import { ACTIVITY_TYPES, friendlyDate, formatRating, ratingColor } from '@/lib/visits';
import { T } from '@/lib/theme';

const AVATAR_PALETTE = ['#F2C18B', '#B5D5C5', '#E8B4D8', '#C9B6E4', '#F4C2A1'];
function avatarBg(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

// ─── Options Sheet ────────────────────────────────────────────────────────────

function OptionsSheet({ visible, onRemoveFollower, onUnfollow, onClose }: {
  visible: boolean;
  onRemoveFollower: () => void;
  onUnfollow: () => void;
  onClose: () => void;
}) {
  const sheetY = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      sheetY.setValue(400);
      Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260 }).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <View style={opt.container}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[opt.wrap, { transform: [{ translateY: sheetY }] }]}>
          <View style={opt.sheet}>
            <View style={opt.handle} />
            <Pressable style={opt.option} onPress={() => { onClose(); onRemoveFollower(); }}>
              <Text style={opt.optionTextDanger}>Remove follower</Text>
            </Pressable>
            <View style={opt.sep} />
            <Pressable style={opt.option} onPress={() => { onClose(); onUnfollow(); }}>
              <Text style={opt.optionTextDanger}>Unfollow</Text>
            </Pressable>
          </View>
          <Pressable style={opt.cancelSheet} onPress={onClose}>
            <Text style={opt.cancelText}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [userProfile, setUserProfile] = useState<PublicUserProfile | null>(null);
  const [visitCount, setVisitCount] = useState(0);
  const [futureCount, setFutureCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [followCounts, setFollowCounts] = useState<{ followers: number; following: number } | null>(null);
  const [followStatus, setFollowStatus] = useState<'friends' | 'following' | 'follow_back' | 'none'>('none');
  const [loading, setLoading] = useState(true);
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getUserProfile(id),
      getUserVisits(id),
      getUserFutureSpots(id),
      getUserFollowCounts(id),
      getFollowStatus(id),
    ]).then(([profile, visits, future, counts, status]) => {
      setUserProfile(profile);
      setVisitCount(visits.length);
      setFutureCount(future.length);
      setFollowCounts(counts);
      setFollowStatus(status);
      const sorted = [...visits]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);
      setRecentActivity(sorted);
      setLoading(false);
    });
  }, [id]);

  async function handleFollow() {
    if (!id) return;
    await followUser(id);
    setFollowStatus(prev => prev === 'follow_back' ? 'friends' : 'following');
  }

  async function handleUnfollow() {
    if (!id) return;
    await unfollowUser(id);
    setFollowStatus(prev => prev === 'friends' ? 'follow_back' : 'none');
  }

  async function handleRemoveFollower() {
    if (!id) return;
    await removeFollower(id);
    setFollowStatus(prev => prev === 'friends' ? 'following' : prev);
  }

  const isFollowing = followStatus === 'friends' || followStatus === 'following';
  const showPrivateState = !loading && (userProfile?.isPrivate ?? false) && !isFollowing;

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={T.primary} />
          </Pressable>
        </View>
        <UserProfileSkeleton />
      </SafeAreaView>
    );
  }

  if (showPrivateState) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={T.primary} />
          </Pressable>
          <Text style={s.headerName} numberOfLines={1}>{userProfile?.username ?? ''}</Text>
          <View style={s.dotsBtn} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.avatarSection}>
            <View style={s.avatarWrap}>
              {userProfile?.profilePhotoUri ? (
                <Image source={{ uri: userProfile.profilePhotoUri }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, { backgroundColor: avatarBg(id ?? ''), alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={s.avatarEmoticon}>{userProfile?.avatarEmoticon || ':)'}</Text>
                </View>
              )}
            </View>
            {!!userProfile?.handle && <Text style={s.handle}>@{userProfile.handle}</Text>}
          </View>
          <View style={s.privateWrap}>
            <View style={s.privateLockCircle}>
              <Ionicons name="lock-closed" size={24} color={T.muted} />
            </View>
            <Text style={s.privateTitle}>This account is private</Text>
            <Text style={s.privateSub}>Follow to see their spots</Text>
          </View>
          <View style={s.actionRow}>
            <Pressable
              style={({ pressed }) => [s.followBtn, pressed && { opacity: 0.8 }]}
              onPress={handleFollow}
            >
              <Text style={s.followBtnText}>
                {followStatus === 'follow_back' ? 'Follow Back' : 'Follow'}
              </Text>
            </Pressable>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header: name left, icons right */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={T.primary} />
        </Pressable>
        <Text style={s.headerName} numberOfLines={1}>
          {userProfile?.username ?? ''}
        </Text>
        <Pressable onPress={() => setShowOptions(true)} hitSlop={12} style={s.dotsBtn}>
          <Ionicons name="ellipsis-horizontal" size={22} color={T.primary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar + handle + bio */}
        <View style={s.avatarSection}>
          <View style={s.avatarWrap}>
            {userProfile?.profilePhotoUri ? (
              <Image source={{ uri: userProfile.profilePhotoUri }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, { backgroundColor: avatarBg(id ?? ''), alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={s.avatarEmoticon}>{userProfile?.avatarEmoticon || ':)'}</Text>
              </View>
            )}
          </View>
          {!!userProfile?.handle && <Text style={s.handle}>@{userProfile.handle}</Text>}
          {!!userProfile?.bio && <Text style={s.bio}>{userProfile.bio}</Text>}
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statValue}>{followCounts?.followers ?? '—'}</Text>
            <Text style={s.statLabel}>Followers</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={s.statValue}>{followCounts?.following ?? '—'}</Text>
            <Text style={s.statLabel}>Following</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={s.statValue}>{visitCount}</Text>
            <Text style={s.statLabel}>Logs</Text>
          </View>
        </View>

        {/* Follow / Following / Friends button */}
        <View style={s.actionRow}>
          {isFollowing ? (
            <Pressable
              style={({ pressed }) => [s.followingBtn, pressed && { opacity: 0.8 }]}
              onPress={() => setShowOptions(true)}
            >
              <Text style={s.followingBtnText}>
                {followStatus === 'friends' ? 'Friends' : 'Following'}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [s.followBtn, pressed && { opacity: 0.8 }]}
              onPress={handleFollow}
            >
              <Text style={s.followBtnText}>
                {followStatus === 'follow_back' ? 'Follow Back' : 'Follow'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Been / Want to Go rows */}
        <View style={s.listSection}>
          <Pressable
            style={({ pressed }) => [s.listRow, pressed && { opacity: 0.75 }]}
            onPress={() => router.push({ pathname: '/user-spots', params: { userId: id, username: userProfile?.username ?? '', tab: 'been' } } as any)}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color={T.primary} />
            <Text style={s.listRowLabel}>Been</Text>
            <View style={s.listRowRight}>
              <Text style={s.listRowCount}>{visitCount}</Text>
              <Ionicons name="chevron-forward" size={16} color={T.muted} />
            </View>
          </Pressable>
          <View style={s.rowDivider} />
          <Pressable
            style={({ pressed }) => [s.listRow, pressed && { opacity: 0.75 }]}
            onPress={() => router.push({ pathname: '/user-spots', params: { userId: id, username: userProfile?.username ?? '', tab: 'want' } } as any)}
          >
            <Ionicons name="bookmark-outline" size={20} color={T.primary} />
            <Text style={s.listRowLabel}>Want to Go</Text>
            <View style={s.listRowRight}>
              <Text style={s.listRowCount}>{futureCount}</Text>
              <Ionicons name="chevron-forward" size={16} color={T.muted} />
            </View>
          </Pressable>
        </View>

        {/* Recent Activity */}
        <View style={s.activitySection}>
          <Text style={s.sectionTitle}>Recent Activity</Text>
          {recentActivity.length === 0 ? (
            <View style={s.emptyActivity}>
              <Text style={s.emptyText}>No recent activity</Text>
            </View>
          ) : (
            recentActivity.map(visit => {
              const color = visit.rating > 0 ? ratingColor(visit.rating) : T.muted;
              return (
                <View key={visit.id} style={s.activityRow}>
                  <View style={s.activityInfo}>
                    <Text style={s.activityLabel} numberOfLines={1}>{visit.venue_name}</Text>
                    <Text style={s.activitySub}>
                      {ACTIVITY_TYPES.find(a => a.value === visit.activity_type)?.label ?? 'Spot'} · {friendlyDate(visit.visited_at || visit.created_at)}
                    </Text>
                  </View>
                  {visit.rating > 0 && (
                    <View style={[s.scorePill, { borderColor: color }]}>
                      <Text style={[s.scoreText, { color }]}>{formatRating(visit.rating)}</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <OptionsSheet
        visible={showOptions}
        onRemoveFollower={handleRemoveFollower}
        onUnfollow={handleUnfollow}
        onClose={() => setShowOptions(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  dotsBtn: { width: 36, alignItems: 'flex-end' },
  headerName: {
    flex: 1,
    fontSize: 22, fontWeight: '400', color: T.primary,
    fontFamily: 'Fraunces-Regular',
  },

  avatarSection: { alignItems: 'center', paddingTop: 14, paddingBottom: 12 },
  avatarWrap: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 4, marginBottom: 12,
  },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarEmoticon: { fontSize: 18, color: T.primary, fontWeight: '600' },
  handle: { fontSize: 15, color: T.muted, fontWeight: '500', marginBottom: 6 },
  bio: { fontSize: 14, color: T.muted, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },

  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16, marginHorizontal: 24, marginBottom: 4,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: T.primary, marginBottom: 3 },
  statLabel: { fontSize: 11, fontWeight: '600', color: T.muted, letterSpacing: 0.3 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 32, backgroundColor: T.border },

  actionRow: { paddingHorizontal: 20, marginBottom: 24 },
  followBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, borderRadius: 14,
    backgroundColor: T.accent,
  },
  followBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  followingBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, borderRadius: 14,
    borderWidth: 1.5, borderColor: T.border,
    backgroundColor: T.inputBg,
  },
  followingBtnText: { color: T.primary, fontSize: 15, fontWeight: '600' },

  listSection: {
    marginHorizontal: 20, borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.border,
    overflow: 'hidden', marginBottom: 28, backgroundColor: T.card,
  },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 16,
  },
  listRowLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: T.primary },
  listRowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  listRowCount: { fontSize: 16, fontWeight: '600', color: T.primary },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginHorizontal: 16 },

  activitySection: { paddingHorizontal: 20 },
  sectionTitle: {
    fontSize: 16, fontWeight: '400', color: T.primary,
    fontFamily: 'Fraunces-Regular', marginBottom: 14,
  },
  activityRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border, gap: 12,
  },
  activityInfo: { flex: 1 },
  activityLabel: { fontSize: 14, fontWeight: '600', color: T.primary, marginBottom: 2 },
  activitySub: { fontSize: 12, color: T.muted },
  scorePill: {
    borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3,
    minWidth: 42, alignItems: 'center', flexShrink: 0,
  },
  scoreText: { fontSize: 12, fontWeight: '800' },
  emptyActivity: { alignItems: 'center', paddingVertical: 20 },
  emptyText: { fontSize: 14, color: T.muted, textAlign: 'center' },

  privateWrap: { alignItems: 'center', paddingHorizontal: 40, paddingTop: 8, paddingBottom: 24 },
  privateLockCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: T.inputBg,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  privateTitle: {
    fontSize: 16, fontWeight: '600', color: T.primary,
    marginBottom: 6, textAlign: 'center',
  },
  privateSub: { fontSize: 14, color: T.muted, textAlign: 'center' },
});

const opt = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  wrap: { gap: 8, paddingHorizontal: 10, paddingBottom: 32 },
  sheet: { backgroundColor: T.bg, borderRadius: 14, overflow: 'hidden' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: T.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  option: { paddingVertical: 18, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border },
  optionTextDanger: { fontSize: 20, color: T.accent, fontWeight: '400' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: T.border },
  cancelSheet: { backgroundColor: T.bg, borderRadius: 14, paddingVertical: 18, alignItems: 'center' },
  cancelText: { fontSize: 20, fontWeight: '600', color: '#007AFF' },
});
