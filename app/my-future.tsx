import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View, Text, Pressable, FlatList, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ACTIVITY_TYPES, OCCASION_TYPES, ActivityType, friendlyDate,
} from '@/lib/visits';
import { getAllFutureSpots, FutureSpot } from '@/lib/future';
import { T } from '@/lib/theme';

const FUTURE_BLUE = '#5856d6';
const FUTURE_BLUE_TINT = '#5856d618';

function FutureSpotRow({ spot }: { spot: FutureSpot }) {
  const categoryInfo = ACTIVITY_TYPES.find(a => a.value === spot.activity_type);
  const occasionInfo = OCCASION_TYPES.find(a => a.value === spot.occasion_type);
  const dateStr = friendlyDate(spot.created_at);
  const metaLine = [categoryInfo?.label, occasionInfo?.label].filter(Boolean).join(' · ');

  return (
    <Pressable
      style={({ pressed }) => [s.row, pressed && { opacity: 0.75 }]}
      onPress={() => router.push(`/future/${spot.id}` as any)}
    >
      <View style={s.rowMain}>
        <Text style={s.rowName} numberOfLines={1}>{spot.venue_name}</Text>
        {metaLine ? <Text style={s.rowMeta} numberOfLines={1}>{metaLine}</Text> : null}
        <Text style={s.rowDate}>Added {dateStr}</Text>
      </View>
      <View style={s.bookmarkPill}>
        <Ionicons name="bookmark" size={11} color={FUTURE_BLUE} />
      </View>
    </Pressable>
  );
}

export default function MyFutureScreen() {
  const [futureSpots, setFutureSpots] = useState<FutureSpot[]>(() => getAllFutureSpots());
  const [categories, setCategories] = useState<string[]>([]);
  const [activityFilters, setActivityFilters] = useState<ActivityType[]>([]);

  useFocusEffect(
    useCallback(() => {
      setFutureSpots(getAllFutureSpots());
    }, [])
  );

  function toggleCategory(val: string) {
    setCategories(prev => prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val]);
  }
  function toggleActivity(val: ActivityType) {
    setActivityFilters(prev => prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val]);
  }

  const filtered = useMemo(() => {
    let list = futureSpots;
    if (categories.length > 0) list = list.filter(f => categories.includes(f.occasion_type ?? ''));
    if (activityFilters.length > 0) list = list.filter(f => activityFilters.includes(f.activity_type as ActivityType));
    return list;
  }, [futureSpots, categories, activityFilters]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={T.primary} />
          </Pressable>
          <Text style={s.title}>Saved Spots</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Occasion filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.chipScroll}
          contentContainerStyle={s.chipRow}
        >
          {OCCASION_TYPES.map(a => {
            const active = categories.includes(a.value);
            return (
              <Pressable
                key={a.value}
                style={[s.chip, active && s.chipActive]}
                onPress={() => toggleCategory(a.value)}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{a.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Activity filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.chipScroll}
          contentContainerStyle={[s.chipRow, { paddingTop: 0, paddingBottom: 8 }]}
        >
          {ACTIVITY_TYPES.map(a => {
            const active = activityFilters.includes(a.value as ActivityType);
            return (
              <Pressable
                key={a.value}
                style={[s.chip, active && s.chipActive]}
                onPress={() => toggleActivity(a.value as ActivityType)}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{a.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={s.sortRow}>
          <Text style={s.countLabel}>{filtered.length} spot{filtered.length !== 1 ? 's' : ''}</Text>
        </View>

        {futureSpots.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="bookmark-outline" size={36} color={T.muted} style={{ marginBottom: 12 }} />
            <Text style={s.emptyTitle}>No saved spots yet</Text>
            <Text style={s.emptyHint}>Save spots from the map or Discover tab</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No spots match these filters</Text>
            <Pressable onPress={() => { setCategories([]); setActivityFilters([]); }}>
              <Text style={s.clearFilter}>Clear filters</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={f => f.id}
            renderItem={({ item }) => <FutureSpotRow spot={item} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.listContent}
          />
        )}
      </SafeAreaView>
    </>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700', color: T.primary },
  chipScroll: { flexShrink: 0, flexGrow: 0 },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
  },
  chipActive: { backgroundColor: FUTURE_BLUE_TINT, borderColor: FUTURE_BLUE },
  chipText: { fontSize: 13, fontWeight: '600', color: T.muted },
  chipTextActive: { color: FUTURE_BLUE },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  countLabel: { fontSize: 13, color: T.muted },
  listContent: { paddingBottom: 120 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  rowMain: { flex: 1, marginRight: 12 },
  rowName: { fontSize: 17, fontWeight: '700', color: T.primary, marginBottom: 4 },
  rowMeta: { fontSize: 13, color: T.muted, marginBottom: 2 },
  rowDate: { fontSize: 12, color: T.muted, marginTop: 4 },
  bookmarkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: FUTURE_BLUE_TINT,
    backgroundColor: '#5856d608',
    flexShrink: 0,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '400', color: T.primary, fontFamily: 'Fraunces-Regular', textAlign: 'center' },
  emptyHint: { fontSize: 14, color: T.muted, textAlign: 'center' },
  clearFilter: { fontSize: 14, color: FUTURE_BLUE, fontWeight: '600' },
});
