import { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, View, Text, Pressable, Share, Modal,
  TextInput, FlatList, ActivityIndicator, KeyboardAvoidingView,
  Platform, Image, ScrollView, useWindowDimensions,
  Animated as RNAnimated, AppState,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from 'react-native-reanimated';
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
import { getUnreadCount, notifyActivity, removeNotifyActivity } from '@/lib/notifications';
import { ratingColor, getAllVisits, friendlyDate } from '@/lib/visits';
import { supabase } from '@/lib/supabase';
import { TabSlideWrapper } from '@/components/TabSlideWrapper';
import { scheduleOpenLogWithLocation } from '@/app/(tabs)/map';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FRIENDS_CACHE_KEY = 'datespot:friends_cache_v1';
import { insertFutureSpot, deleteFutureSpotsByVenueName, getAllFutureSpots } from '@/lib/future';
import { isActivityLiked, likeActivity, unlikeActivity } from '@/lib/friendLikes';
import * as Crypto from 'expo-crypto';

// ─── Design tokens ────────────────────────────────────────────────────────────

const BG       = '#FFFFFF';
const CARD     = '#FCF9F2';
const BORDER   = '#EDE8E0';
const PRIMARY  = '#4B3621';
const MUTED    = '#8B7762';
const PLACEHOLDER_CLR = '#B0A090';
const ACCENT   = '#E76F51';
const NOTE_CLR = '#A0927E';

// Avatar palette — rotated by deterministic index from id
const AVATAR_BG = '#E8C5B8';

function initial(name: string): string {
  return (name?.[0] ?? '?').toUpperCase();
}


const ACTIVITY_LABEL: Record<string, string> = {
  food: 'Food', bars: 'Drinks', cafes: 'Cafes',
  outdoors: 'Outdoors', indoors: 'Indoors', view: 'Views',
  entertainment: 'Entertainment', shopping: 'Shopping', other: 'Other',
};

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, photoUri, emoticon, size }: { id?: string; name: string; photoUri: string | null; emoticon?: string; size: number }) {
  if (photoUri) {
    return <Image source={{ uri: photoUri }} style={{ width: size, height: size, borderRadius: size / 2 }} resizeMode="cover" />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: AVATAR_BG, alignItems: 'center', justifyContent: 'center' }}>
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

const LOG_CLR  = '#E76F51';
const SAVE_CLR = '#5856d6';
const LIKE_CLR = '#E8637A';

function FloatingHeart({ onDone }: { onDone: () => void }) {
  const translateY = useRef(new RNAnimated.Value(0)).current;
  const opacity    = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.timing(translateY, { toValue: -28, duration: 500, useNativeDriver: true }),
      RNAnimated.sequence([
        RNAnimated.delay(180),
        RNAnimated.timing(opacity, { toValue: 0, duration: 370, useNativeDriver: true }),
      ]),
    ]).start(({ finished }) => { if (finished) onDone(); });
  }, []);

  return (
    <RNAnimated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 6,
        left: 6,
        transform: [{ translateY }],
        opacity,
      }}
    >
      <Ionicons name="heart" size={18} color={LIKE_CLR} />
    </RNAnimated.View>
  );
}

