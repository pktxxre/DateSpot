import { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, View, Text, Pressable, Share,
  ScrollView, useWindowDimensions, AppState,
} from 'react-native';
import AppTextInput from '@/components/AppTextInput';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/Avatar';
import { HeaderActions } from '@/components/HeaderActions';
import { Fonts } from '@/lib/theme';
import { getFriendsWithStats, FriendWithStats } from '@/lib/friends';
import { TabSlideWrapper } from '@/components/TabSlideWrapper';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FRIENDS_CACHE_KEY = 'datespot:friends_cache_v1';

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG       = '#FBF8F3';
const CARD     = '#FFFFFF';
const BORDER   = '#ECE4D8';
const PRIMARY  = '#4B3621';
const MUTED    = '#8B7762';
const PLACEHOLDER_CLR = '#B3A48F';
const ACCENT   = '#E76F51';

// ─── Friend row ───────────────────────────────────────────────────────────────

function FriendRow({ friend, isLast }: { friend: FriendWithStats; isLast: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [s.friendRow, !isLast && s.friendRowBorder, pressed && { opacity: 0.6 }]}
      onPress={() => router.push(`/user/${friend.id}` as any)}
    >
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

function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <View style={s.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {!!action && <Text style={s.sectionAction}>{action} →</Text>}
    </View>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SK_BASE = '#EAE4D9';
const SK_LIGHT = '#F8F4EC';

function SkBox({
  shimmer, w, h, r = 4, style, screenW,
}: {
  shimmer: ReturnType<typeof useAnimatedStyle>;
  w: number | `${number}%`; h: number; r?: number; style?: object; screenW: number;
}) {
  return (
    <View style={[{ width: w, height: h, backgroundColor: SK_BASE, overflow: 'hidden', borderRadius: r }, style]}>
      <Animated.View style={[
        { position: 'absolute', top: 0, left: 0, bottom: 0, width: screenW * 0.6, backgroundColor: SK_LIGHT, opacity: 0.95 },
        shimmer,
      ]} />
    </View>
  );
}

function FriendsSkeleton() {
  const { width: screenW } = useWindowDimensions();
  const offset = useSharedValue(-screenW * 0.65);

  useEffect(() => {
    offset.value = withRepeat(
      withTiming(screenW, { duration: 1800, easing: Easing.linear }),
      -1,
      false,
    );
  }, [screenW]);

  const shimmer = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const sk = (w: number | `${number}%`, h: number, r?: number, style?: object) => (
    <SkBox shimmer={shimmer} w={w} h={h} r={r} style={style} screenW={screenW} />
  );

  return (
    <View style={{ backgroundColor: BG }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10 }}>
        {sk(110, 17, 4)}
      </View>
      <View style={{ paddingHorizontal: 20 }}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 }}>
            {sk(40, 40, 20)}
            <View style={{ flex: 1, gap: 6 }}>
              {sk('60%', 13, 3)}
              {sk('38%', 11, 3)}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function FriendsScreen() {
  const [friends, setFriends] = useState<FriendWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    // Stale-while-revalidate: show cached friends immediately, refresh in background.
    const cached = await AsyncStorage.getItem(FRIENDS_CACHE_KEY);
    if (cached) {
      const { friends: fr } = JSON.parse(cached);
      if (fr) { setFriends(fr); setLoading(false); }
    }

    const fr = await getFriendsWithStats();
    const sorted = fr.sort((a, b) => a.username.localeCompare(b.username));
    setFriends(sorted);
    setLoading(false);
    AsyncStorage.setItem(FRIENDS_CACHE_KEY, JSON.stringify({ friends: sorted }));
  }, []);

  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    load();
    const interval = setInterval(load, 15000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => { clearInterval(interval); sub.remove(); };
  }, [load]));

  const hasFriends = friends.length > 0;

  const q = searchQuery.trim().toLowerCase();
  const filteredFriends = q
    ? friends.filter(f =>
        f.username.toLowerCase().includes(q) ||
        f.handle.toLowerCase().includes(q)
      )
    : friends;
  const isSearching = q.length > 0;

  return (
    <TabSlideWrapper myIndex={4}>
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.friendCountLabel}>{friends.length} {friends.length === 1 ? 'FRIEND' : 'FRIENDS'}</Text>
          <Text style={s.pageTitle}>Friends</Text>
        </View>
        <HeaderActions />
      </View>

      {/* Search field */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={MUTED} style={{ marginRight: 8 }} />
        <AppTextInput
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

      {loading && friends.length === 0 ? (
        <FriendsSkeleton />
      ) : (
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {isSearching ? (
            <View style={{ paddingHorizontal: 20, paddingBottom: 110 }}>
              {filteredFriends.length === 0 ? (
                <View style={{ alignItems: 'center', paddingTop: 40, gap: 10 }}>
                  <Ionicons name="person-outline" size={40} color={BORDER} />
                  <Text style={{ fontSize: 14, color: MUTED }}>No friends match "{searchQuery}"</Text>
                </View>
              ) : (
                filteredFriends.map((f, i) => (
                  <FriendRow key={f.id} friend={f} isLast={i === filteredFriends.length - 1} />
                ))
              )}
            </View>
          ) : !hasFriends ? (
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
          )}
        </ScrollView>
      )}
    </SafeAreaView>
    </TabSlideWrapper>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 14,
  },
  friendCountLabel: {
    fontSize: 11, fontWeight: '700', color: MUTED, letterSpacing: 1.5, marginBottom: 2,
  },
  pageTitle: { fontSize: 32, color: PRIMARY, fontFamily: Fonts.serif, lineHeight: 36 },

  // Search field
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: CARD, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 11,
    borderWidth: 1, borderColor: BORDER,
  },
  searchInput: { flex: 1, fontSize: 14, color: PRIMARY, padding: 0 },

  // Section
  sectionWrap: { marginBottom: 0 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10,
  },
  sectionTitle: { fontSize: 17, fontWeight: '400', color: PRIMARY, fontFamily: Fonts.serif, letterSpacing: -0.2 },
  sectionAction: { fontSize: 13, fontWeight: '600', color: ACCENT },

  // Friends list
  friendsList: { paddingHorizontal: 20, paddingBottom: 110 },
  friendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  friendRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  friendName: { fontSize: 14, fontWeight: '600', color: PRIMARY },
  friendSub: { fontSize: 11, color: MUTED, marginTop: 1 },

  // No friends
  noFriendsWrap: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 12 },
  noFriendsTitle: { fontSize: 20, fontWeight: '400', color: PRIMARY, fontFamily: Fonts.serif },
  noFriendsSub: { fontSize: 15, color: MUTED, textAlign: 'center', lineHeight: 22 },
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: ACCENT, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 8,
  },
  inviteBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
