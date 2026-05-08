import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, ImageBackground, Dimensions } from 'react-native';
import Animated, { useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { useFocusEffect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOpenLog } from './map';

const SCREEN_W = Dimensions.get('window').width;
import { getAllVisits, Visit, ACTIVITY_TYPES, Price, PRICE_LABELS, formatRating, ratingColor, friendlyDate } from '@/lib/visits';
import { T } from '@/lib/theme';

const CATEGORY_BANNERS: Partial<Record<string, any>> = {
  food:          require('../../assets/images/category-food.jpg'),
  drinks:        require('../../assets/images/category-drinks.jpg'),
  outdoors:      require('../../assets/images/category-outdoors.avif'),
  view:          require('../../assets/images/category-view.jpg'),
  entertainment: require('../../assets/images/category-entertainment.jpg'),
  other:         require('../../assets/images/category-other.jpg'),
};

type Tab = 'picks' | 'all';
type SortOption = 'date' | 'best' | 'worst';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'date', label: 'Date Logged' },
  { value: 'best', label: 'Best to Worst' },
  { value: 'worst', label: 'Worst to Best' },
];



function sortVisits(visits: Visit[], sort: SortOption): Visit[] {
  const copy = [...visits];
  if (sort === 'date') return copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  if (sort === 'best') return copy.sort((a, b) => b.rank_order - a.rank_order);
  return copy.sort((a, b) => a.rank_order - b.rank_order);
}

function openLogFlow() {
  scheduleOpenLog();
  router.navigate('/(tabs)/map');
}

