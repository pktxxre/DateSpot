import { useCallback, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Pressable,
  FlatList, TextInput,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getVisitsFiltered, Visit, ACTIVITY_TYPES, ActivityType,
  Price, PRICE_LABELS, ratingColor, formatRating,
} from '@/lib/visits';

const CATEGORY_FILTERS: { value: ActivityType | null; label: string; emoji: string }[] = [
  { value: null, label: 'All', emoji: '' },
  ...ACTIVITY_TYPES,
];

export default function HomeScreen() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<ActivityType | null>(null);

  useFocusEffect(
    useCallback(() => {
      setVisits(getVisitsFiltered({ query, activityType: activeCategory }));
    }, [query, activeCategory])
  );

  const refresh = useCallback(() => {
    setVisits(getVisitsFiltered({ query, activityType: activeCategory }));
  }, [query, activeCategory]);

  const handleQuery = (text: string) => {
    setQuery(text);
    setVisits(getVisitsFiltered({ query: text, activityType: activeCategory }));
  };

  const handleCategory = (cat: ActivityType | null) => {
    setActiveCategory(cat);
    setVisits(getVisitsFiltered({ query, activityType: cat }));
  };

  const isFiltering = query.length > 0 || activeCategory !== null;
  const topPicks = visits.filter((v) => v.rating >= 7).slice(0, 10);
  const tryAgain = visits.filter((v) => v.rating >= 4 && v.rating < 7).slice(0, 10);
  const ranked = [...visits].sort((a, b) => b.rank_order - a.rank_order);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>DateSpot</Text>
        <Text style={styles.headerSub}>Your date spot guide</Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#b45309" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search spots…"
            placeholderTextColor="#d97706"
            value={query}
            onChangeText={handleQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsContent}
      >
        {CATEGORY_FILTERS.map((cat) => {
          const active = activeCategory === cat.value;
          return (
            <Pressable
              key={cat.value ?? 'all'}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => handleCategory(cat.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {cat.emoji ? `${cat.emoji} ` : ''}{cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Content */}
      {visits.length === 0 ? (
        <View style={styles.emptyState}>
          {isFiltering ? (
            <>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>No matches</Text>
              <Text style={styles.emptyBody}>Try a different search or category.</Text>
            </>
          ) : (
            <>
              <Text style={styles.emptyEmoji}>🗺</Text>
              <Text style={styles.emptyTitle}>No spots yet</Text>
              <Text style={styles.emptyBody}>Log your first date spot and it'll show up here.</Text>
              <Pressable style={styles.logCta} onPress={() => router.push('/(tabs)/map')}>
                <Text style={styles.logCtaText}>Log a spot</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : isFiltering ? (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionSub}>{visits.length} spot{visits.length !== 1 ? 's' : ''}</Text>
            {ranked.map((v, i) => (
              <RankedRow key={v.id} visit={v} rank={i + 1} />
            ))}
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {topPicks.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your picks</Text>
              <Text style={styles.sectionSub}>Spots you've rated highest</Text>
              <FlatList
                data={topPicks}
                keyExtractor={(v) => v.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12 }}
                renderItem={({ item }) => <SpotCard visit={item} />}
                scrollEnabled
              />
            </View>
          )}

          {tryAgain.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Try again</Text>
              <Text style={styles.sectionSub}>Good spots worth a second date</Text>
              <FlatList
                data={tryAgain}
                keyExtractor={(v) => v.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12 }}
                renderItem={({ item }) => <SpotCard visit={item} />}
                scrollEnabled
              />
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>All your spots</Text>
            <Text style={styles.sectionSub}>Ranked best to worst</Text>
            {ranked.map((v, i) => (
              <RankedRow key={v.id} visit={v} rank={i + 1} />
            ))}
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function SpotCard({ visit }: { visit: Visit }) {
  const info = ACTIVITY_TYPES.find((a) => a.value === visit.activity_type);
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}
      onPress={() => router.push(`/spot/${visit.id}`)}
    >
      <View style={[styles.cardScore, { backgroundColor: ratingColor(visit.rating) }]}>
        <Text style={styles.cardScoreText}>{formatRating(visit.rating)}</Text>
      </View>
      <Text style={styles.cardName} numberOfLines={2}>{visit.venue_name}</Text>
      <View style={styles.cardMeta}>
        <Text style={styles.cardMetaText}>{info?.emoji} {info?.label}</Text>
        <Text style={styles.cardMetaDot}>·</Text>
        <Text style={styles.cardMetaText}>{PRICE_LABELS[visit.price as Price]}</Text>
      </View>
    </Pressable>
  );
}

function RankedRow({ visit, rank }: { visit: Visit; rank: number }) {
  const info = ACTIVITY_TYPES.find((a) => a.value === visit.activity_type);
  return (
    <Pressable
      style={({ pressed }) => [styles.rankedRow, pressed && { opacity: 0.65 }]}
      onPress={() => router.push(`/spot/${visit.id}`)}
    >
      <Text style={styles.rankNumber}>{rank}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.rankName} numberOfLines={1}>{visit.venue_name}</Text>
        <Text style={styles.rankMeta}>
          {info?.emoji} {info?.label} · {PRICE_LABELS[visit.price as Price]}
        </Text>
      </View>
      <View style={[styles.rankBadge, { backgroundColor: ratingColor(visit.rating) + '22' }]}>
        <Text style={[styles.rankBadgeText, { color: ratingColor(visit.rating) }]}>
          {formatRating(visit.rating)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff8ee' },
  scroll: { flex: 1, backgroundColor: '#fff8ee' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#78350f', letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: '#b45309', marginTop: 2 },

  searchRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fef3c7', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: '#fde8c8',
  },
  searchInput: { flex: 1, fontSize: 15, color: '#431407' },

  chipsScroll: { flexGrow: 0, paddingTop: 8 },
  chipsContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: '#fef3c7',
    borderWidth: 1, borderColor: '#fde8c8',
  },
  chipActive: { backgroundColor: '#78350f', borderColor: '#78350f' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#92400e' },
  chipTextActive: { color: '#fff' },

  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#92400e', marginBottom: 2 },
  sectionSub: { fontSize: 13, color: '#d97706', marginBottom: 14 },

  card: {
    width: 160, backgroundColor: '#fff', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#fde8c8',
    shadowColor: '#d97706', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8,
  },
  cardScore: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 10 },
  cardScoreText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  cardName: { fontSize: 14, fontWeight: '700', color: '#431407', marginBottom: 8, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaText: { fontSize: 12, color: '#d97706' },
  cardMetaDot: { fontSize: 12, color: '#fcd34d' },

  rankedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#fde8c8',
  },
  rankNumber: { fontSize: 16, fontWeight: '700', color: '#fcd34d', width: 24, textAlign: 'center' },
  rankName: { fontSize: 15, fontWeight: '600', color: '#431407' },
  rankMeta: { fontSize: 12, color: '#d97706', marginTop: 2 },
  rankBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  rankBadgeText: { fontSize: 12, fontWeight: '700' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#78350f', marginBottom: 8 },
  emptyBody: { fontSize: 15, color: '#b45309', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  logCta: { backgroundColor: '#ff3b5c', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  logCtaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
