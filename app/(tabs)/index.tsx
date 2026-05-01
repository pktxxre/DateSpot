import { useCallback, useState } from 'react';
import {
  StyleSheet, View, Text, TextInput,
  ScrollView, Pressable, FlatList,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getVisitsFiltered, getAllVisits, Visit,
  ActivityType, Price, ACTIVITY_TYPES, PRICE_LABELS, ratingColor,
} from '@/lib/visits';

export default function HomeScreen() {
  const [query, setQuery] = useState('');
  const [activeType, setActiveType] = useState<ActivityType | null>(null);
  const [activePrice, setActivePrice] = useState<Price | null>(null);
  const [allVisits, setAllVisits] = useState<Visit[]>([]);

  useFocusEffect(useCallback(() => { setAllVisits(getAllVisits()); }, []));

  const filtered = getVisitsFiltered({ query: query.trim() || undefined, activityType: activeType, price: activePrice });
  const isFiltering = !!query.trim() || !!activeType || !!activePrice;
  const topPicks = allVisits.filter((v) => v.rating === 3).slice(0, 10);
  const tryAgain = allVisits.filter((v) => v.rating === 2).slice(0, 10);
  const hasAny = allVisits.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>DateSpot</Text>
          <Text style={styles.headerSub}>Your date spot guide</Text>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color="#8e8e93" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your spots…"
            placeholderTextColor="#c7c7cc"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
          <FilterChip label="All" emoji="🗺" selected={activeType === null} onPress={() => setActiveType(null)} />
          {ACTIVITY_TYPES.map((a) => (
            <FilterChip key={a.value} label={a.label} emoji={a.emoji}
              selected={activeType === a.value}
              onPress={() => setActiveType(activeType === a.value ? null : a.value)} />
          ))}
        </ScrollView>

        <View style={styles.priceRow}>
          {([1, 2, 3] as Price[]).map((p) => (
            <Pressable key={p} style={[styles.priceChip, activePrice === p && styles.priceChipSelected]}
              onPress={() => setActivePrice(activePrice === p ? null : p)}>
              <Text style={[styles.priceChipText, activePrice === p && styles.priceChipTextSelected]}>{PRICE_LABELS[p]}</Text>
            </Pressable>
          ))}
          <Text style={styles.priceHint}>Price</Text>
        </View>

        {isFiltering && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{filtered.length} spot{filtered.length !== 1 ? 's' : ''} found</Text>
            {filtered.length === 0
              ? <View style={styles.emptyCard}><Text style={styles.emptyCardText}>No spots match those filters.</Text></View>
              : filtered.map((v) => <SpotRow key={v.id} visit={v} />)}
          </View>
        )}

        {!hasAny && !isFiltering && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🗺</Text>
            <Text style={styles.emptyTitle}>No spots yet</Text>
            <Text style={styles.emptyBody}>Log your first date spot and it'll show up here with recommendations.</Text>
            <Pressable style={styles.logCta} onPress={() => router.push('/(tabs)/log')}>
              <Text style={styles.logCtaText}>Log a spot</Text>
            </Pressable>
          </View>
        )}

        {!isFiltering && topPicks.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your picks</Text>
            <Text style={styles.sectionSub}>Spots you've rated highest</Text>
            <FlatList data={topPicks} keyExtractor={(v) => v.id} horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12 }} renderItem={({ item }) => <SpotCard visit={item} />} scrollEnabled />
          </View>
        )}

        {!isFiltering && tryAgain.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Try again</Text>
            <Text style={styles.sectionSub}>Good spots worth a second date</Text>
            <FlatList data={tryAgain} keyExtractor={(v) => v.id} horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12 }} renderItem={({ item }) => <SpotCard visit={item} />} scrollEnabled />
          </View>
        )}

        {!isFiltering && hasAny && (
          <View style={styles.section}>
            <View style={styles.teaserCard}>
              <Text style={styles.teaserEmoji}>👥</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.teaserTitle}>What others loved</Text>
                <Text style={styles.teaserBody}>Recommendations from people who went on dates at the same spots. Coming in V2.</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function FilterChip({ label, emoji, selected, onPress }: { label: string; emoji: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={styles.chipEmoji}>{emoji}</Text>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

function SpotCard({ visit }: { visit: Visit }) {
  const info = ACTIVITY_TYPES.find((a) => a.value === visit.activity_type);
  return (
    <View style={styles.card}>
      <View style={[styles.cardDot, { backgroundColor: ratingColor(visit.rating) }]} />
      <Text style={styles.cardName} numberOfLines={2}>{visit.venue_name}</Text>
      <View style={styles.cardMeta}>
        <Text style={styles.cardMetaText}>{info?.emoji} {info?.label}</Text>
        <Text style={styles.cardMetaDot}>·</Text>
        <Text style={styles.cardMetaText}>{PRICE_LABELS[visit.price as Price]}</Text>
      </View>
    </View>
  );
}

function SpotRow({ visit }: { visit: Visit }) {
  const info = ACTIVITY_TYPES.find((a) => a.value === visit.activity_type);
  return (
    <View style={styles.row}>
      <View style={[styles.rowDot, { backgroundColor: ratingColor(visit.rating) }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.rowName} numberOfLines={1}>{visit.venue_name}</Text>
        <Text style={styles.rowMeta}>{info?.emoji} {info?.label} · {PRICE_LABELS[visit.price as Price]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#1c1c1e', letterSpacing: -0.5 },
  headerSub: { fontSize: 14, color: '#8e8e93', marginTop: 2 },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f2f2f7', borderRadius: 14, marginHorizontal: 20, marginTop: 14, paddingHorizontal: 14, height: 46 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#1c1c1e' },
  filterScroll: { marginTop: 12 },
  filterContent: { paddingHorizontal: 20, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#f2f2f7', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: 'transparent' },
  chipSelected: { backgroundColor: '#fff0f3', borderColor: '#ff3b5c' },
  chipEmoji: { fontSize: 14 },
  chipLabel: { fontSize: 13, fontWeight: '500', color: '#3a3a3c' },
  chipLabelSelected: { color: '#ff3b5c', fontWeight: '700' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginTop: 10 },
  priceChip: { paddingHorizontal: 16, paddingVertical: 7, backgroundColor: '#f2f2f7', borderRadius: 20, borderWidth: 1.5, borderColor: 'transparent' },
  priceChipSelected: { backgroundColor: '#fff0f3', borderColor: '#ff3b5c' },
  priceChipText: { fontSize: 13, fontWeight: '600', color: '#3a3a3c' },
  priceChipTextSelected: { color: '#ff3b5c' },
  priceHint: { fontSize: 12, color: '#c7c7cc', marginLeft: 4 },
  section: { paddingHorizontal: 20, marginTop: 28 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1c1c1e', marginBottom: 2 },
  sectionSub: { fontSize: 13, color: '#8e8e93', marginBottom: 14 },
  card: { width: 160, backgroundColor: '#f9f9f9', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f0f0f0' },
  cardDot: { width: 12, height: 12, borderRadius: 6, marginBottom: 10, borderWidth: 2, borderColor: '#fff' },
  cardName: { fontSize: 14, fontWeight: '700', color: '#1c1c1e', marginBottom: 8, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaText: { fontSize: 12, color: '#8e8e93' },
  cardMetaDot: { fontSize: 12, color: '#c7c7cc' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  rowDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff', flexShrink: 0 },
  rowName: { fontSize: 15, fontWeight: '600', color: '#1c1c1e' },
  rowMeta: { fontSize: 12, color: '#8e8e93', marginTop: 2 },
  emptyCard: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 16, alignItems: 'center' },
  emptyCardText: { fontSize: 14, color: '#8e8e93' },
  emptyState: { alignItems: 'center', paddingHorizontal: 40, paddingTop: 48 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1c1c1e', marginBottom: 8 },
  emptyBody: { fontSize: 15, color: '#8e8e93', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  logCta: { backgroundColor: '#ff3b5c', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  logCtaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  teaserCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: '#f9f9f9', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#f0f0f0' },
  teaserEmoji: { fontSize: 28 },
  teaserTitle: { fontSize: 15, fontWeight: '700', color: '#1c1c1e', marginBottom: 4 },
  teaserBody: { fontSize: 13, color: '#8e8e93', lineHeight: 18 },
});