export default function HomeScreen() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [tab, setTab] = useState<Tab>('picks');
  const [sort, setSort] = useState<SortOption>('best');
  const slideX = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      setVisits(getAllVisits());
    }, [])
  );

  useEffect(() => {
    slideX.value = withTiming(tab === 'picks' ? 0 : -SCREEN_W, { duration: 260 });
  }, [tab]);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));

  const allSorted = sortVisits(visits, sort);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>DateSpot</Text>
        <Text style={styles.headerSub}>Your favorite places</Text>
      </View>

      {/* Segmented control */}
      <View style={styles.segControl}>
        <Pressable
          style={[styles.segBtn, tab === 'picks' && styles.segBtnActive]}
          onPress={() => setTab('picks')}
        >
          <Text style={[styles.segBtnText, tab === 'picks' && styles.segBtnTextActive]}>
            Favorites
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segBtn, tab === 'all' && styles.segBtnActive]}
          onPress={() => setTab('all')}
        >
          <Text style={[styles.segBtnText, tab === 'all' && styles.segBtnTextActive]}>
            All Spots
          </Text>
        </Pressable>
      </View>

      {/* Sort row — always rendered so content doesn't jump when switching tabs */}
      <View style={[styles.sortRow, tab !== 'all' && styles.sortRowHidden]}>
        {SORT_OPTIONS.map(opt => (
          <Pressable
            key={opt.value}
            style={[styles.sortChip, sort === opt.value && styles.sortChipActive]}
            onPress={() => setSort(opt.value)}
          >
            <Text style={[styles.sortChipText, sort === opt.value && styles.sortChipTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Sliding panels */}
      <View style={styles.slideContainer}>
        <Animated.View style={[styles.slidePanels, slideStyle]}>
          <View style={styles.slidePanel}>
            <PicksTab visits={visits} />
          </View>
          <View style={styles.slidePanel}>
            <AllTab visits={allSorted} />
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

function PicksTab({ visits }: { visits: Visit[] }) {
  if (visits.length === 0) {
    return (
      <View style={styles.emptyCenter}>
        <Text style={styles.emptyTitle}>No spots yet</Text>
        <Pressable style={styles.logCtaInline} onPress={openLogFlow}>
          <Text style={styles.logCtaText}>+ Log a new spot</Text>
        </Pressable>
        <Text style={styles.emptySubCta}>to get started!</Text>
      </View>
    );
  }

  const categories = ACTIVITY_TYPES
    .map(type => ({
      ...type,
      spots: visits
        .filter(v => v.activity_type === type.value)
        .sort((a, b) => b.rank_order - a.rank_order)
        .slice(0, 3),
    }))
    .filter(c => c.spots.length > 0);

  return (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
      {categories.map(cat => {
        const banner = CATEGORY_BANNERS[cat.value];
        return (
          <View key={cat.value} style={styles.categorySection}>
            {banner ? (
              <ImageBackground source={banner} style={styles.categoryBanner} imageStyle={styles.categoryBannerImg}>
                <View style={styles.categoryBannerOverlay}>
                  <Text style={styles.categoryBannerTitle}>{cat.label}</Text>
                  <Text style={styles.categoryBannerCount}>Top {cat.spots.length}</Text>
                </View>
              </ImageBackground>
            ) : (
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryTitle}>{cat.label}</Text>
              </View>
            )}
            {cat.spots.map(v => <SpotRow key={v.id} visit={v} />)}
          </View>
        );
      })}
    </ScrollView>
  );
}

function AllTab({ visits }: { visits: Visit[] }) {
  return (
    <>
      {visits.length === 0 ? (
        <View style={styles.emptyCenter}>
          <Text style={styles.emptyTitle}>No spots yet</Text>
          <Pressable style={styles.logCtaInline} onPress={openLogFlow}>
            <Text style={styles.logCtaText}>+ Log a new spot</Text>
          </Pressable>
          <Text style={styles.emptySubCta}>to get started!</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
          {visits.map(v => <SpotRow key={v.id} visit={v} />)}
        </ScrollView>
      )}
    </>
  );
}


function SpotRow({ visit }: { visit: Visit }) {
  const info = ACTIVITY_TYPES.find(a => a.value === visit.activity_type);
  const color = ratingColor(visit.rating);
  const dateStr = friendlyDate(visit.visited_at || visit.created_at);
  const preview = visit.notes?.trim().slice(0, 70) ?? null;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      onPress={() => router.push(`/spot/${visit.id}`)}
    >
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName} numberOfLines={1}>{visit.venue_name}</Text>
          <View style={[styles.ratingPill, { backgroundColor: color + '2E' }]}>
            <Text style={[styles.ratingPillText, { color }]}>{formatRating(visit.rating)}</Text>
          </View>
        </View>
        <Text style={styles.rowMeta}>
          {info?.label} · {PRICE_LABELS[visit.price as Price]} · {dateStr}
        </Text>
        {preview ? (
          <Text style={styles.rowPreview} numberOfLines={1}>{preview}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  scroll: { flex: 1 },
  listContent: { paddingBottom: 40 },

  slideContainer: { flex: 1, overflow: 'hidden' },
  slidePanels: { flexDirection: 'row', width: SCREEN_W * 2, flex: 1 },
  slidePanel: { width: SCREEN_W, flex: 1 },

  header: {
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14,
    alignItems: 'center', gap: 2,
  },
  headerTitle: {
    fontSize: 32, fontWeight: '700', color: T.primary,
    fontFamily: 'Georgia', letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 13, color: T.muted, fontWeight: '500', letterSpacing: 0.2,
  },

  segControl: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 14,
    backgroundColor: T.segBg, borderRadius: 10, padding: 3,
  },
  segBtn: {
    flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center',
  },
  segBtnActive: {
    backgroundColor: T.card,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 3, elevation: 2,
  },
  segBtnText: { fontSize: 13, fontWeight: '500', color: T.muted },
  segBtnTextActive: { color: T.primary, fontWeight: '600' },

  sortRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 12,
  },
  sortRowHidden: { opacity: 0 },
  sortChip: {
    flex: 1, paddingVertical: 6, borderRadius: 20, alignItems: 'center',
    backgroundColor: T.bg, borderWidth: 1, borderColor: T.border,
  },
  sortChipActive: { backgroundColor: T.primary, borderColor: T.primary },
  sortChipText: { fontSize: 12, fontWeight: '600', color: T.muted },
  sortChipTextActive: { color: '#fff' },

  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border,
  },
  rowEmoji: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: T.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: T.border, marginTop: 1,
  },
  rowEmojiText: { fontSize: 19 },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  rowName: { fontSize: 15, fontWeight: '600', color: T.primary, flex: 1, marginRight: 8 },
  rowMeta: { fontSize: 12, color: T.muted, marginBottom: 4 },
  rowPreview: { fontSize: 12, color: '#A0927E', fontStyle: 'italic', lineHeight: 16 },

  ratingPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  ratingPillText: { fontSize: 12, fontWeight: '800' },

  categorySection: { marginBottom: 28 },

  categoryBanner: { height: 90, marginBottom: 12 },
  categoryBannerImg: {},
  categoryBannerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 20, justifyContent: 'flex-end', paddingBottom: 12, gap: 1,
  },
  categoryBannerTitle: {
    fontSize: 26, fontWeight: '700', color: '#fff',
    fontFamily: 'Georgia', letterSpacing: -0.4,
  },
  categoryBannerCount: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '600' },

  categoryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, paddingHorizontal: 16 },
  categoryEmoji: { fontSize: 20 },
  categoryTitle: {
    fontSize: 16, fontWeight: '700', color: T.primary, fontFamily: 'Georgia',
  },

  logCta: {
    backgroundColor: 'transparent', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
    borderWidth: 1.5, borderColor: T.accent,
  },
  logCtaInline: {
    backgroundColor: 'transparent', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
    borderWidth: 1.5, borderColor: T.accent,
    alignSelf: 'stretch', marginTop: 24,
  },
  logCtaText: { color: T.accent, fontSize: 16, fontWeight: '700' },

  emptyCenter: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40,
  },
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, paddingTop: 60,
  },
  emptyEmoji: { fontSize: 44, marginBottom: 14 },
  emptyTitle: {
    fontSize: 20, fontWeight: '700', color: T.primary,
    fontFamily: 'Georgia', marginBottom: 8,
  },
  emptyBody: { fontSize: 15, color: T.muted, textAlign: 'center', lineHeight: 22 },
  emptySubCta: { fontSize: 15, color: T.muted, marginTop: 10 },
});
