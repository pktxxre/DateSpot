import { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Pressable,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getAllVisits, Visit, ACTIVITY_TYPES, PRICE_LABELS, Price, formatRating, ratingColor, friendlyDate } from '@/lib/visits';
import { getSeedSpots, SeedSpot } from '@/lib/seeds';
import { T } from '@/lib/theme';

const SCREEN_W = Dimensions.get('window').width;
const MONTHLY_GOAL = 6;

const CATEGORY_LABELS: Record<string, string> = {
  food: 'Food',
  drinks: 'Drinks',
  outdoors: 'Outdoors',
  view: 'Views',
  entertainment: 'Entertainment',
  other: 'Other',
};

type PriceFilter = 0 | 1 | 2 | 3 | null;

function getMonthVisits(visits: Visit[]): Visit[] {
  const now = new Date();
  return visits.filter(v => {
    const d = new Date(v.visited_at || v.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
}

function formatMonth(): string {
  return new Date().toLocaleString('default', { month: 'long' });
}

export default function HomeScreen() {
  const [seeds, setSeeds] = useState<SeedSpot[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [priceFilter, setPriceFilter] = useState<PriceFilter>(null);

  useFocusEffect(
    useCallback(() => {
      setVisits(getAllVisits().filter(v => !(v as any).is_seed));
    }, [])
  );

  useEffect(() => {
    getSeedSpots().then(data => {
      setSeeds(data);
      setLoading(false);
    });
  }, []);

  const filtered = seeds.filter(s => {
    if (categoryFilter && s.activity_type !== categoryFilter) return false;
    if (priceFilter !== null && s.price !== priceFilter) return false;
    return true;
  });

  const categoryCounts: Record<string, number> = {};
  for (const s of seeds) {
    categoryCounts[s.activity_type] = (categoryCounts[s.activity_type] ?? 0) + 1;
  }

  const monthVisits = getMonthVisits(visits);
  const recentVisits = [...visits].sort((a, b) => {
    const ta = new Date(a.visited_at || a.created_at).getTime();
    const tb = new Date(b.visited_at || b.created_at).getTime();
    return tb - ta;
  }).slice(0, 5);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.city}>SEATTLE</Text>
          <Text style={s.title}>Discover</Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/profile')} style={s.avatar}>
          <Text style={s.avatarText}>A</Text>
        </Pressable>
      </View>

      {/* Monthly goal */}
      {monthVisits.length > 0 && (
        <View style={s.goalBar}>
          <Text style={s.goalText}>
            Your {formatMonth()} — <Text style={s.goalBold}>{monthVisits.length} of {MONTHLY_GOAL} logged</Text>
            {monthVisits.length < MONTHLY_GOAL
              ? ` · ${MONTHLY_GOAL - monthVisits.length} more to hit your monthly goal`
              : ' · Goal reached! 🎉'}
          </Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Category filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={s.chipRow}>
          <Pressable
            style={[s.chip, categoryFilter === null && s.chipActive]}
            onPress={() => setCategoryFilter(null)}
          >
            <Text style={[s.chipText, categoryFilter === null && s.chipTextActive]}>
              All {seeds.length > 0 ? `(${seeds.length})` : ''}
            </Text>
          </Pressable>
          {ACTIVITY_TYPES.map(a => {
            const count = categoryCounts[a.value] ?? 0;
            if (count === 0) return null;
            const active = categoryFilter === a.value;
            return (
              <Pressable
                key={a.value}
                style={[s.chip, active && s.chipActive]}
                onPress={() => setCategoryFilter(active ? null : a.value)}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>
                  {CATEGORY_LABELS[a.value]} ({count})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Price filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={s.chipRow}>
          {([null, 0, 1, 2, 3] as (PriceFilter)[]).map(p => {
            const active = priceFilter === p;
            const label = p === null ? 'Any price' : PRICE_LABELS[p as Price];
            return (
              <Pressable
                key={String(p)}
                style={[s.chip, active && s.chipActive]}
                onPress={() => setPriceFilter(active ? null : p)}
              >
                <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Spot cards */}
        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={T.accent} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyText}>No spots match</Text>
            <Pressable onPress={() => { setCategoryFilter(null); setPriceFilter(null); }}>
              <Text style={s.emptyLink}>Clear filters</Text>
            </Pressable>
          </View>
        ) : (
          filtered.map(spot => (
            <SeedCard key={spot.id} spot={spot} />
          ))
        )}

        {/* Recent dates section */}
        {recentVisits.length > 0 && (
          <View style={s.recentSection}>
            <View style={s.recentHeader}>
              <Text style={s.recentTitle}>Recent dates</Text>
              <Pressable onPress={() => router.push('/(tabs)/lists')}>
                <Text style={s.seeAll}>See all →</Text>
              </Pressable>
            </View>
            {recentVisits.map(v => <RecentRow key={v.id} visit={v} />)}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SeedCard({ spot }: { spot: SeedSpot }) {
  const catLabel = CATEGORY_LABELS[spot.activity_type] ?? spot.activity_type;
  const priceLabel = PRICE_LABELS[spot.price as Price] ?? '';

  return (
    <Pressable
      style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
      onPress={() => router.push(`/spot/${spot.id}` as any)}
    >
      <View style={s.cardBadgeRow}>
        <View style={s.editorBadge}>
          <Text style={s.editorBadgeText}>Editor's pick</Text>
        </View>
        <Text style={s.cardScore}>{spot.rating.toFixed(1)}</Text>
      </View>
      <Text style={s.cardMeta}>
        {catLabel.toUpperCase()}
        {priceLabel ? ` · ${priceLabel}` : ''}
      </Text>
      <Text style={s.cardName}>{spot.venue_name}</Text>
      {spot.notes ? (
        <Text style={s.cardDesc} numberOfLines={2}>{spot.notes}</Text>
      ) : null}
    </Pressable>
  );
}

function RecentRow({ visit }: { visit: Visit }) {
  const dateStr = friendlyDate(visit.visited_at || visit.created_at);
  const color = ratingColor(visit.rating);
  return (
    <Pressable
      style={({ pressed }) => [s.recentRow, pressed && { opacity: 0.7 }]}
      onPress={() => router.push(`/spot/${visit.id}`)}
    >
      <View style={s.recentRowLeft}>
        <Text style={s.recentDate}>{dateStr}</Text>
        <Text style={s.recentName}>{visit.venue_name}</Text>
        {visit.notes ? (
          <Text style={s.recentNote} numberOfLines={1}>"{visit.notes.trim().slice(0, 60)}"</Text>
        ) : null}
      </View>
      {visit.rating > 0 && (
        <View style={[s.recentScore, { borderColor: color }]}>
          <Text style={[s.recentScoreText, { color }]}>{formatRating(visit.rating)}</Text>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  scroll: { paddingBottom: 20 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#F2ECE4',
  },
  city: {
    fontSize: 11,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: T.primary,
    fontFamily: 'Georgia',
    letterSpacing: -0.5,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E8C99A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  avatarText: { fontSize: 16, fontWeight: '700', color: T.primary },

  goalBar: {
    backgroundColor: '#F2ECE4',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  goalText: { fontSize: 12, color: T.muted, lineHeight: 18 },
  goalBold: { fontWeight: '700', color: T.primary },

  chipScroll: { marginBottom: 0 },
  chipRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
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

  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: T.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: T.border,
  },
  cardBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  editorBadge: {
    backgroundColor: '#FFF0EB',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  editorBadgeText: { fontSize: 11, fontWeight: '600', color: T.accent },
  cardScore: { fontSize: 18, fontWeight: '800', color: '#8B6A3E' },
  cardMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  cardName: {
    fontSize: 20,
    fontWeight: '700',
    color: T.primary,
    fontFamily: 'Georgia',
    marginBottom: 6,
  },
  cardDesc: { fontSize: 13, color: T.muted, lineHeight: 19 },

  loadingWrap: { paddingVertical: 60, alignItems: 'center' },
  emptyWrap: { paddingVertical: 40, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 16, color: T.muted },
  emptyLink: { fontSize: 14, color: T.accent, fontWeight: '600' },

  recentSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  recentTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: T.primary,
    fontFamily: 'Georgia',
  },
  seeAll: { fontSize: 13, color: T.accent, fontWeight: '600' },

  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  recentRowLeft: { flex: 1, marginRight: 12 },
  recentDate: { fontSize: 11, color: T.muted, marginBottom: 2 },
  recentName: { fontSize: 15, fontWeight: '600', color: T.primary, marginBottom: 2 },
  recentNote: { fontSize: 12, color: T.muted, fontStyle: 'italic' },
  recentScore: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  recentScoreText: { fontSize: 13, fontWeight: '800' },
});
