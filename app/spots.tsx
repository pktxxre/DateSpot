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
import { PRICE_LABELS, ratingColor, Price } from '@/lib/visits';
import { T } from '@/lib/theme';

const HERO_BG = '#1F1208';
const LIMIT_OPTIONS = [50, 100, 150, 200] as const;
type Limit = typeof LIMIT_OPTIONS[number];

const SK_BASE = '#EAE4D9';
const SK_LIGHT = '#F8F4EC';

function SkBox({
  shimmer,
  w,
  h,
  r = 4,
  style,
  screenW,
}: {
  shimmer: ReturnType<typeof useAnimatedStyle>;
  w: number | `${number}%`;
  h: number;
  r?: number;
  style?: object;
  screenW: number;
}) {
  return (
    <View style={[{ width: w, height: h, backgroundColor: SK_BASE, overflow: 'hidden', borderRadius: r }, style]}>
      <Reanimated.View
        style={[
          { position: 'absolute', top: 0, left: 0, bottom: 0, width: screenW * 0.6, backgroundColor: SK_LIGHT, opacity: 0.95 },
          shimmer,
        ]}
      />
    </View>
  );
}

function SpotsSkeleton() {
  const { width: screenW } = useWindowDimensions();
  const offset = useSharedValue(-screenW * 0.65);

  useEffect(() => {
    offset.value = withRepeat(
      withTiming(screenW, { duration: 1800, easing: Easing.linear }),
      -1,
      false,
    );
  }, [screenW]);

  const shimmer = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const sk = (w: number | `${number}%`, h: number, r?: number, style?: object) => (
    <SkBox shimmer={shimmer} w={w} h={h} r={r} style={style} screenW={screenW} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <View key={i}>
            {i > 0 && (
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginLeft: 44 }} />
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13 }}>
              {sk(4, 36, 2, { marginRight: 10 })}
              {sk(22, 13, 3, { marginRight: 10 })}
              <View style={{ flex: 1, marginRight: 10, gap: 5 }}>
                {sk('70%', 15, 3)}
                {sk('48%', 12, 3)}
              </View>
              {sk(42, 26, 10)}
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

const PRICE_FILTER_OPTIONS = [
  { value: 1, label: '$' },
  { value: 2, label: '$$' },
  { value: 3, label: '$$$' },
  { value: 0, label: 'Free' },
];

