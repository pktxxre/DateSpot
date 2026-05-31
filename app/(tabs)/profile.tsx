import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Pressable, Image, Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getAllVisits, Visit, ACTIVITY_TYPES, friendlyDate, formatRating, ratingColor } from '@/lib/visits';
import { getAllFutureSpots } from '@/lib/future';
import { getProfile, UserProfile } from '@/lib/profile';
import { getFollowCounts } from '@/lib/friends';
import { T } from '@/lib/theme';
import { useShimmer, SkBox } from '@/components/SkeletonBox';

const FOLLOW_CACHE_KEY = 'profile_follow_counts_v2';

// In-session cache so re-entering the profile shows the last known counts
// immediately (no "—" flash / visible re-count on every focus).
let memFollowCounts: { followers: number; following: number } | null = null;

function ProfileSkeleton() {
  const { shimmer, screenW } = useShimmer();
  return (
    <ScrollView showsVerticalScrollIndicator={false} scrollEnabled={false}>
      <View style={s.avatarSection}>
        <SkBox shimmer={shimmer} screenW={screenW} w={96} h={96} r={48} style={{ marginBottom: 12 }} />
        <SkBox shimmer={shimmer} screenW={screenW} w={120} h={14} r={7} style={{ marginBottom: 8 }} />
        <SkBox shimmer={shimmer} screenW={screenW} w={160} h={12} r={6} />
      </View>
      <View style={[s.statsRow, { marginHorizontal: 24, marginBottom: 4 }]}>
        <View style={s.statBox}>
          <SkBox shimmer={shimmer} screenW={screenW} w={36} h={18} r={6} style={{ marginBottom: 6 }} />
          <SkBox shimmer={shimmer} screenW={screenW} w={54} h={11} r={5} />
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <SkBox shimmer={shimmer} screenW={screenW} w={36} h={18} r={6} style={{ marginBottom: 6 }} />
          <SkBox shimmer={shimmer} screenW={screenW} w={54} h={11} r={5} />
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <SkBox shimmer={shimmer} screenW={screenW} w={36} h={18} r={6} style={{ marginBottom: 6 }} />
          <SkBox shimmer={shimmer} screenW={screenW} w={54} h={11} r={5} />
        </View>
      </View>
      <View style={{ paddingHorizontal: 20, marginBottom: 20, alignItems: 'center' }}>
        <SkBox shimmer={shimmer} screenW={screenW} w={120} h={38} r={10} />
      </View>
      <View style={[s.listSection, { marginHorizontal: 20 }]}>
        {[0, 1].map(i => (
          <View key={i}>
            {i > 0 && <View style={s.rowDivider} />}
            <View style={[s.listRow]}>
              <SkBox shimmer={shimmer} screenW={screenW} w={20} h={20} r={10} />
              <SkBox shimmer={shimmer} screenW={screenW} w={80} h={14} r={6} style={{ flex: 1 }} />
              <SkBox shimmer={shimmer} screenW={screenW} w={24} h={14} r={6} />
            </View>
          </View>
        ))}
      </View>
      <View style={{ paddingHorizontal: 20 }}>
        <SkBox shimmer={shimmer} screenW={screenW} w={120} h={16} r={7} style={{ marginBottom: 14 }} />
        {[0, 1, 2].map(i => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border, gap: 12 }}>
            <View style={{ flex: 1 }}>
              <SkBox shimmer={shimmer} screenW={screenW} w="80%" h={13} r={6} style={{ marginBottom: 6 }} />
              <SkBox shimmer={shimmer} screenW={screenW} w="50%" h={11} r={5} />
            </View>
            <SkBox shimmer={shimmer} screenW={screenW} w={42} h={26} r={10} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [futureCount, setFutureCount] = useState(0);
  const [followers, setFollowers] = useState<number | null>(memFollowCounts?.followers ?? null);
  const [following, setFollowing] = useState<number | null>(memFollowCounts?.following ?? null);

  useEffect(() => {
    if (memFollowCounts) return; // already have counts in memory this session
    AsyncStorage.getItem(FOLLOW_CACHE_KEY).then(val => {
      if (val) {
        const cached = JSON.parse(val);
        memFollowCounts = cached;
        setFollowers(cached.followers);
        setFollowing(cached.following);
      }
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      getProfile().then(p => {
        setProfile(p);
        setLoading(false);
      });
      const allVisits = getAllVisits().filter(v => !(v as any).is_seed);
      setVisits(allVisits);
      setFutureCount(getAllFutureSpots().length);
      getFollowCounts().then(counts => {
        memFollowCounts = counts;
        setFollowers(counts.followers);
        setFollowing(counts.following);
        AsyncStorage.setItem(FOLLOW_CACHE_KEY, JSON.stringify(counts));
      });
    }, [])
  );

  const recentActivity = useMemo(() =>
    [...visits]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5),
    [visits]
  );

  const handleShare = async () => {
    try {
      await Share.share({ message: `Check out my DateSpot profile — ${profile?.username ?? 'Me'}` });
    } catch {}
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header: name on left, share + settings on right */}
      <View style={s.header}>
        <Text style={s.headerName} numberOfLines={1}>
          {profile?.username || 'You'}
        </Text>
        <View style={s.headerRight}>
          <Pressable onPress={handleShare} hitSlop={12} style={s.iconBtn}>
            <Ionicons name="share-outline" size={22} color={T.primary} />
          </Pressable>
          <Pressable onPress={() => router.push('/settings')} hitSlop={12} style={s.iconBtn}>
            <Ionicons name="settings-outline" size={22} color={T.primary} />
          </Pressable>
        </View>
      </View>

      {loading ? <ProfileSkeleton /> : <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar + handle + bio */}
        <View style={s.avatarSection}>
          <View style={s.avatarWrap}>
            {profile?.profilePhotoUri ? (
              <Image
                key={profile.profilePhotoUri}
                source={{ uri: profile.profilePhotoUri, cache: 'reload' }}
                style={s.avatar}
              />
            ) : (
              <View style={[s.avatar, s.avatarPlaceholder]}>
                <Text style={s.avatarEmoticon}>{profile?.avatarEmoticon || ':)'}</Text>
              </View>
            )}
            <View style={s.avatarBorder} />
          </View>
          {!!profile?.handle && (
            <Text style={s.handle}>@{profile.handle}</Text>
          )}
          {!!profile?.bio && (
            <Text style={s.bio}>{profile.bio}</Text>
          )}
        </View>

        {/* Stats: Followers | Following | Logs */}
        <View style={s.statsRow}>
          <Pressable style={s.statBox} onPress={() => router.push('/follow-list' as any)}>
            <Text style={s.statValue}>{followers ?? '—'}</Text>
            <Text style={s.statLabel}>Followers</Text>
          </Pressable>
          <View style={s.statDivider} />
          <Pressable style={s.statBox} onPress={() => router.push('/follow-list' as any)}>
            <Text style={s.statValue}>{following ?? '—'}</Text>
            <Text style={s.statLabel}>Following</Text>
          </Pressable>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={s.statValue}>{visits.length}</Text>
            <Text style={s.statLabel}>Logs</Text>
          </View>
        </View>

        {/* Edit Profile */}
        <View style={s.actionRow}>
          <Pressable
            style={({ pressed }) => [s.editBtn, pressed && { opacity: 0.8 }]}
            onPress={() => router.push('/edit-profile')}
          >
            <Ionicons name="pencil-outline" size={15} color={T.accent} style={{ marginRight: 6 }} />
            <Text style={s.editBtnText}>Edit Profile</Text>
          </Pressable>
        </View>

        {/* Been / Want to Go rows */}
        <View style={s.listSection}>
          <Pressable
            style={({ pressed }) => [s.listRow, pressed && { opacity: 0.75 }]}
            onPress={() => router.navigate({ pathname: '/(tabs)/lists', params: { tab: 'been' } } as any)}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color={T.primary} />
            <Text style={s.listRowLabel}>Been</Text>
            <View style={s.listRowRight}>
              <Text style={s.listRowCount}>{visits.length}</Text>
              <Ionicons name="chevron-forward" size={16} color={T.muted} />
            </View>
          </Pressable>
          <View style={s.rowDivider} />
          <Pressable
            style={({ pressed }) => [s.listRow, pressed && { opacity: 0.75 }]}
            onPress={() => router.navigate({ pathname: '/(tabs)/lists', params: { tab: 'saved' } } as any)}
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
              <Text style={s.emptyText}>No activity yet. Start logging spots!</Text>
            </View>
          ) : (
            recentActivity.map(visit => {
              const color = visit.rating > 0 ? ratingColor(visit.rating) : T.muted;
              return (
                <Pressable
                  key={visit.id}
                  style={({ pressed }) => [s.activityRow, pressed && { opacity: 0.75 }]}
                  onPress={() => router.push(`/spot/${visit.id}`)}
                >
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
                </Pressable>
              );
            })
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerName: {
    fontSize: 28,
    fontWeight: '400',
    color: T.primary,
    fontFamily: 'Fraunces-Regular',
    flex: 1,
    marginRight: 8,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

  avatarSection: { alignItems: 'center', paddingTop: 16, paddingBottom: 12 },
  avatarWrap: {
    width: 96, height: 96,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 4, marginBottom: 12,
  },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarBorder: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 48, borderWidth: 2, borderColor: 'rgba(0,0,0,0.15)',
  },
  avatarPlaceholder: { backgroundColor: T.inputBg, alignItems: 'center', justifyContent: 'center' },
  avatarEmoticon: { fontSize: 20, color: T.primary, fontWeight: '600' },
  handle: { fontSize: 15, color: T.muted, fontWeight: '500', marginBottom: 6 },
  bio: { fontSize: 14, color: T.muted, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },

  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16, marginHorizontal: 24, marginBottom: 4,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 18, fontWeight: '700', color: T.primary, marginBottom: 3 },
  statLabel: { fontSize: 11, fontWeight: '600', color: T.muted, letterSpacing: 0.3 },
  statDivider: { width: 1.5, height: 40, backgroundColor: T.border },

  actionRow: { paddingHorizontal: 20, marginBottom: 20, alignItems: 'center' },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, paddingHorizontal: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: T.accent,
  },
  editBtnText: { color: T.accent, fontSize: 14, fontWeight: '600' },

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
    borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3,
    minWidth: 42, alignItems: 'center', flexShrink: 0,
  },
  scoreText: { fontSize: 12, fontWeight: '800' },

  emptyActivity: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: T.muted, textAlign: 'center' },
});
