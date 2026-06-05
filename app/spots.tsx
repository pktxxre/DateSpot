import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Pressable,
  FlatList, useWindowDimensions, Modal, Animated,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from 'react-native-reanimated';
import { getSeedSpotsRaw, SeedSpot } from '@/lib/seeds';
import { PRICE_LABELS, getAllVisits, ratingColor, normalizeName, Price } from '@/lib/visits';
import { getAllFutureSpots } from '@/lib/future';
import { getProfile } from '@/lib/profile';
import { getFriendsByVenue, VenueFriend } from '@/lib/friends';
import { ensureLocation } from '@/lib/location';
import { T } from '@/lib/theme';

const LIMIT_OPTIONS = [50, 100, 150, 200] as const;
type Limit = typeof LIMIT_OPTIONS[number];

const SERIF = 'Fraunces-Regular';
const SAVE_BLUE = '#5856d6';

// Friend-avatar palette (cycled by a stable hash of the friend's name).
const AVATAR_PALETTE = ['#F2C18B', '#B5D5C5', '#E8B4D8', '#C9B6E4', '#F4C2A1'];
function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8; // miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const SK_BASE = '#EAE4D9';
const SK_LIGHT = '#F8F4EC';

function SkBox({ shimmer, w, h, r = 4, style, screenW }: {
  shimmer: ReturnType<typeof useAnimatedStyle>;
  w: number | `${number}%`; h: number; r?: number; style?: object; screenW: number;
}) {
  return (
    <View style={[{ width: w, height: h, backgroundColor: SK_BASE, overflow: 'hidden', borderRadius: r }, style]}>
      <Reanimated.View style={[
        { position: 'absolute', top: 0, left: 0, bottom: 0, width: screenW * 0.6, backgroundColor: SK_LIGHT, opacity: 0.95 },
        shimmer,
      ]} />
    </View>
  );
}

function SpotsSkeleton() {
  const { width: screenW } = useWindowDimensions();
  const offset = useSharedValue(-screenW * 0.65);

  useEffect(() => {
    offset.value = withRepeat(withTiming(screenW, { duration: 1800, easing: Easing.linear }), -1, false);
  }, [screenW]);

  const shimmer = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const sk = (w: number | `${number}%`, h: number, r?: number, style?: object) => (
    <SkBox shimmer={shimmer} w={w} h={h} r={r} style={style} screenW={screenW} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 4 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <View key={i}>
            {i > 0 && <View style={{ height: 1, backgroundColor: T.border }} />}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 15 }}>
              {sk(26, 17, 3)}
              <View style={{ flex: 1, gap: 6 }}>
                {sk('70%', 15, 3)}
                {sk('48%', 12, 3)}
              </View>
              {sk(46, 24, 12)}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

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
  food: 'Food', bars: 'Bars', cafes: 'Cafes', outdoors: 'Outdoors',
  indoors: 'Indoors', view: 'Views', entertainment: 'Entertainment',
  shopping: 'Shopping', other: 'Other',
};

const PRICE_FILTER_OPTIONS = [
  { value: 1, label: '$' },
  { value: 2, label: '$$' },
  { value: 3, label: '$$$' },
  { value: 0, label: 'Free' },
];

// ─── Friend stack ───────────────────────────────────────────────────────────

