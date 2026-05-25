import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, Pressable, ScrollView, Image, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getFollowers, getFollowing, FollowRelation, followUser } from '@/lib/friends';
import { getProfile } from '@/lib/profile';
import { T } from '@/lib/theme';
import { useShimmer, SkBox } from '@/components/SkeletonBox';

function FollowListSkeleton() {
  const { shimmer, screenW } = useShimmer();
  const sk = (w: number | `${number}%`, h: number, r?: number, style?: object) => (
    <SkBox shimmer={shimmer} w={w} h={h} r={r ?? 4} style={style} screenW={screenW} />
  );
  // Root element IS the row — exact same styles as s.row so horizontal position is identical
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 }}>
      {sk(52, 52, 26)}
      <View style={{ flex: 1, minWidth: 0 }}>
        {sk(130, 15, 3)}
      </View>
      {sk(96, 31, 8)}
    </View>
  );
}

type TabKey = 'followers' | 'following';

const AVATAR_PALETTE = ['#F2C18B', '#B5D5C5', '#E8B4D8', '#C9B6E4', '#F4C2A1'];

function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function Avatar({ userId, photoUri, emoticon, username }: {
  userId: string; photoUri: string | null; emoticon: string; username: string;
}) {
  if (photoUri) {
    return <Image source={{ uri: photoUri }} style={s.avatar} resizeMode="cover" />;
  }
  return (
    <View style={[s.avatar, { backgroundColor: avatarColor(userId), alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={s.avatarText}>{emoticon || (username?.[0] ?? '?').toUpperCase()}</Text>
    </View>
  );
}

export default function FollowListScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('followers');
  const [followers, setFollowers] = useState<FollowRelation[]>([]);
  const [following, setFollowing] = useState<FollowRelation[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [handle, setHandle] = useState('');

  const underlineX = useRef(new Animated.Value(0)).current;
  const [tabWidth, setTabWidth] = useState(0);

  useEffect(() => {
    getProfile().then(p => setHandle(p?.handle ?? p?.username ?? ''));
    Promise.all([getFollowers(), getFollowing()]).then(([f, fo]) => {
      setFollowers(f);
      setFollowing(fo);
      setLoading(false);
    });
  }, []);

  function switchTab(tab: TabKey) {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setQuery('');
    Animated.spring(underlineX, {
      toValue: tab === 'followers' ? 0 : tabWidth,
      useNativeDriver: true, damping: 22, stiffness: 300,
    }).start();
  }

  async function handleFollowBack(userId: string) {
    await followUser(userId);
    setFollowers(prev => prev.map(p => p.userId === userId ? { ...p, status: 'friends' as const } : p));
  }

  const list = activeTab === 'followers' ? followers : following;
  const q = query.trim().toLowerCase();
  const filtered = q
    ? list.filter(p => p.username.toLowerCase().includes(q) || p.handle?.toLowerCase().includes(q))
    : list;

  const followerLabel = followers.length === 1 ? '1 Follower' : `${followers.length} Followers`;
  const followingLabel = `${following.length} Following`;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={T.primary} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{handle}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Full-width equal tabs with embedded count */}
      <View
        style={s.tabBar}
        onLayout={e => setTabWidth(e.nativeEvent.layout.width / 2)}
      >
        <Pressable style={s.tab} onPress={() => switchTab('followers')}>
          <Text style={[s.tabLabel, activeTab === 'followers' && s.tabLabelActive]}>
            {loading ? 'Followers' : followerLabel}
          </Text>
        </Pressable>
        <Pressable style={s.tab} onPress={() => switchTab('following')}>
          <Text style={[s.tabLabel, activeTab === 'following' && s.tabLabelActive]}>
            {loading ? 'Following' : followingLabel}
          </Text>
        </Pressable>
        {tabWidth > 0 && (
          <Animated.View style={[s.tabUnderline, { width: tabWidth, transform: [{ translateX: underlineX }] }]} />
        )}
      </View>

      {/* Rounded pill search bar */}
      <View style={s.searchWrap}>
        <Ionicons name="search" size={15} color={T.muted} style={{ marginRight: 8 }} />
        <TextInput
          style={s.searchInput}
          placeholder={activeTab === 'followers' ? 'Search Followers' : 'Search Following'}
          placeholderTextColor={T.muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={15} color={T.muted} />
          </Pressable>
        )}
      </View>

      {/* List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.listContent}
      >
        {loading ? (
          <FollowListSkeleton />
        ) : filtered.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyText}>
              {q ? `No results for "${query}"` : 'No one here yet'}
            </Text>
          </View>
        ) : (
          filtered.map(person => (
            <Pressable
              key={person.userId}
              style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
              onPress={() => router.push(`/user/${person.userId}` as any)}
            >
              <Avatar
                userId={person.userId}
                photoUri={person.profilePhotoUri}
                emoticon={person.avatarEmoticon}
                username={person.username}
              />
              <View style={s.rowInfo}>
                <Text style={s.rowName} numberOfLines={1}>{person.username}</Text>
                {activeTab === 'following' && person.status === 'friends' && (
                  <Text style={s.followsYouText}>Follows you</Text>
                )}
              </View>
              {person.status === 'follow_back' ? (
                <Pressable style={s.followBackBtn} onPress={() => handleFollowBack(person.userId)}>
                  <Text style={s.followBackBtnText}>Follow Back</Text>
                </Pressable>
              ) : (
                <View style={s.followingBtn}>
                  <Text style={s.followingBtnText}>Following</Text>
                </View>
              )}
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const AVATAR_SIZE = 52;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 16, fontWeight: '600', color: T.primary,
  },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border,
    position: 'relative',
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  tabLabel: { fontSize: 16, fontWeight: '400', color: T.muted },
  tabLabelActive: { fontWeight: '700', color: T.primary },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: 0,
    height: 2, backgroundColor: T.primary,
  },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 16, marginBottom: 8,
    backgroundColor: '#EFEFEF',
    borderRadius: 24,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: T.primary, padding: 0 },

  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, gap: 12,
  },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, flexShrink: 0 },
  avatarText: { fontSize: AVATAR_SIZE * 0.4, color: T.primary },
  rowInfo: { flex: 1, minWidth: 0, justifyContent: 'center', alignSelf: 'stretch' },
  rowName: { fontSize: 15, fontWeight: '600', color: T.primary },
  followsYouText: {
    position: 'absolute',
    top: 38,
    left: 0,
    fontSize: 11,
    color: T.muted,
  },

  followingBtn: {
    borderWidth: 1.5, borderColor: '#C0B8B0', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  followingBtnText: { fontSize: 14, fontWeight: '700', color: T.primary },

  followBackBtn: {
    borderWidth: 1.5, borderColor: T.accent, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: T.accentTint,
  },
  followBackBtnText: { fontSize: 14, fontWeight: '700', color: T.accent },

  emptyWrap: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, color: T.muted },
});
