import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Pressable,
  ActivityIndicator, Dimensions, TextInput, FlatList, Image,
} from 'react-native';
import { useFocusEffect, useNavigation, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getAllVisits, Visit, PRICE_LABELS, Price, formatRating, ratingColor, normalizeName } from '@/lib/visits';
import { getSeedSpotsRaw, getTopSpots, SeedSpot, TopSpot } from '@/lib/seeds';
import { getFriendActivity, FriendActivityItem } from '@/lib/friends';
import { getProfile } from '@/lib/profile';
import { HeaderActions } from '@/components/HeaderActions';
import { FriendActivityCard } from '@/components/FriendActivityCard';
import { T } from '@/lib/theme';
import { TabSlideWrapper } from '@/components/TabSlideWrapper';
import { tabNav } from '@/lib/tabTransition';
import { useShimmer, SkBox } from '@/components/SkeletonBox';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SEEDS_CACHE_KEY = 'datespot:seeds_cache_v1';

const SCREEN_W = Dimensions.get('window').width;
const CARD_W = SCREEN_W - 40;
const MONTHLY_GOAL = 6;

const SEED_VENUE_TYPES = [
  { value: 'food',          label: 'Food' },
  { value: 'bars',          label: 'Bars' },
  { value: 'cafes',         label: 'Cafes' },
  { value: 'outdoors',      label: 'Outdoors' },
  { value: 'indoors',       label: 'Indoors' },
  { value: 'view',          label: 'Scenic' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'shopping',      label: 'Shopping' },
  { value: 'other',         label: 'Other' },
];

const CATEGORY_LABELS: Record<string, string> = {
  // Venue types (seed spots)
  food: 'Food', bars: 'Bars', cafes: 'Cafes', outdoors: 'Outdoors',
  indoors: 'Indoors', view: 'Views', entertainment: 'Entertainment',
  shopping: 'Shopping', other: 'Other',
  // Occasion types (personal visits)
  romantic: 'Romantic', friend: 'Friend', solo: 'Solo',
};

const ACTIVITY_COLORS: Record<string, string> = {
  food: '#C4604A',
  bars: '#C49A4A',
  cafes: '#A07850',
  outdoors: '#6A8F6A',
  indoors: '#7A8CAA',
  view: '#6A8FA0',
  entertainment: '#8B7BB0',
  shopping: '#C47890',
  other: '#8B7255',
};

const CATEGORY_IMAGES: Record<string, any> = {
  food:          require('@/assets/images/category-food.jpg'),
  bars:          require('@/assets/images/category-drinks.jpg'),
  cafes:         require('@/assets/images/category-cafes.jpg'),
  outdoors:      require('@/assets/images/category-outdoors.jpg'),
  indoors:       require('@/assets/images/category-indoors.avif'),
  view:          require('@/assets/images/category-view.jpg'),
  entertainment: require('@/assets/images/category-entertainment.jpg'),
  shopping:      require('@/assets/images/category-shopping.avif'),
  other:         require('@/assets/images/category-other.jpg'),
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
  return new Date().toLocaleString('default', { month: 'long' }).toUpperCase();
}

