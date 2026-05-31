import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Animated, Easing, FlatList, Modal,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getAllVisits, Visit, ACTIVITY_TYPES, OCCASION_TYPES, PRICE_LABELS, Price,
  formatRating, ratingColor, friendlyDate, ActivityType,
} from '@/lib/visits';
import { getAllFutureSpots, FutureSpot } from '@/lib/future';
import {
  getAllStacks, createStack, StackSummary,
} from '@/lib/stacks';
import { useSelectionMode } from '@/lib/useSelectionMode';
import { consumeNewStack } from '@/lib/stackCreation';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { T } from '@/lib/theme';
import { TabSlideWrapper } from '@/components/TabSlideWrapper';
import { useShimmer, SkBox } from '@/components/SkeletonBox';

function ListsSkeleton({ tab }: { tab: ActiveTab }) {
  const { shimmer, screenW } = useShimmer();
  const sk = (w: number | `${number}%`, h: number, r?: number, style?: object) => (
    <SkBox shimmer={shimmer} w={w} h={h} r={r ?? 4} style={style} screenW={screenW} />
  );
  return (
    <View style={{ flex: 1 }}>
      {/* Filter strip */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border }}>
        {sk(82, 30, 20)}
      </View>
      {/* Rows */}
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            {sk('70%', 17, 3, { marginBottom: 4 })}
            {tab === 'stacks' ? (
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 2 }}>
                {sk(58, 20, 8)}
                {sk(48, 20, 8)}
              </View>
            ) : sk('40%', 13, 3, { marginBottom: 2 })}
            {sk('28%', 12, 3, { marginTop: 4 })}
          </View>
          {tab === 'saved'
            ? sk(27, 20, 8)
            : sk(42, 26, 10)}
        </View>
      ))}
    </View>
  );
}

type ActiveTab = 'been' | 'saved' | 'stacks';
type SortOption = 'score' | 'date';

const FUTURE_BLUE = '#5856d6';
const TABS: { key: ActiveTab; label: string }[] = [
  { key: 'been', label: 'Been' },
  { key: 'saved', label: 'Want to Go' },
  { key: 'stacks', label: 'Stacks' },
];
const PRICE_FILTER_OPTIONS = [
  { value: 0, label: 'Free' },
  { value: 1, label: '$' },
  { value: 2, label: '$$' },
  { value: 3, label: '$$$' },
];

// ─── Spot Row ─────────────────────────────────────────────────────────────────