function FriendStack({ friends }: { friends: VenueFriend[] }) {
  const shown = friends.slice(0, 3);
  const label =
    friends.length === 1 ? `${friends[0].name} loved this`
    : friends.length === 2 ? `${friends[0].name} & ${friends[1].name} loved this`
    : `${friends[0].name} + ${friends.length - 1} loved this`;

  return (
    <View style={s.friendStack}>
      <View style={{ flexDirection: 'row' }}>
        {shown.map((f, i) => (
          <View
            key={f.id}
            style={[s.avatar, { backgroundColor: avatarColor(f.name), marginLeft: i === 0 ? 0 : -6.48, zIndex: 3 - i }]}
          >
            <Text style={s.avatarText}>{(f.name[0] ?? '?').toUpperCase()}</Text>
          </View>
        ))}
      </View>
      <Text style={s.friendLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ─── State tag ──────────────────────────────────────────────────────────────

function StateTag({ state }: { state: 'been' | 'want' }) {
  if (state === 'been') {
    return (
      <View style={[s.stateTag, { backgroundColor: '#E7F2EA' }]}>
        <Ionicons name="checkmark" size={11} color="#1F8A4C" />
        <Text style={[s.stateTagText, { color: '#1F8A4C' }]}>Been</Text>
      </View>
    );
  }
  return (
    <View style={[s.stateTag, { backgroundColor: `${SAVE_BLUE}14` }]}>
      <Ionicons name="bookmark" size={10} color={SAVE_BLUE} />
      <Text style={[s.stateTagText, { color: SAVE_BLUE }]}>Want to go</Text>
    </View>
  );
}

// ─── Distance chips ────────────────────────────────────────────────────────────

const DISTANCE_OPTIONS = [1, 2, 5, 10, 25] as const;
type Distance = typeof DISTANCE_OPTIONS[number];

function DistanceChips({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {DISTANCE_OPTIONS.map(d => {
        const sel = value === d;
        return (
          <Pressable
            key={d}
            style={[fs.chip, sel && fs.chipActive]}
            onPress={() => onChange(sel ? null : d)}
          >
            <Text style={[fs.chipText, sel && fs.chipTextActive]}>
              {d === 1 ? '< 1 mi' : `< ${d} mi`}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SpotsScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const [seeds, setSeeds] = useState<SeedSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilters, setCategoryFilters] = useState<string[]>(params.category ? [params.category] : []);
  const [priceFilters, setPriceFilters] = useState<number[]>([]);
  const [distanceFilter, setDistanceFilter] = useState<number | null>(null);
  const [limit, setLimit] = useState<Limit>(50);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showLimitSheet, setShowLimitSheet] = useState(false);
  const [city, setCity] = useState('');
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [visitedNames, setVisitedNames] = useState<Set<string>>(new Set());
  const [wantNames, setWantNames] = useState<Set<string>>(new Set());
  const [friendsByVenue, setFriendsByVenue] = useState<Map<string, VenueFriend[]>>(new Map());
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    getSeedSpotsRaw().then(data => { setSeeds(data); setLoading(false); });
    getProfile().then(p => {
      setCity(p.city || '');
      // City center is the fallback origin until/unless we get the real device location.
      if (p.cityLat != null && p.cityLng != null) setOrigin({ lat: p.cityLat, lng: p.cityLng });
    });
    // Prefer the real device location for distances (prompts for permission if needed).
    ensureLocation(true).then(loc => { if (loc) setOrigin(loc); });
    setVisitedNames(new Set(getAllVisits().map(v => v.venue_name.toLowerCase().trim())));
    setWantNames(new Set(getAllFutureSpots().map(f => f.venue_name.toLowerCase().trim())));
    getFriendsByVenue().then(setFriendsByVenue);
  }, []);

  const filtered = seeds
    .filter(sp => {
      if (categoryFilters.length > 0 && !categoryFilters.includes(sp.activity_type)) return false;
      if (priceFilters.length > 0 && !priceFilters.includes(sp.price)) return false;
      if (distanceFilter != null && origin && distanceMiles(origin.lat, origin.lng, sp.lat, sp.lng) > distanceFilter) return false;
      return true;
    })
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);

  const activeFilterCount = categoryFilters.length + priceFilters.length + (distanceFilter != null ? 1 : 0);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={s.safe} edges={['top']}>

        {/* Header block */}
        <View style={s.header}>
          <Pressable
            style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.6 }]}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={T.primary} />
          </Pressable>
          <Text style={s.eyebrow}>TOP {limit}{city ? ` · ${city.toUpperCase()}` : ''}</Text>
          <Text style={s.title}>All date spots</Text>
        </View>

        {/* Control bar — matches Ranked tab */}
        <View style={s.filterStrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterStripInner}>
            <View style={[s.filterBtn, activeFilterCount > 0 && s.filterBtnActive]}>
              <Pressable style={s.filterBtnMain} onPress={() => setShowFilterSheet(true)}>
                <Ionicons name="options-outline" size={14} color={activeFilterCount > 0 ? T.accent : T.primary} />
                <Text style={[s.filterBtnText, activeFilterCount > 0 && s.filterBtnTextActive]}>Filter</Text>
              </Pressable>
              {activeFilterCount > 0 && (
                <>
                  <View style={s.filterBtnDivider} />
                  <Pressable
                    style={s.filterClearBtn}
                    onPress={() => { setCategoryFilters([]); setPriceFilters([]); setDistanceFilter(null); }}
                    hitSlop={6}
                  >
                    <Ionicons name="close" size={14} color={T.accent} />
                  </Pressable>
                </>
              )}
            </View>
            {categoryFilters.map(cf => (
              <Pressable key={cf} style={s.activeChip} onPress={() => setCategoryFilters(prev => prev.filter(x => x !== cf))}>
                <Text style={s.activeChipText}>{CATEGORY_LABELS[cf] ?? cf}</Text>
                <Ionicons name="close" size={12} color={T.accent} />
              </Pressable>
            ))}
            {priceFilters.map(pf => (
              <Pressable key={pf} style={s.activeChip} onPress={() => setPriceFilters(prev => prev.filter(x => x !== pf))}>
                <Text style={s.activeChipText}>{PRICE_FILTER_OPTIONS.find(p => p.value === pf)?.label ?? ''}</Text>
                <Ionicons name="close" size={12} color={T.accent} />
              </Pressable>
            ))}
            {distanceFilter != null && (
              <Pressable style={s.activeChip} onPress={() => setDistanceFilter(null)}>
                <Text style={s.activeChipText}>Within {distanceFilter} mi</Text>
                <Ionicons name="close" size={12} color={T.accent} />
              </Pressable>
            )}
          </ScrollView>
          <Pressable onPress={() => setShowLimitSheet(true)} hitSlop={8} style={s.sortBtn}>
            <Text style={s.sortLabel}>Top {limit}</Text>
            <Ionicons name="chevron-down" size={12} color={T.muted} />
          </Pressable>
        </View>

        {/* List */}
        {loading ? (
          <SpotsSkeleton />
        ) : filtered.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyText}>No spots match</Text>
            <Pressable onPress={() => { setCategoryFilters([]); setPriceFilters([]); setDistanceFilter(null); }}>
              <Text style={s.emptyLink}>Clear filters</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={filtered}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.listContent}
            ItemSeparatorComponent={() => <View style={s.separator} />}
            renderItem={({ item, index }) => {
              const c = ratingColor(item.rating);
              const priceLabel = PRICE_LABELS[item.price as Price] ?? '';
              const key = item.venue_name.toLowerCase().trim();
              const dist = origin ? distanceMiles(origin.lat, origin.lng, item.lat, item.lng) : null;
              const metaParts = [
                dist != null ? `${dist.toFixed(1)} mi` : null,
                priceLabel,
              ].filter(Boolean);
              const friends = friendsByVenue.get(key) ?? [];
              const state: 'been' | 'want' | null =
                visitedNames.has(key) ? 'been' : wantNames.has(key) ? 'want' : null;
              const showSocial = friends.length > 0 || state != null;

              return (
                <Pressable
                  style={({ pressed }) => [s.spotRow, pressed && { backgroundColor: 'rgba(75,54,33,0.03)' }]}
                  onPress={() => router.push(`/spot/${item.id}` as any)}
                >
                  <Text style={s.rank}>{index + 1}</Text>
                  <View style={s.middle}>
                    <Text style={s.spotName} numberOfLines={1} ellipsizeMode="tail">{normalizeName(item.venue_name)}</Text>
                    {metaParts.length > 0 && (
                      <Text style={s.spotMeta} numberOfLines={1}>{metaParts.join(' · ')}</Text>
                    )}
                    {item.address ? (
                      <Text style={s.spotMeta} numberOfLines={1}>{item.address}</Text>
                    ) : null}
                    {showSocial && (
                      <View style={s.socialRow}>
                        {friends.length > 0 && <FriendStack friends={friends} />}
                        {state && <StateTag state={state} />}
                      </View>
                    )}
                  </View>
                  <View style={[s.scorePill, { borderColor: c }]}>
                    <Text style={[s.scorePillText, { color: c }]}>{item.rating.toFixed(1)}</Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )}

        <FilterSheet
          visible={showFilterSheet}
          currentCategory={categoryFilters}
          currentPrice={priceFilters}
          currentLimit={limit}
          currentDistance={distanceFilter}
          onApply={(category, price, newLimit, distance) => {
            setCategoryFilters(category);
            setPriceFilters(price);
            setLimit(newLimit);
            setDistanceFilter(distance);
            listRef.current?.scrollToOffset({ offset: 0, animated: false });
          }}
          onClose={() => setShowFilterSheet(false)}
        />

        <LimitSheet
          visible={showLimitSheet}
          selected={limit}
          onSelect={l => { setLimit(l); listRef.current?.scrollToOffset({ offset: 0, animated: false }); }}
          onClose={() => setShowLimitSheet(false)}
        />
      </SafeAreaView>
    </>
  );
}

