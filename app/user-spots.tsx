import { useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Pressable, FlatList, Animated, Modal,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getUserVisits, getUserFutureSpots, PublicVisit, PublicFutureSpot,
} from '@/lib/friends';
import {
  ACTIVITY_TYPES, OCCASION_TYPES, friendlyDate, formatRating, ratingColor,
} from '@/lib/visits';
import { T } from '@/lib/theme';
import { useShimmer, SkBox } from '@/components/SkeletonBox';

function UserSpotsSkeleton({ tab }: { tab: TabKey }) {
  const { shimmer, screenW } = useShimmer();
  const sk = (w: number | `${number}%`, h: number, r?: number, style?: object) => (
    <SkBox shimmer={shimmer} w={w} h={h} r={r ?? 4} style={style} screenW={screenW} />
  );
  return (
    <View style={{ flex: 1 }}>
      {/* Shimmer filter strip */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border }}>
        {sk(76, 30, 20)}
      </View>
      {/* First row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16 }}>
        <View style={{ flex: 1, marginRight: 12, gap: 5 }}>
          {sk('70%', 17, 3)}
          {sk('40%', 13, 3)}
          {sk('30%', 12, 3, { marginTop: 2 })}
        </View>
        {tab === 'want'
          ? sk(24, 24, 8)
          : sk(42, 26, 10)}
      </View>
    </View>
  );
}

type SortOption = 'score' | 'date';
type TabKey = 'been' | 'want';

const PRICE_FILTER_OPTIONS = [
  { value: 0, label: 'Free' },
  { value: 1, label: '$' },
  { value: 2, label: '$$' },
  { value: 3, label: '$$$' },
];

// ─── Sort Sheet ───────────────────────────────────────────────────────────────

function SortSheet({ visible, selected, onSelect, onClose }: {
  visible: boolean; selected: SortOption;
  onSelect: (v: SortOption) => void; onClose: () => void;
}) {
  const sheetY = useRef(new Animated.Value(300)).current;
  useEffect(() => {
    if (visible) {
      sheetY.setValue(300);
      Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260 }).start();
    }
  }, [visible]);
  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      <View style={so.container}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[so.sheet, { transform: [{ translateY: sheetY }] }]}>
          <View style={so.handle} />
          <Text style={so.title}>Sort by</Text>
          {(['score', 'date'] as SortOption[]).map(opt => {
            const sel = selected === opt;
            return (
              <Pressable key={opt} style={[so.option, sel && so.optionActive]} onPress={() => { onSelect(opt); onClose(); }}>
                <Text style={[so.optionText, sel && so.optionTextActive]}>
                  {opt === 'score' ? 'Score' : 'Date Added'}
                </Text>
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

function FilterSheet({ visible, currentSort, currentActivity, currentPrice, currentOccasion, onApply, onClose }: {
  visible: boolean; currentSort: SortOption; currentActivity: string[];
  currentPrice: number[]; currentOccasion: string[];
  onApply: (sort: SortOption, activity: string[], price: number[], occasion: string[]) => void;
  onClose: () => void;
}) {
  const [draftSort, setDraftSort] = useState<SortOption>(currentSort);
  const [draftActivity, setDraftActivity] = useState<string[]>(currentActivity);
  const [draftPrice, setDraftPrice] = useState<number[]>(currentPrice);
  const [draftOccasion, setDraftOccasion] = useState<string[]>(currentOccasion);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['datetype']));
  const [segWidth, setSegWidth] = useState(0);
  const slideAnim = useRef(new Animated.Value(currentSort === 'score' ? 0 : 1)).current;

  useEffect(() => {
    if (visible) {
      setDraftSort(currentSort); setDraftActivity(currentActivity);
      setDraftPrice(currentPrice); setDraftOccasion(currentOccasion);
      slideAnim.setValue(currentSort === 'score' ? 0 : 1);
    }
  }, [visible]);

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: draftSort === 'score' ? 0 : 1, useNativeDriver: true, damping: 22, stiffness: 260 }).start();
  }, [draftSort]);

  function toggleArr<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  }
  function toggleSection(key: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  const segW = segWidth > 0 ? (segWidth - 6) / 2 : 0;
  const indicatorX = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, segW] });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={fs.root} edges={['top', 'bottom']}>
        <View style={fs.header}>
          <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={22} color={T.primary} /></Pressable>
          <Text style={fs.title}>Filter</Text>
          <View style={{ width: 30 }} />
        </View>
        <ScrollView style={fs.scroll} contentContainerStyle={fs.scrollContent} showsVerticalScrollIndicator={false}>
          <Pressable style={fs.accordionHeader} onPress={() => toggleSection('datetype')}>
            <Ionicons name="heart-outline" size={18} color={T.primary} />
            <Text style={fs.accordionLabel}>Date type</Text>
            <View style={[fs.activeBadge, draftOccasion.length === 0 && { opacity: 0 }]}>
              <Text style={fs.activeBadgeText}>{draftOccasion.length}</Text>
            </View>
            <Ionicons name={expanded.has('datetype') ? 'chevron-up' : 'chevron-down'} size={16} color={T.muted} />
          </Pressable>
          {expanded.has('datetype') && (
            <View style={fs.chipGrid}>
              {OCCASION_TYPES.map(o => {
                const sel = draftOccasion.includes(o.value);
                return (
                  <Pressable key={o.value} style={[fs.chip, sel && fs.chipActive]} onPress={() => setDraftOccasion(toggleArr(draftOccasion, o.value))}>
                    <Text style={[fs.chipText, sel && fs.chipTextActive]}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          <View style={fs.divider} />
          <Text style={fs.sectionTitle}>Sort by</Text>
          <View style={fs.segmentContainer} onLayout={e => setSegWidth(e.nativeEvent.layout.width)}>
            {segWidth > 0 && (
              <Animated.View style={[fs.segmentIndicator, { width: segW, transform: [{ translateX: indicatorX }] }]} pointerEvents="none" />
            )}
            {(['score', 'date'] as SortOption[]).map(opt => (
              <Pressable key={opt} style={fs.segment} onPress={() => setDraftSort(opt)}>
                <Text style={[fs.segmentText, draftSort === opt && fs.segmentTextActive]}>
                  {opt === 'score' ? 'Score' : 'Date Added'}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={fs.divider} />
          <Pressable style={fs.accordionHeader} onPress={() => toggleSection('category')}>
            <Ionicons name="restaurant-outline" size={18} color={T.primary} />
            <Text style={fs.accordionLabel}>Category</Text>
            <View style={[fs.activeBadge, draftActivity.length === 0 && { opacity: 0 }]}>
              <Text style={fs.activeBadgeText}>{draftActivity.length}</Text>
            </View>
            <Ionicons name={expanded.has('category') ? 'chevron-up' : 'chevron-down'} size={16} color={T.muted} />
          </Pressable>
          {expanded.has('category') && (
            <View style={fs.chipGrid}>
              {ACTIVITY_TYPES.map(a => {
                const sel = draftActivity.includes(a.value);
                return (
                  <Pressable key={a.value} style={[fs.chip, sel && fs.chipActive]} onPress={() => setDraftActivity(toggleArr(draftActivity, a.value))}>
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
        </ScrollView>
        <View style={fs.footer}>
          <Pressable onPress={() => { setDraftActivity([]); setDraftPrice([]); setDraftSort('score'); setDraftOccasion([]); }}>
            <Text style={fs.clearAll}>Clear all</Text>
          </Pressable>
          <Pressable style={fs.applyBtn} onPress={() => { onApply(draftSort, draftActivity, draftPrice, draftOccasion); onClose(); }}>
            <Text style={fs.applyBtnText}>Apply</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string }[] = [
  { key: 'been', label: 'Been' },
  { key: 'want', label: 'Want to Go' },
];

export default function UserSpotsScreen() {
  const { userId, username, tab: tabParam } = useLocalSearchParams<{ userId: string; username: string; tab: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>(tabParam === 'want' ? 'want' : 'been');

  const indicatorX = useRef(new Animated.Value(0)).current;
  const [indicatorWidth, setIndicatorWidth] = useState(0);
  const tabLayouts = useRef<Record<string, { x: number; width: number }>>({});

  const [visits, setVisits] = useState<PublicVisit[]>([]);
  const [futureSpots, setFutureSpots] = useState<PublicFutureSpot[]>([]);
  const [loading, setLoading] = useState(true);

  const [sortBy, setSortBy] = useState<SortOption>('score');
  const [activityFilters, setActivityFilters] = useState<string[]>([]);
  const [priceFilters, setPriceFilters] = useState<number[]>([]);
  const [occasionFilters, setOccasionFilters] = useState<string[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);

  useEffect(() => {
    if (!userId) return;
    Promise.all([getUserVisits(userId), getUserFutureSpots(userId)]).then(([v, f]) => {
      setVisits(v);
      setFutureSpots(f);
      setLoading(false);
    });
  }, [userId]);

  const filteredVisits = useMemo(() => {
    let list = visits;
    if (occasionFilters.length) list = list.filter(v => occasionFilters.includes(v.occasion_type ?? ''));
    if (activityFilters.length) list = list.filter(v => activityFilters.includes(v.activity_type));
    if (priceFilters.length) list = list.filter(v => priceFilters.includes(v.price));
    if (sortBy === 'score') return [...list].sort((a, b) => b.rating - a.rating);
    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [visits, occasionFilters, activityFilters, priceFilters, sortBy]);

  const filteredFuture = useMemo(() => {
    let list = futureSpots;
    if (occasionFilters.length) list = list.filter(f => occasionFilters.includes(f.occasion_type ?? ''));
    if (activityFilters.length) list = list.filter(f => activityFilters.includes(f.activity_type ?? ''));
    return list;
  }, [futureSpots, occasionFilters, activityFilters]);

  const activeList = activeTab === 'been' ? filteredVisits : filteredFuture;
  const activeFilterCount = activityFilters.length + priceFilters.length + occasionFilters.length;

  function handleTabSwitch(tab: TabKey) {
    if (tab === activeTab) return;
    setActiveTab(tab);
    const layout = tabLayouts.current[tab];
    if (layout) {
      setIndicatorWidth(layout.width);
      Animated.spring(indicatorX, { toValue: layout.x, useNativeDriver: true, damping: 22, stiffness: 280 }).start();
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={T.primary} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{username ?? ''}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map(tab => (
          <Pressable
            key={tab.key}
            style={s.tab}
            onPress={() => handleTabSwitch(tab.key)}
            onLayout={e => {
              const { x, width } = e.nativeEvent.layout;
              tabLayouts.current[tab.key] = { x, width };
              if (tab.key === activeTab) {
                indicatorX.setValue(x);
                setIndicatorWidth(width);
              }
            }}
          >
            <View>
              <Text style={[s.tabLabel, s.tabLabelActive, { opacity: 0 }]}>{tab.label}</Text>
              <Text style={[s.tabLabel, activeTab === tab.key && s.tabLabelActive, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, textAlign: 'center' }]}>{tab.label}</Text>
            </View>
          </Pressable>
        ))}
        {indicatorWidth > 0 && (
          <Animated.View style={[s.tabUnderline, { position: 'absolute', bottom: 0, width: indicatorWidth, transform: [{ translateX: indicatorX }] }]} />
        )}
      </View>

      {/* Filter strip */}
      {!loading && <View style={s.filterStrip}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterStripInner}>
          <View style={[s.filterBtn, activeFilterCount > 0 && s.filterBtnActive]}>
            <Pressable style={s.filterBtnMain} onPress={() => setShowFilter(true)}>
              <Ionicons name="options-outline" size={14} color={activeFilterCount > 0 ? T.accent : T.primary} />
              <Text style={[s.filterBtnText, activeFilterCount > 0 && s.filterBtnTextActive]}>Filter</Text>
            </Pressable>
            {activeFilterCount > 0 && (
              <>
                <View style={s.filterBtnDivider} />
                <Pressable style={s.filterClearBtn} onPress={() => { setActivityFilters([]); setPriceFilters([]); setOccasionFilters([]); }} hitSlop={6}>
                  <Ionicons name="close" size={14} color={T.accent} />
                </Pressable>
              </>
            )}
          </View>
          {activityFilters.map(af => {
            const label = ACTIVITY_TYPES.find(a => a.value === af)?.label ?? af;
            return (
              <Pressable key={af} style={s.activeChip} onPress={() => setActivityFilters(prev => prev.filter(x => x !== af))}>
                <Text style={s.activeChipText}>{label}</Text>
                <Ionicons name="close" size={12} color={T.accent} />
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable onPress={() => setShowSort(true)} hitSlop={8}>
          <Text style={s.sortLabel}>{sortBy === 'score' ? '↓ Score' : '↓ Date'}</Text>
        </Pressable>
      </View>}

      {/* List */}
      {loading ? (
        <UserSpotsSkeleton tab={activeTab} />
      ) : null}
      <FlatList
        data={loading ? [] : activeList}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listContent}
        ListEmptyComponent={
          loading ? null : (
            <View style={s.emptyWrap}>
              <Text style={s.emptyTitle}>
                {activeTab === 'been' ? 'No spots logged yet' : 'No saved spots yet'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          if (activeTab === 'been') {
            const visit = item as PublicVisit;
            const info = ACTIVITY_TYPES.find(a => a.value === visit.activity_type);
            const color = visit.rating > 0 ? ratingColor(visit.rating) : T.muted;
            return (
              <View style={s.row}>
                <View style={s.rowMain}>
                  <Text style={s.rowName} numberOfLines={1}>{visit.venue_name}</Text>
                  {info && <Text style={s.rowMeta}>{info.label}</Text>}
                  <Text style={s.rowDate}>{friendlyDate(visit.visited_at || visit.created_at)}</Text>
                </View>
                {visit.rating > 0 && (
                  <View style={[s.scorePill, { borderColor: color }]}>
                    <Text style={[s.scoreText, { color }]}>{formatRating(visit.rating)}</Text>
                  </View>
                )}
              </View>
            );
          }
          const spot = item as PublicFutureSpot;
          const categoryInfo = ACTIVITY_TYPES.find(a => a.value === spot.activity_type);
          return (
            <View style={s.row}>
              <View style={s.rowMain}>
                <Text style={s.rowName} numberOfLines={1}>{spot.venue_name}</Text>
                {categoryInfo && <Text style={s.rowMeta}>{categoryInfo.label}</Text>}
                <Text style={s.rowDate}>Added {friendlyDate(spot.created_at)}</Text>
              </View>
              <View style={s.bookmarkPill}>
                <Ionicons name="bookmark" size={11} color="#5856d6" />
              </View>
            </View>
          );
        }}
      />

      <SortSheet visible={showSort} selected={sortBy} onSelect={setSortBy} onClose={() => setShowSort(false)} />
      <FilterSheet
        visible={showFilter}
        currentSort={sortBy} currentActivity={activityFilters}
        currentPrice={priceFilters} currentOccasion={occasionFilters}
        onApply={(sort, activity, price, occasion) => {
          setSortBy(sort); setActivityFilters(activity); setPriceFilters(price); setOccasionFilters(occasion);
        }}
        onClose={() => setShowFilter(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: '400', color: T.primary, fontFamily: 'Fraunces-Regular', },

  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  tab: {
    marginRight: 24,
    paddingBottom: 10,
    position: 'relative',
    alignItems: 'center',
  },
  tabLabel: { fontSize: 15, fontWeight: '500', color: T.muted },
  tabLabelActive: { color: T.primary, fontWeight: '700' },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: T.primary,
    borderRadius: 1,
  },

  filterStrip: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border,
  },
  filterStripInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexGrow: 1,
  },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 20,
    borderWidth: 1, borderColor: T.border, backgroundColor: T.bg, overflow: 'hidden',
  },
  filterBtnActive: { borderColor: T.accent, backgroundColor: T.accentTint },
  filterBtnMain: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6 },
  filterBtnDivider: { width: StyleSheet.hairlineWidth, height: 14, backgroundColor: T.accent },
  filterClearBtn: { paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  filterBtnText: { fontSize: 13, fontWeight: '600', color: T.primary },
  filterBtnTextActive: { color: T.accent },
  activeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: T.accent, backgroundColor: T.accentTint,
  },
  activeChipText: { fontSize: 13, fontWeight: '600', color: T.accent },
  sortLabel: { fontSize: 12, color: T.muted, paddingRight: 16, flexShrink: 0 },

  listContent: { paddingBottom: 60 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border,
  },
  rowMain: { flex: 1, marginRight: 12 },
  rowName: { fontSize: 17, fontWeight: '700', color: T.primary, marginBottom: 4 },
  rowMeta: { fontSize: 13, color: T.muted, marginBottom: 2 },
  rowDate: { fontSize: 12, color: T.muted, marginTop: 4 },
  scorePill: {
    borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3,
    backgroundColor: 'transparent', minWidth: 42, alignItems: 'center', flexShrink: 0,
  },
  scoreText: { fontSize: 12, fontWeight: '800' },
  bookmarkPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    borderWidth: 1, borderColor: '#5856d618', backgroundColor: '#5856d608', flexShrink: 0,
  },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 16, color: T.muted, fontFamily: 'Fraunces-Regular', },
});

const so = StyleSheet.create({
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
    fontSize: 13, fontWeight: '700', color: T.muted, textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
  },
  segmentContainer: {
    flexDirection: 'row', marginHorizontal: 20, backgroundColor: T.inputBg,
    borderRadius: 12, padding: 3, position: 'relative',
  },
  segmentIndicator: {
    position: 'absolute', top: 3, bottom: 3, left: 3, borderRadius: 9,
    backgroundColor: T.bg, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 3,
  },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentText: { fontSize: 14, fontWeight: '500', color: T.muted },
  segmentTextActive: { fontWeight: '700', color: T.primary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginTop: 16 },
  accordionHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, gap: 10,
  },
  accordionLabel: { fontSize: 15, fontWeight: '600', color: T.primary, flex: 1 },
  activeBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center' },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.bg },
  chipActive: { backgroundColor: T.accentTint, borderColor: T.accent },
  chipText: { fontSize: 13, fontWeight: '600', color: T.primary },
  chipTextActive: { color: T.accent },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border,
  },
  clearAll: { fontSize: 15, color: T.accent, fontWeight: '600' },
  applyBtn: { backgroundColor: T.accent, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  applyBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