export default function SpotsScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const [seeds, setSeeds] = useState<SeedSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilters, setCategoryFilters] = useState<string[]>(params.category ? [params.category] : []);
  const [priceFilters, setPriceFilters] = useState<number[]>([]);
  const [limit, setLimit] = useState<Limit>(50);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showLimitSheet, setShowLimitSheet] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    getSeedSpotsRaw().then(data => {
      setSeeds(data);
      setLoading(false);
    });
  }, []);

  const filtered = seeds
    .filter(s => {
      if (categoryFilters.length > 0 && !categoryFilters.includes(s.activity_type)) return false;
      if (priceFilters.length > 0 && !priceFilters.includes(s.price)) return false;
      return true;
    })
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);

  const activeFilterCount = categoryFilters.length + priceFilters.length;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: HERO_BG }]} pointerEvents="none" />
      <SafeAreaView style={s.safe} edges={['top']}>

        {/* Colored hero */}
        <View style={s.hero}>
          <Pressable
            style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.6 }]}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.75)" />
          </Pressable>
          <View style={s.heroContent}>
            <Text style={s.heroMeta}>TOP {limit} · SEATTLE</Text>
            <Text style={s.heroTitle}>All date spots</Text>
          </View>
        </View>

        {/* White card */}
        <View style={s.whiteCard}>
          {/* Badge row */}
          <View style={s.badgeRow}>
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
                    onPress={() => { setCategoryFilters([]); setPriceFilters([]); }}
                    hitSlop={6}
                  >
                    <Ionicons name="close" size={14} color={T.accent} />
                  </Pressable>
                </>
              )}
            </View>

            <Pressable
              style={({ pressed }) => [s.limitBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setShowLimitSheet(true)}
            >
              <Text style={s.limitBtnText}>Top {limit}</Text>
              <Ionicons name="chevron-down" size={12} color={T.muted} />
            </Pressable>
          </View>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.activeChipsScroll}
              contentContainerStyle={s.activeChipsRow}
            >
              {categoryFilters.map(cf => (
                <Pressable
                  key={cf}
                  style={s.activeChip}
                  onPress={() => setCategoryFilters(prev => prev.filter(x => x !== cf))}
                >
                  <Text style={s.activeChipText}>{CATEGORY_LABELS[cf] ?? cf}</Text>
                  <Ionicons name="close" size={12} color={T.accent} />
                </Pressable>
              ))}
              {priceFilters.map(pf => (
                <Pressable
                  key={pf}
                  style={s.activeChip}
                  onPress={() => setPriceFilters(prev => prev.filter(x => x !== pf))}
                >
                  <Text style={s.activeChipText}>{PRICE_FILTER_OPTIONS.find(p => p.value === pf)?.label ?? ''}</Text>
                  <Ionicons name="close" size={12} color={T.accent} />
                </Pressable>
              ))}
            </ScrollView>
          )}

          <View style={s.listDivider} />

          {/* Spot list */}
          {loading ? (
            <SpotsSkeleton />
          ) : filtered.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyText}>No spots match</Text>
              <Pressable onPress={() => { setCategoryFilters([]); setPriceFilters([]); }}>
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
              renderItem={({ item }) => {
                const color = ratingColor(item.rating);
                const accentColor = ACTIVITY_COLORS[item.activity_type] ?? ACTIVITY_COLORS.other;
                const priceLabel = PRICE_LABELS[item.price as Price] ?? '';
                const catLabel = CATEGORY_LABELS[item.activity_type] ?? item.activity_type;
                const restMeta = [priceLabel].filter(Boolean).join(' · ');

                return (
                  <Pressable
                    style={({ pressed }) => [s.spotRow, pressed && { opacity: 0.7 }]}
                    onPress={() => router.push(`/spot/${item.id}` as any)}
                  >
                    <View style={[s.accentBar, { backgroundColor: color }]} />
                    <View style={s.spotInfo}>
                      <Text style={s.spotName} numberOfLines={1} ellipsizeMode="tail">{item.venue_name}</Text>
                      <Text style={s.spotMeta}>
                        <Text style={{ color: accentColor }}>{catLabel}</Text>
                        {restMeta ? <Text>{' · ' + restMeta}</Text> : null}
                      </Text>
                    </View>
                    <View style={[s.ratingPill, { borderColor: color }]}>
                      <Text style={[s.ratingPillText, { color }]}>{item.rating.toFixed(1)}</Text>
                    </View>
                  </Pressable>
                );
              }}
            />
          )}
        </View>

        <FilterSheet
          visible={showFilterSheet}
          currentCategory={categoryFilters}
          currentPrice={priceFilters}
          currentLimit={limit}
          onApply={(category, price, newLimit) => {
            setCategoryFilters(category);
            setPriceFilters(price);
            setLimit(newLimit);
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

function FilterSheet({ visible, currentCategory, currentPrice, currentLimit, onApply, onClose }: {
  visible: boolean;
  currentCategory: string[];
  currentPrice: number[];
  currentLimit: Limit;
  onApply: (category: string[], price: number[], limit: Limit) => void;
  onClose: () => void;
}) {
  const [draftCategory, setDraftCategory] = useState<string[]>(currentCategory);
  const [draftPrice, setDraftPrice] = useState<number[]>(currentPrice);
  const [draftLimit, setDraftLimit] = useState<Limit>(currentLimit);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['category']));

  useEffect(() => {
    if (visible) {
      setDraftCategory(currentCategory);
      setDraftPrice(currentPrice);
      setDraftLimit(currentLimit);
    }
  }, [visible]);

  function toggleArr<T>(arr: T[], val: T): T[] {
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

          {/* Show (limit) */}
          <Text style={fs.sectionTitle}>Show</Text>
          <View style={fs.chipGrid}>
            {LIMIT_OPTIONS.map(opt => {
              const sel = draftLimit === opt;
              return (
                <Pressable
                  key={opt}
                  style={[fs.chip, sel && fs.chipActive]}
                  onPress={() => setDraftLimit(opt)}
                >
                  <Text style={[fs.chipText, sel && fs.chipTextActive]}>Top {opt}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={fs.divider} />

          {/* Category accordion */}
          <Pressable style={fs.accordionHeader} onPress={() => toggleSection('category')}>
            <Ionicons name="restaurant-outline" size={18} color={T.primary} />
            <Text style={fs.accordionLabel}>Category</Text>
            <View style={[fs.activeBadge, draftCategory.length === 0 && { opacity: 0 }]}>
              <Text style={fs.activeBadgeText}>{draftCategory.length}</Text>
            </View>
            <Ionicons
              name={expanded.has('category') ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={T.muted}
            />
          </Pressable>
          {expanded.has('category') && (
            <View style={fs.chipGrid}>
              {SEED_VENUE_TYPES.map(a => {
                const sel = draftCategory.includes(a.value);
                return (
                  <Pressable
                    key={a.value}
                    style={[fs.chip, sel && fs.chipActive]}
                    onPress={() => setDraftCategory(toggleArr(draftCategory, a.value))}
                  >
                    <Text style={[fs.chipText, sel && fs.chipTextActive]}>{a.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={fs.divider} />

          {/* Price accordion */}
          <Pressable style={fs.accordionHeader} onPress={() => toggleSection('price')}>
            <Ionicons name="cash-outline" size={18} color={T.primary} />
            <Text style={fs.accordionLabel}>Price</Text>
            <View style={[fs.activeBadge, draftPrice.length === 0 && { opacity: 0 }]}>
              <Text style={fs.activeBadgeText}>{draftPrice.length}</Text>
            </View>
            <Ionicons
              name={expanded.has('price') ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={T.muted}
            />
          </Pressable>
          {expanded.has('price') && (
            <View style={fs.chipGrid}>
              {PRICE_FILTER_OPTIONS.map(p => {
                const sel = draftPrice.includes(p.value);
                return (
                  <Pressable
                    key={p.value}
                    style={[fs.chip, sel && fs.chipActive]}
                    onPress={() => setDraftPrice(toggleArr(draftPrice, p.value))}
                  >
                    <Text style={[fs.chipText, sel && fs.chipTextActive]}>{p.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>

        <View style={fs.footer}>
          <Pressable onPress={() => { setDraftCategory([]); setDraftPrice([]); setDraftLimit(50); }}>
            <Text style={fs.clearAll}>Clear all</Text>
          </Pressable>
          <Pressable
            style={fs.applyBtn}
            onPress={() => { onApply(draftCategory, draftPrice, draftLimit); onClose(); }}
          >
            <Text style={fs.applyBtnText}>Apply</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },

  hero: {
    backgroundColor: HERO_BG,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 20,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  heroContent: {},
  heroMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 28,
    fontFamily: 'Fraunces-Regular',
    color: '#fff',
    lineHeight: 32,
  },

  whiteCard: {
    flex: 1,
    backgroundColor: T.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    overflow: 'hidden',
  },

  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 6,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.bg,
    overflow: 'hidden',
  },
  filterBtnActive: { borderColor: T.accent, backgroundColor: T.accentTint },
  filterBtnMain: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6 },
  filterBtnDivider: { width: StyleSheet.hairlineWidth, height: 14, backgroundColor: T.accent },
  filterClearBtn: { paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  filterBtnText: { fontSize: 13, fontWeight: '600', color: T.primary },
  filterBtnTextActive: { color: T.accent },

  limitBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  limitBtnText: { fontSize: 13, color: T.muted, fontWeight: '500' },

  activeChipsScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  activeChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 8,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.accent,
    backgroundColor: T.accentTint,
    flexShrink: 0,
  },
  activeChipText: { fontSize: 13, fontWeight: '600', color: T.accent, flexShrink: 0 },

  listDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.border,
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.border,
    marginLeft: 44,
  },

  spotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: 10,
    minHeight: 36,
  },
  spotInfo: { flex: 1, marginRight: 10 },
  spotName: { fontSize: 15, fontWeight: '600', color: T.primary, marginBottom: 2 },
  spotMeta: { fontSize: 12, color: T.muted },

  ratingPill: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'transparent',
  },
  ratingPillText: { fontSize: 12, fontWeight: '800' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 16, color: T.muted },
  emptyLink: { fontSize: 14, color: T.accent, fontWeight: '600' },
});

const ls = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: T.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: T.primary },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  sectionTitle: {
    fontSize: 13, fontWeight: '700', color: T.muted,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
  },
  accordionLabel: { fontSize: 15, fontWeight: '600', color: T.primary, flex: 1 },
  activeBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center',
  },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  chipGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 20, paddingBottom: 16,
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: T.border, backgroundColor: T.bg,
  },
  chipActive: { backgroundColor: T.accentTint, borderColor: T.accent },
  chipText: { fontSize: 13, fontWeight: '600', color: T.primary },
  chipTextActive: { color: T.accent },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginTop: 16 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
  },
  clearAll: { fontSize: 15, color: T.accent, fontWeight: '600' },
  applyBtn: { backgroundColor: T.accent, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  applyBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