// ─── Limit Sheet ──────────────────────────────────────────────────────────────

function LimitSheet({ visible, selected, onSelect, onClose }: {
  visible: boolean;
  selected: Limit;
  onSelect: (l: Limit) => void;
  onClose: () => void;
}) {
  const sheetY = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260 }).start();
    } else {
      Animated.timing(sheetY, { toValue: 300, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <View style={ls.container}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[ls.sheet, { transform: [{ translateY: sheetY }] }]}>
          <View style={ls.handle} />
          <Text style={ls.title}>Show top</Text>
          {LIMIT_OPTIONS.map(opt => {
            const sel = selected === opt;
            return (
              <Pressable
                key={opt}
                style={[ls.option, sel && ls.optionActive]}
                onPress={() => { onSelect(opt); onClose(); }}
              >
                <Text style={[ls.optionText, sel && ls.optionTextActive]}>Top {opt}</Text>
                {sel && <Ionicons name="checkmark" size={18} color={T.accent} />}
              </Pressable>
            );
          })}
          <View style={{ height: 32 }} />
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Filter Sheet ─────────────────────────────────────────────────────────────

function FilterSheet({ visible, currentCategory, currentPrice, currentLimit, currentDistance, onApply, onClose }: {
  visible: boolean;
  currentCategory: string[];
  currentPrice: number[];
  currentLimit: Limit;
  currentDistance: number | null;
  onApply: (category: string[], price: number[], limit: Limit, distance: number | null) => void;
  onClose: () => void;
}) {
  const [draftCategory, setDraftCategory] = useState<string[]>(currentCategory);
  const [draftPrice, setDraftPrice] = useState<number[]>(currentPrice);
  const [draftLimit, setDraftLimit] = useState<Limit>(currentLimit);
  const [draftDistance, setDraftDistance] = useState<number | null>(currentDistance);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['category']));

  useEffect(() => {
    if (visible) {
      setDraftCategory(currentCategory);
      setDraftPrice(currentPrice);
      setDraftLimit(currentLimit);
      setDraftDistance(currentDistance);
    }
  }, [visible]);

  function toggleArr<U>(arr: U[], val: U): U[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  }

  function toggleSection(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={fs.root} edges={['top', 'bottom']}>
        <View style={fs.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={T.primary} />
          </Pressable>
          <Text style={fs.title}>Filter</Text>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView style={fs.scroll} contentContainerStyle={fs.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={fs.sectionTitle}>Show</Text>
          <View style={fs.chipGrid}>
            {LIMIT_OPTIONS.map(opt => {
              const sel = draftLimit === opt;
              return (
                <Pressable key={opt} style={[fs.chip, sel && fs.chipActive]} onPress={() => setDraftLimit(opt)}>
                  <Text style={[fs.chipText, sel && fs.chipTextActive]}>Top {opt}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={fs.divider} />

          <Pressable style={fs.accordionHeader} onPress={() => toggleSection('category')}>
            <Ionicons name="restaurant-outline" size={18} color={T.primary} />
            <Text style={fs.accordionLabel}>Category</Text>
            <View style={[fs.activeBadge, draftCategory.length === 0 && { opacity: 0 }]}>
              <Text style={fs.activeBadgeText}>{draftCategory.length}</Text>
            </View>
            <Ionicons name={expanded.has('category') ? 'chevron-up' : 'chevron-down'} size={16} color={T.muted} />
          </Pressable>
          {expanded.has('category') && (
            <View style={fs.chipGrid}>
              {SEED_VENUE_TYPES.map(a => {
                const sel = draftCategory.includes(a.value);
                return (
                  <Pressable key={a.value} style={[fs.chip, sel && fs.chipActive]} onPress={() => setDraftCategory(toggleArr(draftCategory, a.value))}>
                    <Text style={[fs.chipText, sel && fs.chipTextActive]}>{a.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={fs.divider} />

          <Pressable style={fs.accordionHeader} onPress={() => toggleSection('price')}>
            <Ionicons name="cash-outline" size={18} color={T.primary} />
            <Text style={fs.accordionLabel}>Price</Text>
            <View style={[fs.activeBadge, draftPrice.length === 0 && { opacity: 0 }]}>
              <Text style={fs.activeBadgeText}>{draftPrice.length}</Text>
            </View>
            <Ionicons name={expanded.has('price') ? 'chevron-up' : 'chevron-down'} size={16} color={T.muted} />
          </Pressable>
          {expanded.has('price') && (
            <View style={fs.chipGrid}>
              {PRICE_FILTER_OPTIONS.map(p => {
                const sel = draftPrice.includes(p.value);
                return (
                  <Pressable key={p.value} style={[fs.chip, sel && fs.chipActive]} onPress={() => setDraftPrice(toggleArr(draftPrice, p.value))}>
                    <Text style={[fs.chipText, sel && fs.chipTextActive]}>{p.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={fs.divider} />

          {/* Distance */}
          <View style={fs.distanceHeader}>
            <Text style={fs.accordionLabel}>Distance</Text>
            {draftDistance != null && (
              <Pressable onPress={() => setDraftDistance(null)} hitSlop={6} style={fs.distanceClear}>
                <Text style={fs.distanceValue}>Within {draftDistance} mi</Text>
                <Ionicons name="close" size={14} color={T.accent} />
              </Pressable>
            )}
          </View>
          <View style={fs.distanceSliderWrap}>
            <DistanceChips value={draftDistance} onChange={setDraftDistance} />
          </View>
        </ScrollView>

        <View style={fs.footer}>
          <Pressable onPress={() => { setDraftCategory([]); setDraftPrice([]); setDraftLimit(50); setDraftDistance(null); }}>
            <Text style={fs.clearAll}>Clear all</Text>
          </Pressable>
          <Pressable style={fs.applyBtn} onPress={() => { onApply(draftCategory, draftPrice, draftLimit, draftDistance); onClose(); }}>
            <Text style={fs.applyBtnText}>Apply</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },

  // Header block
  header: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 16 },
  backBtn: { width: 34, height: 34, marginLeft: -6, marginBottom: 8, alignItems: 'flex-start', justifyContent: 'center' },
  eyebrow: { fontSize: 12, fontWeight: '700', color: T.muted, letterSpacing: 1.4 },
  title: { fontFamily: SERIF, fontSize: 34, color: T.primary, letterSpacing: -0.8, lineHeight: 36, marginTop: 3 },

  // Control bar — matches Ranked tab (line above + below)
  filterStrip: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border,
  },
  filterStripInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, gap: 8, flexGrow: 1 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, borderWidth: 1, borderColor: T.border, backgroundColor: T.bg, overflow: 'hidden' },
  filterBtnActive: { borderColor: T.accent, backgroundColor: T.accentTint },
  filterBtnMain: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6 },
  filterBtnDivider: { width: StyleSheet.hairlineWidth, height: 14, backgroundColor: T.accent },
  filterClearBtn: { paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  filterBtnText: { fontSize: 13, fontWeight: '600', color: T.primary },
  filterBtnTextActive: { color: T.accent },
  activeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: T.accent, backgroundColor: T.accentTint },
  activeChipText: { fontSize: 13, fontWeight: '600', color: T.accent },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingLeft: 8, paddingRight: 20, flexShrink: 0 },
  sortLabel: { fontSize: 12, color: T.muted },

  // List
  listContent: { paddingHorizontal: 20, paddingTop: 2, paddingBottom: 48 },
  separator: { height: 1, backgroundColor: T.border },

  spotRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15 },
  rank: {
    width: 30, textAlign: 'center', fontSize: 17, fontWeight: '600',
    color: T.placeholder, fontVariant: ['tabular-nums'],
  },
  middle: { flex: 1, minWidth: 0 },
  spotName: { fontSize: 15.5, fontWeight: '700', color: T.primary, lineHeight: 19, letterSpacing: -0.1 },
  spotMeta: { fontSize: 12.5, color: T.muted, marginTop: 3 },

  socialRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 9, flexWrap: 'wrap' },
  friendStack: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: {
    width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  avatarText: { fontFamily: SERIF, fontSize: 9, fontWeight: '700', color: '#fff' },
  friendLabel: { fontSize: 11, color: T.muted },

  stateTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    height: 20, paddingHorizontal: 8, borderRadius: 10,
  },
  stateTagText: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.2 },

  scorePill: {
    borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3,
    backgroundColor: 'transparent', flexShrink: 0, minWidth: 42, alignItems: 'center',
  },
  scorePillText: { fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 16, color: T.muted },
  emptyLink: { fontSize: 14, color: T.accent, fontWeight: '600' },
});

const ls = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: T.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: T.border, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 13, fontWeight: '700', color: T.muted, textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 20, paddingBottom: 8 },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border,
  },
  optionActive: { backgroundColor: T.accentTint },
  optionText: { fontSize: 16, fontWeight: '500', color: T.primary },
  optionTextActive: { fontWeight: '700', color: T.accent },
});

const fs = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: T.primary },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: T.muted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
  },
  accordionHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 10 },
  accordionLabel: { fontSize: 15, fontWeight: '600', color: T.primary, flex: 1 },
  activeBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bg },
  chipActive: { backgroundColor: T.accentTint, borderColor: T.accent },
  chipText: { fontSize: 13, fontWeight: '600', color: T.primary },
  chipTextActive: { color: T.accent },
  distanceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  distanceValue: { fontSize: 13, fontWeight: '600', color: T.accent },
  distanceClear: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  distanceSliderWrap: { paddingHorizontal: 20, paddingBottom: 20 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginTop: 16 },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border,
  },
  clearAll: { fontSize: 15, color: T.accent, fontWeight: '600' },
  applyBtn: { backgroundColor: T.accent, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  applyBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