function ActivityCard({ item, isLast, alreadyVisited }: {
  item: FriendActivityItem;
  isLast: boolean;
  alreadyVisited: boolean;
}) {
  const actLabel = ACTIVITY_LABEL[item.activityType] ?? item.activityType;
  const showRating = item.rating > 0;
  const rColor = showRating ? ratingColor(item.rating) : null;

  const [liked, setLiked] = useState(() => isActivityLiked(item.visitId));
  const [saved, setSaved] = useState(() => {
    const key = item.venueName.toLowerCase().trim();
    return getAllFutureSpots().some(f => f.venue_name.toLowerCase().trim() === key);
  });
  const [toast, setToast] = useState<string | null>(null);
  const [floatingHearts, setFloatingHearts] = useState<number[]>([]);
  const heartIdRef = useRef(0);

  // Serialize notification writes so rapid taps resolve in order — the final
  // DB state always matches the final UI state (no duplicates, and no orphan
  // notification left behind if the user ends on "not saved" / "not liked").
  const saveOpChain = useRef<Promise<unknown>>(Promise.resolve());
  const likeOpChain = useRef<Promise<unknown>>(Promise.resolve());
  function runSerial(chain: { current: Promise<unknown> }, fn: () => Promise<void>) {
    chain.current = chain.current.then(fn, fn);
  }

  const heartScale = useRef(new RNAnimated.Value(1)).current;
  const saveScale  = useRef(new RNAnimated.Value(1)).current;
  const toastOpacity = useRef(new RNAnimated.Value(0)).current;

  function pop(anim: RNAnimated.Value, peak = 1.4) {
    RNAnimated.sequence([
      RNAnimated.timing(anim, { toValue: peak, duration: 120, useNativeDriver: true }),
      RNAnimated.spring(anim, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  }

  function showToast(msg: string) {
    setToast(msg);
    toastOpacity.setValue(0);
    RNAnimated.sequence([
      RNAnimated.timing(toastOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      RNAnimated.delay(700),
      RNAnimated.timing(toastOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }

  function handleLog() {
    scheduleOpenLogWithLocation(item.venueName, item.lat, item.lng);
    notifyActivity(item.friend.id, 'log', item.visitId);
    router.navigate('/(tabs)/map');
  }

  function handleSave() {
    pop(saveScale, 1.2);
    if (saved) {
      deleteFutureSpotsByVenueName(item.venueName);
      setSaved(false);
      runSerial(saveOpChain, () => removeNotifyActivity(item.friend.id, 'save', item.visitId));
    } else {
      insertFutureSpot({
        id: Crypto.randomUUID(),
        venue_name: item.venueName,
        lat: item.lat,
        lng: item.lng,
        activity_type: item.activityType,
        occasion_type: item.occasionType,
        created_at: new Date().toISOString(),
      });
      setSaved(true);
      showToast('Saved');
      runSerial(saveOpChain, () => notifyActivity(item.friend.id, 'save', item.visitId));
    }
  }

  function handleLike() {
    pop(heartScale);
    const next = !liked;
    setLiked(next);
    if (next) {
      likeActivity(item.visitId);
      const id = ++heartIdRef.current;
      setFloatingHearts(h => [...h, id]);
      runSerial(likeOpChain, () => notifyActivity(item.friend.id, 'like', item.visitId));
    } else {
      unlikeActivity(item.visitId);
      runSerial(likeOpChain, () => removeNotifyActivity(item.friend.id, 'like', item.visitId));
    }
  }

  return (
    <View style={[s.activityRow, !isLast && s.activityRowBorder, { overflow: 'hidden' }]}>
      {/* Top: avatar + meta + rating pill */}
      <View style={s.cardTop}>
        <Pressable onPress={() => router.push(`/user/${item.friend.id}` as any)} hitSlop={6}>
          <Avatar
            id={item.friend.id}
            name={item.friend.username}
            photoUri={item.friend.profilePhotoUri}
            emoticon={item.friend.avatarEmoticon}
            size={36}
          />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.cardSentence} numberOfLines={1}>
            <Text style={s.cardWho}>{item.friend.username}</Text>
            <Text style={s.cardVerb}>{' logged '}</Text>
            <Text style={s.cardSpot}>{item.venueName}</Text>
          </Text>
          <View style={s.metaRow}>
            <Text style={s.metaCat}>{actLabel}</Text>
            <Text style={s.cardTime}>{friendlyDate(item.visitedAt)}</Text>
          </View>
        </View>
        {showRating && rColor && (
          <View style={[s.ratingPill, { borderColor: rColor }]}>
            <Text style={[s.ratingPillText, { color: rColor }]}>{item.rating === 10 ? '10' : item.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>

      {/* Note — always reserve space so all cards are uniform height */}
      <Text style={s.noteText} numberOfLines={2}>
        {item.notes ? `"${item.notes}"` : ''}
      </Text>

      {/* Action row */}
      <View style={s.actionRow}>
        {/* Like — left side */}
        <View>
          <Pressable
            style={[
              s.actionCircleBtn,
              liked && { backgroundColor: `${LIKE_CLR}18`, borderColor: LIKE_CLR },
            ]}
            onPress={handleLike}
          >
            <RNAnimated.View style={{ transform: [{ scale: heartScale }] }}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={14} color={liked ? LIKE_CLR : MUTED} />
            </RNAnimated.View>
          </Pressable>
          {floatingHearts.map(id => (
            <FloatingHeart key={id} onDone={() => setFloatingHearts(h => h.filter(x => x !== id))} />
          ))}
        </View>

        {/* Log + Save — pinned to far right */}
        <View style={s.actionRight}>
          {toast && (
            <RNAnimated.Text
              pointerEvents="none"
              style={[s.microToast, { opacity: toastOpacity, position: 'absolute', bottom: 34, right: 0 }]}
            >
              {toast}
            </RNAnimated.Text>
          )}
          <Pressable
            style={[s.actionCircleBtn, {
              backgroundColor: alreadyVisited ? '#34c75918' : `${LOG_CLR}18`,
              borderColor: alreadyVisited ? '#34c759' : LOG_CLR,
            }]}
            onPress={alreadyVisited ? undefined : handleLog}
            disabled={alreadyVisited}
          >
            <Ionicons name={alreadyVisited ? 'checkmark' : 'add'} size={16} color={alreadyVisited ? '#34c759' : LOG_CLR} />
          </Pressable>

          <Pressable
            style={[s.actionCircleBtn, {
              backgroundColor: saved ? SAVE_CLR : `${SAVE_CLR}18`,
              borderColor: SAVE_CLR,
            }]}
            onPress={handleSave}
          >
            <RNAnimated.View style={{ transform: [{ scale: saveScale }] }}>
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={14} color={saved ? '#fff' : SAVE_CLR} />
            </RNAnimated.View>
          </Pressable>
        </View>
      </View>

    </View>
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
            <Text style={[s.ratingPillText, { color: c }]}>{rec.avgRating === 10 ? '10' : rec.avgRating.toFixed(1)}</Text>
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
      {/* Section header: Recent activity */}
      <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10 }}>
        {sk(130, 17, 4)}
      </View>
      {/* One activity card */}
      <View style={{ paddingHorizontal: 20 }}>
        <View style={{ paddingVertical: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            {sk(36, 36, 18)}
            <View style={{ flex: 1, gap: 5 }}>
              {sk('72%', 13, 3)}
              {sk('44%', 11, 3)}
            </View>
            {sk(42, 26, 10)}
          </View>
          {sk('58%', 12, 3, { marginTop: 7 })}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 9 }}>
            {sk(30, 30, 15)}
            {sk(30, 30, 15)}
            {sk(30, 30, 15)}
          </View>
        </View>
      </View>
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
  const [myVisitedNames, setMyVisitedNames] = useState<Set<string>>(new Set());
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    // Stale-while-revalidate: show cached data immediately, refresh in background
    const cached = await AsyncStorage.getItem(FRIENDS_CACHE_KEY);
    if (cached) {
      const { friends: fr, activity: act, recommendations: recs, unreadCount: cnt, visitedNames: vn } = JSON.parse(cached);
      setFriends(fr ?? []);
      setActivity(act ?? []);
      setRecommendations(recs ?? []);
      setUnreadCount(cnt ?? 0);
      if (vn) setMyVisitedNames(new Set(vn));
      setLoading(false);
    }

    const [fr, act, count, myVisits] = await Promise.all([
      getFriendsWithStats(),
      getFriendActivity(),
      getUnreadCount(),
      getAllVisits(),
    ]);
    const sorted = fr.sort((a, b) => a.username.localeCompare(b.username));
    setFriends(sorted);
    setActivity(act);
    setUnreadCount(count);
    setMyVisitedNames(new Set(myVisits.map(v => v.venue_name.toLowerCase().trim())));
    setLoading(false);
    AsyncStorage.setItem(FRIENDS_CACHE_KEY, JSON.stringify({ friends: sorted, activity: act, unreadCount: count, visitedNames: myVisits.map(v => v.venue_name.toLowerCase().trim()) }));
  }, []);

  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    load();
    // Keep friends + notifications live while the tab is focused.
    const interval = setInterval(load, 15000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => { clearInterval(interval); sub.remove(); };
  }, [load]));

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
    <TabSlideWrapper myIndex={4}>
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.friendCountLabel}>{friends.length} {friends.length === 1 ? 'FRIEND' : 'FRIENDS'}</Text>
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

      {loading && friends.length === 0 ? (
        <FriendsSkeleton />
      ) : (
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

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
                    {activity.slice(0, 20).map((item, i, arr) => (
                      <ActivityCard
                        key={item.visitId}
                        item={item}
                        isLast={i === arr.length - 1}
                        alreadyVisited={myVisitedNames.has(item.venueName.toLowerCase().trim())}
                      />
                    ))}
                  </View>
                )}
              </View>

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
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  sectionTitle: { fontSize: 17, fontWeight: '400', color: PRIMARY, fontFamily: Fonts.serif, letterSpacing: -0.2 },
  sectionSub: { fontSize: 11, color: MUTED, marginTop: 1 },
  sectionAction: { fontSize: 13, fontWeight: '600', color: ACCENT },

  // Activity list
  cardsStack: { paddingHorizontal: 20, marginBottom: 18 },
  activityRow: { paddingVertical: 10 },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },
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
    borderWidth: 1.5, borderRadius: 999,
    paddingHorizontal: 9, paddingVertical: 3,
    minWidth: 42, alignItems: 'center',
    backgroundColor: 'transparent',
  },
  ratingPillText: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  noteText: {
    fontSize: 12, fontStyle: 'italic', color: NOTE_CLR,
    lineHeight: 16, marginTop: 5, minHeight: 22,
  },

  // Action buttons
  actionRow: { flexDirection: 'row', marginTop: 7, alignItems: 'center', justifyContent: 'space-between' },
  actionRight: { flexDirection: 'row', gap: 8 },
  actionCircleBtn: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  microToast: { fontSize: 11, fontWeight: '600', color: SAVE_CLR },

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
  recCat: { fontSize: 11, fontWeight: '400', color: MUTED, letterSpacing: 0.3 },
  recVenue: { fontSize: 15, fontWeight: '400', color: PRIMARY, fontFamily: Fonts.serif, lineHeight: 18 },
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
  noFriendsTitle: { fontSize: 20, fontWeight: '400', color: PRIMARY, fontFamily: Fonts.serif },
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
  title: { fontSize: 20, fontWeight: '400', color: PRIMARY, fontFamily: Fonts.serif },
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
