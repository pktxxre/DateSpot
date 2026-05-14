import { useCallback, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, FlatList } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAllVisits, Visit, ACTIVITY_TYPES, PRICE_LABELS, Price, formatRating, ratingColor, friendlyDate } from '@/lib/visits';
import { scheduleOpenLog } from './map';
import { T } from '@/lib/theme';

type SortOption = 'best' | 'recent';
type CategoryFilter = string | null;

function sortVisits(visits: Visit[], sort: SortOption): Visit[] {
  const copy = [...visits];
  if (sort === 'best') return copy.sort((a, b) => b.rating - a.rating);
  return copy.sort((a, b) => {
    const ta = new Date(a.visited_at || a.created_at).getTime();
    const tb = new Date(b.visited_at || b.created_at).getTime();
    return tb - ta;
  });
}

export default function ListsScreen() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [sort, setSort] = useState<SortOption>('best');
  const [category, setCategory] = useState<CategoryFilter>(null);

  useFocusEffect(
    useCallback(() => {
      setVisits(getAllVisits().filter(v => !(v as any).is_seed));
    }, [])
  );

  const categoryCounts: Record<string, number> = {};
  for (const v of visits) {
    categoryCounts[v.activity_type] = (categoryCounts[v.activity_type] ?? 0) + 1;
  }

  const filtered = category
    ? visits.filter(v => v.activity_type === category)
    : visits;

  const sorted = sortVisits(filtered, sort);

  function openLog() {
    scheduleOpenLog();
    router.navigate('/(tabs)/map');
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.statNum}>{visits.length}</Text>
        <Text style={s.statLabel}>SPOTS LOGGED</Text>
      </View>

      {/* Category filter row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.chipScroll}
        contentContainerStyle={s.chipRow}
      >
        <Pressable
          style={[s.chip, category === null && s.chipActive]}
          onPress={() => setCategory(null)}
        >
          <Text style={[s.chipText, category === null && s.chipTextActive]}>All</Text>
        </Pressable>
        {ACTIVITY_TYPES.map(a => {
          const count = categoryCounts[a.value] ?? 0;
          if (count === 0) return null;
          const active = category === a.value;
          return (
            <Pressable
              key={a.value}
              style={[s.chip, active && s.chipActive]}
              onPress={() => setCategory(active ? null : a.value)}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>
                {a.label} ({count})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Sort + count row */}
      <View style={s.sortRow}>
        <Text style={s.countLabel}>{sorted.length} spot{sorted.length !== 1 ? 's' : ''}</Text>
        <View style={s.sortGroup}>
          {(['best', 'recent'] as SortOption[]).map(opt => (
            <Pressable
              key={opt}
              style={[s.sortChip, sort === opt && s.sortChipActive]}
              onPress={() => setSort(opt)}
            >
              <Text style={[s.sortChipText, sort === opt && s.sortChipTextActive]}>
                {opt === 'best' ? 'Best' : 'Recent'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* List */}
      {visits.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No spots yet</Text>
          <Pressable style={s.logCta} onPress={openLog}>
            <Text style={s.logCtaText}>+ Log your first spot</Text>
          </Pressable>
        </View>
      ) : sorted.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No {ACTIVITY_TYPES.find(a => a.value === category)?.label} spots yet</Text>
          <Pressable onPress={() => setCategory(null)}>
            <Text style={s.clearFilter}>Clear filter</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={v => v.id}
          renderItem={({ item }) => <LogRow visit={item} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.listContent}
        />
      )}
    </SafeAreaView>
  );
}

function LogRow({ visit }: { visit: Visit }) {
  const info = ACTIVITY_TYPES.find(a => a.value === visit.activity_type);
  const priceLabel = PRICE_LABELS[visit.price as Price];
  const dateStr = friendlyDate(visit.visited_at || visit.created_at);
  const color = ratingColor(visit.rating);
  const isFree = visit.price === 0;

  return (
    <Pressable
      style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
      onPress={() => router.push(`/spot/${visit.id}`)}
    >
      <View style={s.rowMain}>
        <View style={s.rowTop}>
          <Text style={s.rowName} numberOfLines={1}>{visit.venue_name}</Text>
          {visit.rating > 0 && (
            <View style={[s.scorePill, { backgroundColor: color }]}>
              <Text style={s.scorePillText}>{formatRating(visit.rating)}</Text>
            </View>
          )}
        </View>

        <View style={s.rowMeta}>
          {info && <Text style={s.metaText}>{info.label}</Text>}
          {isFree ? (
            <View style={s.freeBadge}><Text style={s.freeBadgeText}>Free</Text></View>
          ) : (
            <Text style={s.metaText}>{priceLabel}</Text>
          )}
          <Text style={s.metaText}>{dateStr}</Text>
        </View>

        {visit.notes ? (
          <Text style={s.note} numberOfLines={1}>"{visit.notes.trim().slice(0, 70)}"</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },

  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: '#F2ECE4',
  },
  statNum: {
    fontSize: 40,
    fontWeight: '800',
    color: T.primary,
    fontFamily: 'Georgia',
    lineHeight: 44,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 1.5,
    marginBottom: 4,
  },

  chipScroll: { flexGrow: 0 },
  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
  },
  chipActive: { backgroundColor: T.primary, borderColor: T.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: T.muted },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  countLabel: { fontSize: 13, color: T.muted },
  sortGroup: { flexDirection: 'row', gap: 6 },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
  },
  sortChipActive: { backgroundColor: T.primary, borderColor: T.primary },
  sortChipText: { fontSize: 12, fontWeight: '600', color: T.muted },
  sortChipTextActive: { color: '#fff' },

  listContent: { paddingBottom: 40 },

  row: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  rowMain: { flex: 1 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '600',
    color: T.primary,
    fontFamily: 'Georgia',
    flex: 1,
    marginRight: 10,
  },
  scorePill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  scorePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
  },

  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: T.muted },
  freeBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  freeBadgeText: { fontSize: 11, fontWeight: '700', color: '#2E7D32' },

  note: { fontSize: 12, color: '#A0927E', fontStyle: 'italic', lineHeight: 17 },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: T.primary,
    fontFamily: 'Georgia',
    textAlign: 'center',
  },
  clearFilter: { fontSize: 14, color: T.accent, fontWeight: '600' },
  logCta: {
    backgroundColor: 'transparent',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderWidth: 1.5,
    borderColor: T.accent,
  },
  logCtaText: { color: T.accent, fontSize: 15, fontWeight: '700' },
});