function SpotRow({ visit, selectionMode, isSelected, onSelect, onLongPress }: {
  visit: Visit;
  selectionMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onLongPress: () => void;
}) {
  const info = ACTIVITY_TYPES.find(a => a.value === visit.activity_type);
  const priceLabel = visit.price != null && visit.price > 0 ? PRICE_LABELS[visit.price as Price] : null;
  const occasionInfo = OCCASION_TYPES.find(a => a.value === visit.occasion_type);
  const occasionDisplay = visit.occasion_type === 'other' && visit.occasion_label
    ? `Other (${visit.occasion_label})` : occasionInfo?.label;
  const dateStr = friendlyDate(visit.visited_at || visit.created_at);
  const color = ratingColor(visit.rating);
  const metaLine = [priceLabel, info?.label, occasionDisplay].filter(Boolean).join(' · ');

  return (
    <Pressable
      style={({ pressed }) => [s.row, pressed && { opacity: 0.75 }]}
      onPress={selectionMode ? onSelect : () => router.push(`/spot/${visit.id}`)}
      onLongPress={onLongPress}
      delayLongPress={350}
    >
      {selectionMode && (
        <View style={[s.checkbox, isSelected && s.checkboxChecked]}>
          {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
      )}
      <View style={s.rowMain}>
        <Text style={s.rowName} numberOfLines={1}>{visit.venue_name}</Text>
        {metaLine ? <Text style={s.rowMeta} numberOfLines={1}>{metaLine}</Text> : null}
        <Text style={s.rowDate}>{dateStr}</Text>
      </View>
      {!selectionMode && visit.rating > 0 && (
        <View style={[s.scorePill, { borderColor: color }]}>
          <Text style={[s.scoreText, { color }]}>{formatRating(visit.rating)}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Future Spot Row ──────────────────────────────────────────────────────────

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

// ─── Stack Row ────────────────────────────────────────────────────────────────

function StackRow({ stack }: { stack: StackSummary }) {
  const color = ratingColor(stack.rating);
  const dateStr = friendlyDate(stack.created_at);

  return (
    <Pressable
      style={({ pressed }) => [s.row, pressed && { opacity: 0.75 }]}
      onPress={() => router.push(`/stack/${stack.id}`)}
    >
      <View style={s.rowMain}>
        <Text style={s.rowName} numberOfLines={1}>{stack.name}</Text>
        {stack.activity_types.length > 0 && (
          <Text style={s.rowMeta} numberOfLines={1}>
            {stack.activity_types.map(at => ACTIVITY_TYPES.find(a => a.value === at)?.label ?? at).join(' · ')}
          </Text>
        )}
        <Text style={s.rowDate}>{dateStr}</Text>
      </View>
      {stack.rating > 0 && (
        <View style={[s.scorePill, { borderColor: color }]}>
          <Text style={[s.scoreText, { color }]}>{formatRating(stack.rating)}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Occasion Sheet ───────────────────────────────────────────────────────────

// ─── Sort Sheet ───────────────────────────────────────────────────────────────

const SORT_LABELS: Record<SortOption, string> = { score: 'Score', date: 'Date Added' };

function SortSheet({ visible, selected, onSelect, onClose }: {
  visible: boolean;
  selected: SortOption;
  onSelect: (val: SortOption) => void;
  onClose: () => void;
}) {
  const sheetY = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      sheetY.setValue(300);
      Animated.timing(sheetY, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
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
              <Pressable
                key={opt}
                style={[so.option, sel && so.optionActive]}
                onPress={() => { onSelect(opt); onClose(); }}
              >
                <Text style={[so.optionText, sel && so.optionTextActive]}>{SORT_LABELS[opt]}</Text>
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
  visible: boolean;
  currentSort: SortOption;
  currentActivity: string[];
  currentPrice: number[];
  currentOccasion: string[];
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
      setDraftSort(currentSort);
      setDraftActivity(currentActivity);
      setDraftPrice(currentPrice);
      setDraftOccasion(currentOccasion);
      slideAnim.setValue(currentSort === 'score' ? 0 : 1);
    }
  }, [visible]);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: draftSort === 'score' ? 0 : 1,
      useNativeDriver: true,
      damping: 22,
      stiffness: 260,
    }).start();
  }, [draftSort]);

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

  const segW = segWidth > 0 ? (segWidth - 6) / 2 : 0;
  const indicatorX = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, segW] });

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

          {/* Date type accordion */}
          <Pressable style={fs.accordionHeader} onPress={() => toggleSection('datetype')}>
            <Ionicons name="heart-outline" size={18} color={T.primary} />
            <Text style={fs.accordionLabel}>Date type</Text>
            <View style={[fs.activeBadge, draftOccasion.length === 0 && { opacity: 0 }]}>
              <Text style={fs.activeBadgeText}>{draftOccasion.length}</Text>
            </View>
            <Ionicons
              name={expanded.has('datetype') ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={T.muted}
            />
          </Pressable>
          {expanded.has('datetype') && (
            <View style={fs.chipGrid}>
              {OCCASION_TYPES.map(o => {
                const sel = draftOccasion.includes(o.value);
                return (
                  <Pressable
                    key={o.value}
                    style={[fs.chip, sel && fs.chipActive]}
                    onPress={() => setDraftOccasion(toggleArr(draftOccasion, o.value))}
                  >
                    <Text style={[fs.chipText, sel && fs.chipTextActive]}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={fs.divider} />

          {/* Sort by */}
          <Text style={fs.sectionTitle}>Sort by</Text>
          <View
            style={fs.segmentContainer}
            onLayout={e => setSegWidth(e.nativeEvent.layout.width)}
          >
            {segWidth > 0 && (
              <Animated.View
                style={[fs.segmentIndicator, { width: segW, transform: [{ translateX: indicatorX }] }]}
                pointerEvents="none"
              />
            )}
            {(['score', 'date'] as SortOption[]).map(opt => (
              <Pressable key={opt} style={fs.segment} onPress={() => setDraftSort(opt)}>
                <Text style={[fs.segmentText, draftSort === opt && fs.segmentTextActive]}>
                  {SORT_LABELS[opt]}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={fs.divider} />

          {/* Category accordion */}
          <Pressable style={fs.accordionHeader} onPress={() => toggleSection('category')}>
            <Ionicons name="restaurant-outline" size={18} color={T.primary} />
            <Text style={fs.accordionLabel}>Category</Text>
            <View style={[fs.activeBadge, draftActivity.length === 0 && { opacity: 0 }]}>
              <Text style={fs.activeBadgeText}>{draftActivity.length}</Text>
            </View>
            <Ionicons
              name={expanded.has('category') ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={T.muted}
            />
          </Pressable>
          {expanded.has('category') && (
            <View style={fs.chipGrid}>
              {ACTIVITY_TYPES.map(a => {
                const sel = draftActivity.includes(a.value);
                return (
                  <Pressable
                    key={a.value}
                    style={[fs.chip, sel && fs.chipActive]}
                    onPress={() => setDraftActivity(toggleArr(draftActivity, a.value))}
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
          <Pressable onPress={() => { setDraftActivity([]); setDraftPrice([]); setDraftSort('score'); setDraftOccasion([]); }}>
            <Text style={fs.clearAll}>Clear all</Text>
          </Pressable>
          <Pressable
            style={fs.applyBtn}
            onPress={() => { onApply(draftSort, draftActivity, draftPrice, draftOccasion); onClose(); }}
          >
            <Text style={fs.applyBtnText}>Apply</Text>
          </Pressable>
        </View>
      </SafeAreaView>

    </Modal>
  );
}

// ─── Create Stack Modal ───────────────────────────────────────────────────────

function CreateStackModal({ visitIds, onConfirm, onCancel }: {
  visitIds: string[];
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');

  return (
    <Modal visible animationType="slide" presentationStyle="formSheet" transparent>
      <Pressable style={ns.backdrop} onPress={onCancel}>
        <Pressable style={ns.sheet} onPress={() => {}}>
          <View style={ns.handle} />
          <Text style={ns.title}>Name this stack</Text>
          <Text style={ns.subtitle}>{visitIds.length} spots selected</Text>
          <TextInput
            style={ns.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Saturday Night Out"
            placeholderTextColor={T.placeholder}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => name.trim() && onConfirm(name.trim())}
          />
          <Pressable
            style={[ns.confirmBtn, !name.trim() && ns.confirmBtnDisabled]}
            onPress={() => name.trim() && onConfirm(name.trim())}
            disabled={!name.trim()}
          >
            <Text style={[ns.confirmBtnText, !name.trim() && ns.confirmBtnTextDisabled]}>Create Stack</Text>
          </Pressable>
          <Pressable style={ns.cancelBtn} onPress={onCancel}>
            <Text style={ns.cancelBtnText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

function getTabFromParam(p: string | undefined): ActiveTab {
  if (p === 'stacks' || p === 'saved') return p as ActiveTab;
  return 'been';
}

export default function ListsScreen() {
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => getTabFromParam(tabParam));
  const [occasionFilters, setOccasionFilters] = useState<string[]>([]);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [showSortSheet, setShowSortSheet] = useState(false);

  const [sortBy, setSortBy] = useState<SortOption>('score');
  const [activityFilters, setActivityFilters] = useState<string[]>([]);
  const [priceFilters, setPriceFilters] = useState<number[]>([]);

  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [futureSpots, setFutureSpots] = useState<FutureSpot[]>([]);
  const [stacks, setStacks] = useState<StackSummary[]>([]);

  const [naming, setNaming] = useState(false);
  const [indicatorWidth, setIndicatorWidth] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const indicatorX = useRef(new Animated.Value(0)).current;
  const tabLayouts = useRef<Record<string, { x: number; width: number }>>({});
  const textWidths = useRef<Record<string, number>>({});
  const { selectionMode, selectedIds, enter, exit, toggle, canStack } = useSelectionMode();

  function getTextIndicator(key: string): { x: number; width: number } | null {
    const tabLayout = tabLayouts.current[key];
    const textW = textWidths.current[key];
    if (!tabLayout || !textW) return null;
    return { x: tabLayout.x + (tabLayout.width - textW) / 2, width: textW };
  }

  useLayoutEffect(() => {
    const target = getTabFromParam(tabParam);
    setActiveTab(target);
    const ind = getTextIndicator(target);
    if (ind) {
      indicatorX.setValue(ind.x);
      setIndicatorWidth(ind.width);
    }
  }, [tabParam]);

  useFocusEffect(
    useCallback(() => {
      const target = getTabFromParam(tabParam);
      setActiveTab(target);
      const ind = getTextIndicator(target);
      if (ind) {
        indicatorX.setValue(ind.x);
        setIndicatorWidth(ind.width);
      }
      if (target === 'been') flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      setVisits(getAllVisits().filter(v => !(v as any).is_seed));
      setFutureSpots(getAllFutureSpots());
      setStacks(getAllStacks());
      setLoading(false);
      if (consumeNewStack()) enter();
    }, [tabParam])
  );

  const filteredVisits = useMemo(() => {
    let list = visits;
    if (occasionFilters.length) list = list.filter(v => occasionFilters.includes(v.occasion_type));
    if (activityFilters.length) list = list.filter(v => activityFilters.includes(v.activity_type));
    if (priceFilters.length) list = list.filter(v => priceFilters.includes(v.price));
    if (sortBy === 'score') return [...list].sort((a, b) => b.rating - a.rating);
    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [visits, occasionFilters, activityFilters, priceFilters, sortBy]);

  const filteredFuture = useMemo(() => {
    let list = futureSpots;
    if (occasionFilters.length) list = list.filter(f => occasionFilters.includes(f.occasion_type ?? ''));
    if (activityFilters.length) list = list.filter(f => activityFilters.includes(f.activity_type ?? ''));
    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [futureSpots, occasionFilters, activityFilters]);

  const filteredStacks = useMemo(() => {
    let list = stacks;
    if (activityFilters.length) list = list.filter(st => st.activity_types.some(at => activityFilters.includes(at)));
    if (sortBy === 'score') return [...list].sort((a, b) => b.rating - a.rating);
    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [stacks, activityFilters, sortBy]);

  const activeFilterCount = activityFilters.length + priceFilters.length + occasionFilters.length;

  function handleTabSwitch(tab: ActiveTab) {
    if (tab === activeTab) return;
    setActiveTab(tab);
    if (selectionMode) exit();
    const ind = getTextIndicator(tab);
    if (ind) {
      setIndicatorWidth(ind.width);
      Animated.spring(indicatorX, { toValue: ind.x, useNativeDriver: true, damping: 22, stiffness: 280 }).start();
    }
  }

  function handleStackConfirm(name: string) {
    const visitIds = Array.from(selectedIds);
    createStack(name, visitIds, 'A', '', null);
    setNaming(false);
    exit();
    setStacks(getAllStacks());
    setActiveTab('stacks');
  }

  return (
    <TabSlideWrapper myIndex={1}>
      <SafeAreaView style={s.safe} edges={['top']}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.occasionSelector}>
            <View>
              <Text style={s.occasionSubtitle}> </Text>
              <Text style={s.occasionTitle}>All Dates</Text>
            </View>
          </View>
          <ProfileAvatar onPress={() => router.push('/(tabs)/profile')} />
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
                const textW = textWidths.current[tab.key];
                if (tab.key === activeTab && textW) {
                  const indX = x + (width - textW) / 2;
                  indicatorX.setValue(indX);
                  setIndicatorWidth(textW);
                }
              }}
            >
              <Text
                style={[s.tabLabel, activeTab === tab.key && s.tabLabelActive]}
                onLayout={e => {
                  const textW = e.nativeEvent.layout.width;
                  textWidths.current[tab.key] = textW;
                  const tabLayout = tabLayouts.current[tab.key];
                  if (tab.key === activeTab && tabLayout) {
                    const indX = tabLayout.x + (tabLayout.width - textW) / 2;
                    indicatorX.setValue(indX);
                    setIndicatorWidth(textW);
                  }
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
          {indicatorWidth > 0 && (
            <Animated.View style={[s.tabUnderline, { position: 'absolute', bottom: 0, width: indicatorWidth, transform: [{ translateX: indicatorX }] }]} />
          )}
        </View>

        {/* Filter strip */}
        {!selectionMode && !loading && (
          <View style={s.filterStrip}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.filterStripInner}
            >
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
                      onPress={() => { setActivityFilters([]); setPriceFilters([]); setOccasionFilters([]); }}
                      hitSlop={6}
                    >
                      <Ionicons name="close" size={14} color={T.accent} />
                    </Pressable>
                  </>
                )}
              </View>
              {activityFilters.map(af => {
                const label = ACTIVITY_TYPES.find(a => a.value === af)?.label ?? af;
                return (
                  <Pressable
                    key={af}
                    style={s.activeChip}
                    onPress={() => setActivityFilters(prev => prev.filter(x => x !== af))}
                  >
                    <Text style={s.activeChipText}>{label}</Text>
                    <Ionicons name="close" size={12} color={T.accent} />
                  </Pressable>
                );
              })}
              {priceFilters.map(pf => {
                const label = PRICE_FILTER_OPTIONS.find(p => p.value === pf)?.label ?? '';
                return (
                  <Pressable
                    key={pf}
                    style={s.activeChip}
                    onPress={() => setPriceFilters(prev => prev.filter(x => x !== pf))}
                  >
                    <Text style={s.activeChipText}>{label}</Text>
                    <Ionicons name="close" size={12} color={T.accent} />
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable onPress={() => setShowSortSheet(true)} hitSlop={8}>
              <Text style={s.sortLabel}>{sortBy === 'score' ? '↓ Score' : '↓ Date'}</Text>
            </Pressable>
          </View>
        )}

        {/* Selection mode bar */}
        {selectionMode && (
          <View style={s.selectionBar}>
            <Text style={s.selectionHint}>
              {selectedIds.size === 0 ? 'Tap spots to select' : `${selectedIds.size} selected`}
            </Text>
            <Pressable onPress={exit} hitSlop={8}>
              <Text style={s.cancelSelection}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {/* Been tab */}
        {activeTab === 'been' && (
          loading ? (
            <ListsSkeleton tab="been" />
          ) : visits.length === 0 ? (
            <View style={s.empty}>
              <View style={s.emptyIconCircle}>
                <Ionicons name="checkmark" size={20} color="#fff" />
              </View>
              <Text style={s.emptyTitle}>No spots logged yet</Text>
              <View style={s.emptyHintContainer}>
                <View style={s.emptyHintRow}>
                  <Text style={s.emptyHint}>Tap </Text>
                  <View style={s.plusCircle}><Text style={s.plusCircleText}>+</Text></View>
                  <Text style={s.emptyHint}> to log your first date spot</Text>
                </View>
              </View>
            </View>
          ) : filteredVisits.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No spots match these filters</Text>
              <Pressable onPress={() => { setActivityFilters([]); setPriceFilters([]); setOccasionFilters([]); }}>
                <Text style={s.clearFilter}>Clear filters</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={selectionMode ? visits : filteredVisits}
              keyExtractor={v => v.id}
              renderItem={({ item }) => (
                <SpotRow
                  visit={item}
                  selectionMode={selectionMode}
                  isSelected={selectedIds.has(item.id)}
                  onSelect={() => toggle(item.id)}
                  onLongPress={() => { if (!selectionMode) { enter(); toggle(item.id); } }}
                />
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.listContent}
            />
          )
        )}

        {/* Saved tab */}
        {activeTab === 'saved' && (
          loading ? (
            <ListsSkeleton tab="saved" />
          ) : futureSpots.length === 0 ? (
            <View style={s.empty}>
              <View style={s.emptyIconCircle}>
                <Ionicons name="bookmark" size={20} color="#fff" />
              </View>
              <Text style={s.emptyTitle}>No saved spots yet</Text>
              <View style={s.emptyHintContainer}>
                <Text style={s.emptyHint}>Save spots from the map or Discover tab</Text>
              </View>
            </View>
          ) : filteredFuture.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No spots match these filters</Text>
              <Pressable onPress={() => { setActivityFilters([]); setOccasionFilters([]); }}>
                <Text style={s.clearFilter}>Clear filters</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={filteredFuture}
              keyExtractor={f => f.id}
              renderItem={({ item }) => <FutureSpotRow spot={item} />}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.listContent}
            />
          )
        )}

        {/* Stacks tab */}
        {activeTab === 'stacks' && (
          loading ? (
            <ListsSkeleton tab="stacks" />
          ) : stacks.length === 0 ? (
            <View style={s.empty}>
              <View style={s.emptyIconCircle}>
                <Ionicons name="layers" size={20} color="#fff" />
              </View>
              <Text style={s.emptyTitle}>No stacks yet</Text>
              <View style={s.emptyHintContainer}>
                <View style={s.emptyHintRow}>
                  <Text style={s.emptyHint}>Tap </Text>
                  <View style={s.plusCircle}><Text style={s.plusCircleText}>+</Text></View>
                  <Text style={s.emptyHint}> and select "Create a Stack"</Text>
                </View>
                <Text style={[s.emptyHint, { marginTop: 2 }]}>to group a date night</Text>
              </View>
            </View>
          ) : (
            <FlatList
              data={filteredStacks}
              keyExtractor={st => st.id}
              renderItem={({ item }) => <StackRow stack={item} />}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.listContent}
            />
          )
        )}

        {/* Floating stack bar */}
        {selectionMode && (
          <View style={s.floatingBar}>
            <Pressable
              style={[s.stackBtn, !canStack && s.stackBtnDisabled]}
              onPress={() => canStack && setNaming(true)}
              disabled={!canStack}
            >
              <Ionicons name="layers-outline" size={18} color={canStack ? '#fff' : T.muted} />
              <Text style={[s.stackBtnText, !canStack && s.stackBtnTextDisabled]}>
                Stack these ({selectedIds.size})
              </Text>
            </Pressable>
          </View>
        )}

      </SafeAreaView>

      <SortSheet
        visible={showSortSheet}
        selected={sortBy}
        onSelect={setSortBy}
        onClose={() => setShowSortSheet(false)}
      />

      <FilterSheet
        visible={showFilterSheet}
        currentSort={sortBy}
        currentActivity={activityFilters}
        currentPrice={priceFilters}
        currentOccasion={occasionFilters}
        onApply={(sort, activity, price, occasion) => {
          setSortBy(sort);
          setActivityFilters(activity);
          setPriceFilters(price);
          setOccasionFilters(occasion);
        }}
        onClose={() => setShowFilterSheet(false)}
      />

      {naming && (
        <CreateStackModal
          visitIds={Array.from(selectedIds)}
          onConfirm={handleStackConfirm}
          onCancel={() => setNaming(false)}
        />
      )}
    </TabSlideWrapper>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },

  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  occasionSelector: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  occasionSubtitle: {
    fontSize: 11, fontWeight: '700', color: T.muted, letterSpacing: 1.5,
    marginBottom: 2, alignSelf: 'flex-start',
  },
  occasionTitle: {
    fontSize: 32,
    fontFamily: 'Fraunces-Regular',
    color: T.primary,
    lineHeight: 36,
  },

  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 10,
    paddingTop: 12,
  },
  tabLabel: { fontSize: 15, fontWeight: '700', color: T.muted },
  tabLabelActive: { color: T.primary },
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
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  filterStripInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexGrow: 1,
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
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.accent,
    backgroundColor: T.accentTint,
  },
  activeChipText: { fontSize: 13, fontWeight: '600', color: T.accent },
  sortLabel: { fontSize: 12, color: T.muted, paddingRight: 16, flexShrink: 0 },

  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: T.accentTint,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  selectionHint: { fontSize: 14, fontWeight: '600', color: T.accent },
  cancelSelection: { fontSize: 14, fontWeight: '500', color: T.muted },

  listContent: { paddingBottom: 120 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: T.border,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.bg,
    flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: T.accent, borderColor: T.accent },
  rowMain: { flex: 1, marginRight: 12 },
  rowName: { fontSize: 17, fontWeight: '700', color: T.primary, marginBottom: 4 },
  rowMeta: { fontSize: 13, color: T.muted, marginBottom: 2 },
  rowDate: { fontSize: 12, color: T.muted, marginTop: 4 },
  scorePill: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    backgroundColor: 'transparent',
    minWidth: 42,
    alignItems: 'center',
    flexShrink: 0,
  },
  scoreText: { fontSize: 12, fontWeight: '800' },
  bookmarkPill: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
    backgroundColor: 'transparent',
    minWidth: 42,
    alignItems: 'center',
    flexShrink: 0,
    borderColor: FUTURE_BLUE + '50',
  },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 12 },
  emptyIconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: T.muted,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16, fontWeight: '400', color: T.primary,
    fontFamily: 'Fraunces-Regular', textAlign: 'center',
  },
  emptyHint: { fontSize: 14, color: T.muted, textAlign: 'center' },
  emptyHintContainer: { height: 48, alignItems: 'center', justifyContent: 'center' },
  emptyHintRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
  plusCircle: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#E76F51', borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  plusCircleText: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 14, includeFontPadding: false },
  clearFilter: { fontSize: 14, color: T.accent, fontWeight: '600' },

  stackCategoryPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4, marginBottom: 2 },
  stackCategoryPill: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 8, borderWidth: 1, borderColor: T.border,
    backgroundColor: T.inputBg,
  },
  stackCategoryPillText: { fontSize: 11, fontWeight: '500', color: T.muted },

  floatingBar: { position: 'absolute', bottom: 20, left: 16, right: 16 },
  stackBtn: {
    backgroundColor: T.accent,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: T.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  stackBtnDisabled: { backgroundColor: T.inputBg, shadowOpacity: 0 },
  stackBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  stackBtnTextDisabled: { color: T.muted },
});


const sh = StyleSheet.create({
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
  doneBtn: {
    marginHorizontal: 20, marginTop: 16, marginBottom: 32,
    backgroundColor: T.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  doneBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

const so = StyleSheet.create({
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
  segmentContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: T.inputBg,
    borderRadius: 12,
    padding: 3,
    position: 'relative',
  },
  segmentIndicator: {
    position: 'absolute',
    top: 3, bottom: 3, left: 3,
    borderRadius: 9,
    backgroundColor: T.bg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  segmentText: { fontSize: 14, fontWeight: '500', color: T.muted },
  segmentTextActive: { fontWeight: '700', color: T.primary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginTop: 16 },
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

const ns = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'transparent' },
  sheet: {
    backgroundColor: T.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: T.border, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '400', color: T.primary, fontFamily: 'Fraunces-Regular', marginBottom: 4, textAlign: 'center' },
  subtitle: { fontSize: 13, color: T.muted, textAlign: 'center', marginBottom: 20 },
  input: {
    backgroundColor: T.inputBg, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 16,
    fontSize: 18, fontWeight: '600', color: T.primary,
    marginBottom: 16, textAlign: 'center',
  },
  confirmBtn: { backgroundColor: T.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  confirmBtnDisabled: { backgroundColor: T.inputBg },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  confirmBtnTextDisabled: { color: T.muted },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelBtnText: { fontSize: 15, color: T.muted, fontWeight: '500' },
});

