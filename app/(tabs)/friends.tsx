import { StyleSheet, View, Text, ScrollView, Pressable, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { T } from '@/lib/theme';

const AVATAR_COLORS = ['#F2C18B', '#B5D5C5', '#E8B4D8', '#F4C2A1', '#C9B6E4'];
const PLACEHOLDER_FRIENDS = [
  { handle: '@sarahk', name: 'Sarah Kim', spots: 42, color: AVATAR_COLORS[0], initial: 'S' },
  { handle: '@jakem', name: 'Jake Morales', spots: 28, color: AVATAR_COLORS[1], initial: 'J' },
  { handle: '@miac', name: 'Mia Chen', spots: 67, color: AVATAR_COLORS[2], initial: 'M' },
  { handle: '@devonp', name: 'Devon Park', spots: 19, color: AVATAR_COLORS[3], initial: 'D' },
  { handle: '@priyas', name: 'Priya Shah', spots: 51, color: AVATAR_COLORS[4], initial: 'P' },
];

type FeedItem = {
  id: string;
  friendInitial: string;
  friendName: string;
  friendColor: string;
  action: 'logged' | 'wants';
  spotName: string;
  category: string;
  score?: number;
  note?: string;
  timeAgo: string;
};

const FEED_ITEMS: FeedItem[] = [
  {
    id: '1',
    friendInitial: 'S',
    friendName: 'Sarah Kim',
    friendColor: AVATAR_COLORS[0],
    action: 'logged',
    spotName: 'Canlis',
    category: 'Food',
    score: 9.2,
    note: 'Anniversary dinner. Tasting menu was perfect.',
    timeAgo: '2h ago',
  },
  {
    id: '2',
    friendInitial: 'J',
    friendName: 'Jake Morales',
    friendColor: AVATAR_COLORS[1],
    action: 'wants',
    spotName: 'Canon',
    category: 'Drinks',
    timeAgo: '5h ago',
  },
  {
    id: '3',
    friendInitial: 'M',
    friendName: 'Mia Chen',
    friendColor: AVATAR_COLORS[2],
    action: 'logged',
    spotName: 'Kerry Park',
    category: 'Views',
    score: 9.5,
    note: 'Sunset was unreal. Bring layers.',
    timeAgo: 'Yesterday',
  },
  {
    id: '4',
    friendInitial: 'P',
    friendName: 'Priya Shah',
    friendColor: AVATAR_COLORS[4],
    action: 'logged',
    spotName: 'The Pink Door',
    category: 'Food',
    score: 8.9,
    timeAgo: '2d ago',
  },
];

type RecommendedSpot = {
  id: string;
  name: string;
  category: string;
  score: number;
  friendCount: number;
  friendInitials: string[];
};

const RECOMMENDED: RecommendedSpot[] = [
  { id: 'r1', name: 'Westward', category: 'Food', score: 9.1, friendCount: 2, friendInitials: ['S', 'M'] },
  { id: 'r2', name: "Damn the Weather", category: 'Drinks', score: 8.8, friendCount: 3, friendInitials: ['J', 'P', 'D'] },
  { id: 'r3', name: 'Discovery Park', category: 'Outdoors', score: 9.0, friendCount: 2, friendInitials: ['M', 'S'] },
];

export default function FriendsScreen() {
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.title}>Friends</Text>
        <Text style={s.friendCount}>{PLACEHOLDER_FRIENDS.length} FRIENDS</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Activity feed */}
        <Text style={s.sectionTitle}>Recent activity</Text>
        {FEED_ITEMS.map(item => (
          <FeedCard key={item.id} item={item} />
        ))}

        {/* Friend recommendations */}
        <View style={s.recSection}>
          <Text style={s.sectionTitle}>Loved by people you trust</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recRow}>
            {RECOMMENDED.map(r => (
              <RecCard key={r.id} spot={r} />
            ))}
          </ScrollView>
        </View>

        {/* Friend roster */}
        <Text style={s.sectionTitle}>Your friends</Text>
        {PLACEHOLDER_FRIENDS.map((f, i) => (
          <View key={f.handle} style={s.friendRow}>
            <View style={[s.friendAvatar, { backgroundColor: f.color }]}>
              <Text style={s.friendAvatarText}>{f.initial}</Text>
            </View>
            <View style={s.friendInfo}>
              <Text style={s.friendName}>{f.name}</Text>
              <Text style={s.friendHandle}>{f.handle} · {f.spots} spots</Text>
            </View>
          </View>
        ))}

        {/* Invite row */}
        <Pressable
          style={s.inviteRow}
          onPress={() => Share.share({ message: 'Join me on DateSpot!' }).catch(() => {})}
        >
          <Ionicons name="link-outline" size={18} color={T.accent} />
          <Text style={s.inviteText}>Share invite link</Text>
          <Ionicons name="chevron-forward" size={16} color={T.muted} style={{ marginLeft: 'auto' }} />
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function FeedCard({ item }: { item: FeedItem }) {
  return (
    <View style={s.feedCard}>
      <View style={s.feedTop}>
        <View style={[s.feedAvatar, { backgroundColor: item.friendColor }]}>
          <Text style={s.feedAvatarText}>{item.friendInitial}</Text>
        </View>
        <View style={s.feedMeta}>
          <Text style={s.feedName}>
            <Text style={s.feedBold}>{item.friendName}</Text>
            {item.action === 'logged' ? ' logged ' : ' wants to go to '}
            <Text style={s.feedBold}>{item.spotName}</Text>
          </Text>
          <Text style={s.feedTime}>{item.timeAgo} · {item.category}</Text>
        </View>
        {item.score !== undefined && (
          <View style={s.feedScore}>
            <Text style={s.feedScoreText}>{item.score.toFixed(1)}</Text>
          </View>
        )}
      </View>
      {item.note && (
        <Text style={s.feedNote}>"{item.note}"</Text>
      )}
      {item.action === 'logged' && (
        <View style={s.feedActions}>
          <Pressable style={s.feedAction}>
            <Ionicons name="bookmark-outline" size={14} color={T.muted} />
            <Text style={s.feedActionText}>Want to go</Text>
          </Pressable>
          <Pressable style={s.feedAction}>
            <Ionicons name="heart-outline" size={14} color={T.muted} />
            <Text style={s.feedActionText}>React</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function RecCard({ spot }: { spot: RecommendedSpot }) {
  return (
    <View style={s.recCard}>
      <Text style={s.recCategory}>{spot.category.toUpperCase()}</Text>
      <Text style={s.recName}>{spot.name}</Text>
      <View style={s.recFooter}>
        <View style={s.recAvatars}>
          {spot.friendInitials.slice(0, 3).map((init, i) => (
            <View
              key={i}
              style={[s.recAvatar, { backgroundColor: AVATAR_COLORS[i], marginLeft: i > 0 ? -8 : 0 }]}
            >
              <Text style={s.recAvatarText}>{init}</Text>
            </View>
          ))}
        </View>
        <Text style={s.recFriendCount}>{spot.friendCount} friends loved this</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  scroll: { paddingBottom: 20 },

  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: '#F2ECE4',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: T.primary,
    fontFamily: 'Georgia',
  },
  friendCount: {
    fontSize: 11,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 1.2,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 10,
  },

  feedCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: T.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: T.border,
  },
  feedTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  feedAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  feedAvatarText: { fontSize: 14, fontWeight: '700', color: T.primary },
  feedMeta: { flex: 1 },
  feedName: { fontSize: 14, color: T.primary, lineHeight: 20 },
  feedBold: { fontWeight: '700' },
  feedTime: { fontSize: 12, color: T.muted, marginTop: 2 },
  feedScore: {
    backgroundColor: T.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  feedScoreText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  feedNote: {
    fontSize: 13,
    color: T.muted,
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
  },
  feedActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
  },
  feedAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  feedActionText: { fontSize: 13, color: T.muted, fontWeight: '500' },

  recSection: { marginBottom: 4 },
  recRow: { paddingHorizontal: 16, gap: 10, paddingBottom: 4 },
  recCard: {
    width: 160,
    backgroundColor: T.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: T.border,
  },
  recCategory: {
    fontSize: 10,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  recName: {
    fontSize: 15,
    fontWeight: '700',
    color: T.primary,
    fontFamily: 'Georgia',
    marginBottom: 10,
    lineHeight: 20,
  },
  recFooter: { gap: 4 },
  recAvatars: { flexDirection: 'row' },
  recAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: T.card,
  },
  recAvatarText: { fontSize: 9, fontWeight: '700', color: T.primary },
  recFriendCount: { fontSize: 11, color: T.muted },

  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
    gap: 12,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarText: { fontSize: 16, fontWeight: '700', color: T.primary },
  friendInfo: { flex: 1 },
  friendName: { fontSize: 15, fontWeight: '600', color: T.primary },
  friendHandle: { fontSize: 12, color: T.muted, marginTop: 1 },

  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
    marginTop: 8,
  },
  inviteText: { fontSize: 15, fontWeight: '600', color: T.accent },
});