export default function HomeScreen() {
  const [seeds, setSeeds] = useState<SeedSpot[]>([]);
  const [topSpots, setTopSpots] = useState<TopSpot[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [activity, setActivity] = useState<FriendActivityItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(5);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const categoryScrollRef = useRef<ScrollView>(null);

  // Refresh data whenever the home screen gains focus (back nav or tab press).
  useFocusEffect(
    useCallback(() => {
      setVisits(getAllVisits().filter(v => !(v as any).is_seed));
      getFriendActivity().then(setActivity);
      getProfile().then(p => setCity(p.city || ''));
    }, [])
  );

  // Reset the page to the top and the category carousel to the start (Food)
  // only when the user leaves Home for another tab (Ranked / Map / Profile).
  // Tab presses set tabNav.curIndex synchronously (see (tabs)/_layout.tsx), so a
  // non-zero curIndex at blur means a real tab switch. Pushing a child route
  // like a spot detail or the full spots list goes through router.push with no
  // tabPress, so curIndex stays 0 and the scroll position is preserved on back.
  const navigation = useNavigation();
  useEffect(() => {
    const unsub = navigation.addListener('blur', () => {
      if (tabNav.curIndex !== 0) {
        categoryScrollRef.current?.scrollTo({ x: 0, animated: false });
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      }
    });
    return unsub;
  }, [navigation]);

  useEffect(() => {
    let cancelled = false;
    // Stale-while-revalidate: show cached seeds immediately, refresh in background
    AsyncStorage.getItem(SEEDS_CACHE_KEY).then(cached => {
      if (cancelled) return;
      if (cached) {
        setSeeds(JSON.parse(cached));
        setLoading(false);
      }
      getSeedSpotsRaw().then(raw => {
        if (cancelled) return;
        setSeeds(raw);
        setLoading(false);
        AsyncStorage.setItem(SEEDS_CACHE_KEY, JSON.stringify(raw));
      });
    });
    return () => { cancelled = true; };
  }, []);

  // Load user-contributed top spots once city is known; falls back to seeds when below threshold
  useEffect(() => {
    if (!city) return;
    getTopSpots(city).then(setTopSpots);
  }, [city]);

  const myVisitedNames = new Set(visits.map(v => v.venue_name.toLowerCase().trim()));

  // Build category cards from user-contributed top spots (when above threshold) or seeds
  const discoverySpots: SeedSpot[] = topSpots.length > 0
    ? topSpots.map(ts => ({
        id: ts.canonical_place_id,
        user_id: '',
        venue_name: ts.canonical_name,
        lat: ts.canonical_lat,
        lng: ts.canonical_lng,
        address: null,
        activity_type: ts.activity_type ?? 'other',
        price: 2 as const,
        rating: ts.visit_count,  // rank by visit_count when user-contributed
        rank_order: ts.visit_count,
        notes: null,
        triage: 'great',
        is_seed: false,
        visited_at: ts.last_visited_at,
        created_at: ts.last_visited_at,
      }))
    : seeds;

  const categoryCards = SEED_VENUE_TYPES.map(a => {
    const spots = discoverySpots
      .filter(s => s.activity_type === a.value)
      .sort((x, y) => y.rating - x.rating)
      .slice(0, 5);
    return { category: a, spots };
  }).filter(({ spots }) => spots.length > 0);

  // Search results — prefer user-contributed spots, fall back to seeds
  const searchPool = topSpots.length > 0 ? discoverySpots : seeds;
  const searchResults = search.trim()
    ? searchPool.filter(s => {
        const q = search.trim().toLowerCase();
        return (
          s.venue_name.toLowerCase().includes(q) ||
          (s.notes?.toLowerCase().includes(q) ?? false)
        );
      }).sort((a, b) => b.rating - a.rating)
    : [];

  const isSearching = search.trim().length > 0;

  return (
    <TabSlideWrapper myIndex={0}>
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>DateSpot</Text>
          {city ? (
            <View style={s.cityRow}>
              <Ionicons name="locate-outline" size={11} color={T.muted} />
              <Text style={s.city}>{city.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
        <HeaderActions />
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        scrollEventThrottle={100}
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
          if (distanceFromBottom < 400) {
            setVisibleCount(c => (c < activity.length ? Math.min(c + 5, activity.length) : c));
          }
        }}
      >

        {/* Search bar */}
        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={16} color={T.muted} style={s.searchIcon} />
          <TextInput
            style={s.searchInput}
            placeholder="Search spots, neighborhoods..."
            placeholderTextColor={T.muted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

        {/* Top date spots header */}
        <View style={s.sectionHeaderRow}>
          <View>
            <Text style={s.sectionTitle}>Top date spots</Text>
            <Text style={s.sectionSubtitle}>Your next date spot is waiting</Text>
          </View>
        </View>

        {/* Search results OR category cards */}
        {loading ? (
          <HomeCategorySkeleton />
        ) : isSearching ? (
          <View style={s.searchResultsList}>
            {searchResults.length === 0 ? (
              <View style={s.emptyWrap}>
                <Text style={s.emptyText}>No spots match</Text>
                <Pressable onPress={() => setSearch('')}>
                  <Text style={s.emptyLink}>Clear search</Text>
                </Pressable>
              </View>
            ) : (
              searchResults.map(spot => (
                <SearchResultRow key={spot.id} spot={spot} />
              ))
            )}
          </View>
        ) : (
          <ScrollView
            ref={categoryScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_W + 12}
            decelerationRate="fast"
            contentContainerStyle={s.cardsScroll}
          >
            {categoryCards.map(({ category, spots }) => (
              <CategoryCard
                key={category.value}
                category={category}
                spots={spots}
                cardW={CARD_W}
              />
            ))}
          </ScrollView>
        )}

        {/* Friends activity feed — hidden while searching so results own the screen.
            Loads 5 at first, then reveals more as the user scrolls toward the bottom. */}
        {!isSearching && (
          <View style={s.feedSection}>
            <View style={s.feedHeader}>
              <Text style={s.feedTitle}>Friends and Following</Text>
            </View>
            {activity.length === 0 ? (
              <View style={s.feedEmpty}>
                <Text style={s.feedEmptyText}>When friends log dates, you'll see them here.</Text>
              </View>
            ) : (
              <View style={s.feedList}>
                {activity.slice(0, visibleCount).map((item, i, arr) => (
                  <FriendActivityCard
                    key={item.visitId}
                    item={item}
                    isLast={i === arr.length - 1}
                    alreadyVisited={myVisitedNames.has(item.venueName.toLowerCase().trim())}
                    linkToDetail
                  />
                ))}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
    </TabSlideWrapper>
  );
}

function HomeCategorySkeleton() {
  const { shimmer, screenW } = useShimmer();
  const sk = (w: number | `${number}%`, h: number, r?: number, style?: object) => (
    <SkBox shimmer={shimmer} w={w} h={h} r={r ?? 4} style={style} screenW={screenW} />
  );
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEnabled={false}
      contentContainerStyle={{ paddingLeft: 16, paddingRight: 16, gap: 12, paddingTop: 4, paddingBottom: 8 }}
    >
      {[0, 1].map(ci => (
        <View key={ci} style={{ width: CARD_W, borderRadius: 16, overflow: 'hidden', backgroundColor: T.card, borderWidth: 1, borderColor: T.border }}>
          {sk(CARD_W, 130, 0)}
          {[0, 1, 2].map(i => (
            <View key={i}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 }}>
                {sk(24, 13, 3)}
                <View style={{ flex: 1, marginLeft: 8, marginRight: 10 }}>
                  {sk('65%', 14, 3)}
                  {sk('25%', 12, 3, { marginTop: 1 })}
                </View>
                {sk(42, 24, 10)}
              </View>
              {i < 2 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginLeft: 46 }} />}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function CategoryCard({ category, spots, cardW }: {
  category: { value: string; label: string };
  spots: SeedSpot[];
  cardW: number;
}) {
  const bgColor = ACTIVITY_COLORS[category.value] ?? ACTIVITY_COLORS.other;
  const heroImage = CATEGORY_IMAGES[category.value];
  return (
    <View style={[s.categoryCard, { width: cardW }]}>
      {/* Hero — tappable to open all spots filtered to this category */}
      <Pressable
        style={({ pressed }) => [s.categoryHero, { backgroundColor: bgColor }, pressed && { opacity: 0.85 }]}
        onPress={() => router.push({ pathname: '/spots', params: { category: category.value } } as any)}
        accessibilityRole="button"
        accessibilityLabel={`Browse all ${category.label} spots`}
      >
        {heroImage && (
          <Image source={heroImage} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, top: 0, width: '100%', height: '100%', resizeMode: 'cover' }} />
        )}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
        <View style={s.categoryHeroInner}>
          <View style={s.categoryHeroContent}>
            <Text style={s.categoryHeroName}>{category.label}</Text>
            <Text style={s.categoryHeroSub}>Top {spots.length} in your area</Text>
          </View>
        </View>
      </Pressable>
      {/* Spot rows */}
      {spots.map((spot, idx) => {
        const color = ratingColor(spot.rating);
        const priceLabel = PRICE_LABELS[spot.price as Price] ?? '';
        return (
          <View key={spot.id}>
            <Pressable
              style={({ pressed }) => [s.spotRow, pressed && { opacity: 0.7 }]}
              onPress={() => router.push(`/spot/${spot.id}` as any)}
            >
              <Text style={s.spotRank}>{idx + 1}</Text>
              <View style={s.spotInfo}>
                <Text style={s.spotName}>{normalizeName(spot.venue_name)}</Text>
                {priceLabel ? <Text style={s.spotPrice}>{priceLabel}</Text> : null}
              </View>
              <View style={[s.ratingPill, { borderColor: color }]}>
                <Text style={[s.ratingPillText, { color }]}>{formatRating(spot.rating)}</Text>
              </View>
            </Pressable>
            {idx < spots.length - 1 && <View style={s.rowDivider} />}
          </View>
        );
      })}
    </View>
  );
}

function SearchResultRow({ spot }: { spot: SeedSpot }) {
  const color = ratingColor(spot.rating);
  const priceLabel = PRICE_LABELS[spot.price as Price] ?? '';
  const catLabel = CATEGORY_LABELS[spot.activity_type] ?? spot.activity_type;
  // Mirror the Recent dates row: left color accent, name, category · price meta,
  // full-width with a score badge on the right.
  return (
    <Pressable
      style={({ pressed }) => [s.recentRow, pressed && { opacity: 0.7 }]}
      onPress={() => router.push(`/spot/${spot.id}` as any)}
    >
      <View style={[s.recentAccent, { backgroundColor: color }]} />
      <View style={s.recentRowLeft}>
        <Text style={s.recentName}>{normalizeName(spot.venue_name)}</Text>
        <Text style={s.recentMeta}>{[catLabel, priceLabel].filter(Boolean).join(' · ')}</Text>
      </View>
      {spot.rating > 0 && (
        <View style={[s.recentScore, { borderColor: color }]}>
          <Text style={[s.recentScoreText, { color }]}>{formatRating(spot.rating)}</Text>
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: T.bg,
  },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  city: {
    fontSize: 11,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 32,
    color: T.primary,
    fontFamily: 'Fraunces-Regular',
    lineHeight: 36,
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.inputBg,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: T.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: T.primary,
    padding: 0,
  },

  goalCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: T.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
  },
  goalCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 1.2,
  },
  goalCount: {
    fontSize: 12,
    fontWeight: '600',
    color: T.primary,
  },
  goalPills: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  goalPill: {
    flex: 1,
    height: 8,
    borderRadius: 4,
  },
  goalPillFilled: { backgroundColor: '#E76F51' },
  goalPillEmpty: { backgroundColor: '#EDE8E0' },
  goalFooter: {
    fontSize: 12,
    color: T.muted,
    lineHeight: 17,
  },
  unlockScroll: {
    paddingTop: 4,
    paddingBottom: 2,
    gap: 8,
    paddingRight: 4,
  },
  unlockChip: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F1ED',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    width: 112,
  },
  unlockChipUnlocked: {
    backgroundColor: '#FEF0EB',
    borderWidth: 1,
    borderColor: '#F3CABF',
  },
  unlockChipCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C4B9AD',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  unlockChipCountUnlocked: {
    color: '#E76F51',
  },
  unlockChipLabel: {
    fontSize: 12,
    color: '#C4B9AD',
    textAlign: 'center',
    lineHeight: 15,
  },
  unlockChipLabelUnlocked: {
    color: T.primary,
    fontWeight: '500',
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E76F51',
    borderRadius: 11,
    paddingVertical: 13,
    marginTop: 14,
  },
  inviteButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '400',
    color: T.primary,
    fontFamily: 'Fraunces-Regular',
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: T.muted,
  },

  cardsScroll: {
    paddingLeft: 16,
    paddingRight: 16,
    gap: 12,
    paddingBottom: 8,
    paddingTop: 4,
  },

  // Category card
  categoryCard: {
    borderRadius: 16, overflow: 'hidden', backgroundColor: T.card,
    borderWidth: 1, borderColor: T.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10, shadowRadius: 10,
  },
  categoryHero: {
    height: 130, justifyContent: 'flex-end', overflow: 'hidden',
  },
  categoryHeroInner: {
    flex: 1, padding: 16, justifyContent: 'flex-end',
  },
  categoryHeroContent: {},
  categoryHeroName: {
    fontSize: 21, fontWeight: '400', color: '#fff', fontFamily: 'Fraunces-Regular', marginBottom: 2,
  },
  categoryHeroSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },

  // Spot row inside category card
  spotRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11 },
  spotRank: { width: 24, fontSize: 13, fontWeight: '300', color: T.muted, marginRight: 8 },
  spotInfo: { flex: 1, marginRight: 10 },
  spotName: { fontSize: 14, fontWeight: '300', color: T.primary },
  spotPrice: { fontSize: 12, color: T.muted, marginTop: 1 },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginLeft: 46 },

  // Rating pill
  ratingPill: {
    borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3,
    backgroundColor: 'transparent', minWidth: 42, alignItems: 'center',
  },
  ratingPillText: { fontSize: 12, fontWeight: '800', textAlign: 'center' },

  // Search results
  searchResultsList: {
    paddingTop: 4,
  },

  loadingWrap: { paddingVertical: 60, alignItems: 'center' },
  emptyWrap: { paddingVertical: 40, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 16, color: T.muted },
  emptyLink: { fontSize: 14, color: T.accent, fontWeight: '600' },

  stacksSection: {
    marginTop: 20,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
  },
  stacksSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
    marginTop: 12,
  },
  stacksSectionTitle: {
    fontSize: 17,
    fontWeight: '400',
    color: T.primary,
    fontFamily: 'Fraunces-Regular',
  },
  stacksScroll: {
    paddingLeft: 16,
    paddingRight: 16,
    gap: 10,
    paddingBottom: 8,
  },
  emptyStacks: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyStacksText: {
    fontSize: 14,
    color: T.muted,
  },
  stackCard: {
    width: 180,
    backgroundColor: T.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: T.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  stackCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  stackCardName: { fontSize: 14, fontWeight: '400', color: T.primary, fontFamily: 'Fraunces-Regular', flex: 1, marginRight: 6 },
  stackSpotBadge: { backgroundColor: T.inputBg, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  stackSpotBadgeText: { fontSize: 11, fontWeight: '700', color: T.muted },
  stackCardDate: { fontSize: 11, color: T.muted, marginBottom: 4 },
  stackJourney: { fontSize: 11, color: T.muted, fontStyle: 'italic', marginBottom: 8 },
  stackQuality: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  stackQualityText: { fontSize: 12, fontWeight: '800' },

  // Friends activity feed
  feedSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
  },
  feedHeader: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  feedTitle: {
    fontSize: 20,
    fontWeight: '400',
    color: T.primary,
    fontFamily: 'Fraunces-Regular',
  },
  feedList: { paddingHorizontal: 20 },
  feedEmpty: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  feedEmptyText: {
    fontSize: 14,
    color: T.muted,
    textAlign: 'center',
  },

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
    marginBottom: 8,
  },
  recentTitle: {
    fontSize: 17,
    fontWeight: '400',
    color: T.primary,
    fontFamily: 'Fraunces-Regular',
  },
  emptyDates: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyDatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  emptyDatesText: {
    fontSize: 14,
    color: T.muted,
  },
  plusCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E76F51',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusCircleText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 14,
    includeFontPadding: false,
  },

  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  recentAccent: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    marginRight: 12,
    minHeight: 36,
  },
  recentRowLeft: { flex: 1, marginRight: 12 },
  recentName: { fontSize: 15, fontWeight: '600', color: T.primary, marginBottom: 3 },
  recentMeta: { fontSize: 12, color: T.muted },
  recentScore: {
    borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3,
    backgroundColor: 'transparent', minWidth: 42, alignItems: 'center',
  },
  recentScoreText: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
});
