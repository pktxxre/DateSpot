import { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import {
  StyleSheet, View, Text, ScrollView, Pressable, FlatList,
  Modal, TextInput, Image, Alert, Animated, Dimensions, Easing,
} from 'react-native';
import { useFocusEffect, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  getAllVisits, Visit, ACTIVITY_TYPES, OCCASION_TYPES, PRICE_LABELS, Price,
  formatRating, ratingColor, friendlyDate, ActivityType,
} from '@/lib/visits';
import { getAllFutureSpots, FutureSpot } from '@/lib/future';
import {
  getAllStacks, createStack, deleteStack, StackSummary,
  TierKey, TIER_ORDER, TIER_CONFIG, stackTier,
} from '@/lib/stacks';
import { useSelectionMode } from '@/lib/useSelectionMode';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { T } from '@/lib/theme';
import { SlidingPills } from '@/components/SlidingPills';
import { TabSlideWrapper } from '@/components/TabSlideWrapper';

type TabOption = 'spots' | 'future' | 'date-nights';
type SortOption = 'best' | 'mid' | 'worst' | 'newest' | 'oldest';
type CategoryFilter = string | null; // occasion_type value

const FUTURE_BLUE = '#5856d6';
const FUTURE_BLUE_TINT = `${'#5856d6'}18`;

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'best',   label: 'Best' },
  { value: 'mid',    label: 'Mid' },
  { value: 'worst',  label: 'Worst' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
];

function sortVisits(visits: Visit[], sort: SortOption): Visit[] {
  const copy = [...visits];
  if (sort === 'best')   return copy.sort((a, b) => b.rating - a.rating);
  if (sort === 'worst')  return copy.sort((a, b) => a.rating - b.rating);
  if (sort === 'mid')    return copy.sort((a, b) => Math.abs(a.rating - 5) - Math.abs(b.rating - 5));
  if (sort === 'newest') return copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  if (sort === 'oldest') return copy.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return copy;
}

function autoStackName(): string {
  const now = new Date();
  return now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' Date';
}

// ─── Create Stack Modal (2-step: Name → Tier + Note) ─────────────────────────

function CreateStackModal({ visitIds, onConfirm, onCancel }: {
  visitIds: string[];
  onConfirm: (name: string, tier: TierKey, note: string, coverPhoto: string | null) => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<'name' | 'tier'>('name');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [coverPhoto, setCoverPhoto] = useState<string | null>(null);

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to add a cover photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setCoverPhoto(result.assets[0].uri);
    }
  }

  const firstChar = name.trim()[0] ?? '';

  return (
    <Modal visible animationType="slide" presentationStyle="formSheet" transparent>
      <Pressable style={ns.backdrop} onPress={onCancel}>
        <Pressable style={ns.sheet} onPress={() => {}}>
          <View style={ns.handle} />

          {step === 'name' ? (
            <>
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
                onSubmitEditing={() => name.trim() && setStep('tier')}
              />

              {/* Cover photo picker */}
              <Pressable style={ns.photoPickerRow} onPress={pickPhoto}>
                {coverPhoto ? (
                  <Image source={{ uri: coverPhoto }} style={ns.photoPreview} resizeMode="cover" />
                ) : (
                  <View style={ns.photoPreviewFallback}>
                    {firstChar ? (
                      <Text style={ns.photoPreviewLetter}>{firstChar.toUpperCase()}</Text>
                    ) : (
                      <Ionicons name="image-outline" size={22} color={T.accent} />
                    )}
                  </View>
                )}
                <View style={ns.photoPickerLabel}>
                  <Text style={ns.photoPickerTitle}>
                    {coverPhoto ? 'Change cover photo' : 'Add cover photo'}
                  </Text>
                  <Text style={ns.photoPickerSub}>
                    {coverPhoto ? 'Tap to replace' : 'Optional — defaults to first letter'}
                  </Text>
                </View>
                {coverPhoto && (
                  <Pressable
                    style={ns.photoRemoveBtn}
                    onPress={(e) => { e.stopPropagation(); setCoverPhoto(null); }}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={20} color={T.muted} />
                  </Pressable>
                )}
              </Pressable>

              <Pressable
                style={[ns.confirmBtn, !name.trim() && ns.confirmBtnDisabled]}
                onPress={() => name.trim() && setStep('tier')}
                disabled={!name.trim()}
              >
                <Text style={[ns.confirmBtnText, !name.trim() && ns.confirmBtnTextDisabled]}>
                  Next →
                </Text>
              </Pressable>
              <Pressable style={ns.cancelBtn} onPress={onCancel}>
                <Text style={ns.cancelBtnText}>Cancel</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable style={ns.backRow} onPress={() => setStep('name')}>
                <Ionicons name="chevron-back" size={16} color={T.muted} />
                <Text style={ns.backText}>Back</Text>
              </Pressable>
              <Text style={ns.title}>Place "{name}"</Text>
              <Text style={ns.subtitle}>Tap a tier to place this date night</Text>

              <View style={ns.tierRow}>
                {TIER_ORDER.map(t => {
                  const cfg = TIER_CONFIG[t];
                  return (
                    <Pressable
                      key={t}
                      style={[ns.tierBtn, { borderColor: T.border }]}
                      onPress={() => onConfirm(name.trim(), t, note, coverPhoto)}
                    >
                      <View style={[ns.tierBadge, { backgroundColor: cfg.bg }]}>
                        <Text style={ns.tierBadgeText}>{t}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <TextInput
                style={ns.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="Why this tier? (optional)"
                placeholderTextColor={T.placeholder}
                returnKeyType="done"
                multiline
              />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Stack Card Fly-in Animation ─────────────────────────────────────────────

type FlyData = { tier: TierKey; name: string; spotCount: number; photoUrl: string | null };

// Approximate Y centre of each tier row from top of screen (header ~80 + tabs ~50 + new-stack btn ~52 + rows ~72 each)
const TIER_ROW_Y: Record<TierKey, number> = { S: 218, A: 290, B: 362, C: 434, F: 506 };

function StackFlyAnimation({ data, onDone }: { data: FlyData; onDone: () => void }) {
  const cfg = TIER_CONFIG[data.tier];
  const { width, height } = Dimensions.get('window');
  const centerY = height / 2;
  const deltaY = TIER_ROW_Y[data.tier] - centerY;
  const deltaX = -(width * 0.32);

  const scale = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 200 }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]),
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(scale, { toValue: 0, duration: 480, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
        Animated.timing(translateY, { toValue: deltaY, duration: 480, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
        Animated.timing(translateX, { toValue: deltaX, duration: 480, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
        Animated.timing(opacity, { toValue: 0, duration: 380, useNativeDriver: true }),
      ]),
    ]).start(onDone);
  }, []);

  return (
    <View style={fly.overlay} pointerEvents="none">
      <Animated.View style={[fly.tile, { transform: [{ scale }, { translateY }, { translateX }], opacity }]}>
        {data.photoUrl ? (
          <Image source={{ uri: data.photoUrl }} style={fly.tileImage} resizeMode="cover" />
        ) : (
          <View style={[fly.tileImage, fly.tileFallback, { backgroundColor: cfg.bg }]}>
            <Text style={fly.tileFallbackText}>{data.tier}</Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Tier Row ─────────────────────────────────────────────────────────────────

function TierRow({ tier, stacks, bounce }: { tier: TierKey; stacks: StackSummary[]; bounce?: boolean }) {
  const cfg = TIER_CONFIG[tier];
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!bounce) return;
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.06, useNativeDriver: true, damping: 6, stiffness: 300 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 200 }),
    ]).start();
  }, [bounce]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
    <Pressable
      style={({ pressed }) => [tc.row, pressed && { opacity: 0.75 }]}
      onPress={() => router.push(`/tier/${tier}` as any)}
      accessibilityRole="button"
      accessibilityLabel={`${tier} tier, ${stacks.length} stacks`}
    >
      {/* Colour wash */}
      <View style={[tc.wash, { backgroundColor: cfg.bg }]} />

      {/* Left: badge + count */}
      <View style={tc.badgeWrap}>
        <View style={[tc.badge, { backgroundColor: cfg.bg }]}>
          <Text style={[tc.badgeText, { color: cfg.text }]}>{tier}</Text>
        </View>
        <Text style={tc.stackCount}>
          {stacks.length} {stacks.length === 1 ? 'Stack' : 'Stacks'}
        </Text>
      </View>

      {/* Divider */}
      <View style={tc.divider} />

      {/* Right: photos top-left, chevron far right */}
      <View style={tc.photoArea}>
        {stacks.map((s, i) =>
          s.cover_photo ? (
            <Image key={s.id} source={{ uri: s.cover_photo }} style={tc.photo} resizeMode="cover" />
          ) : (
            <View key={s.id} style={tc.photoPlaceholder}>
              <Text style={tc.photoPlaceholderText}>{s.name.trim()[0] ?? '?'}</Text>
            </View>
          )
        )}
      </View>

      <Ionicons name="chevron-forward" size={14} color={T.muted} style={tc.chevron} />
    </Pressable>
    </Animated.View>
  );
}

// ─── Spot Row with selection support ─────────────────────────────────────────

function SpotRow({ visit, rank, selectionMode, isSelected, onSelect, onLongPress }: {
  visit: Visit;
  rank?: number;
  selectionMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onLongPress: () => void;
}) {
  const info = ACTIVITY_TYPES.find(a => a.value === visit.activity_type);
  const priceLabel = PRICE_LABELS[visit.price as Price];
  const dateStr = friendlyDate(visit.visited_at || visit.created_at);
  const color = ratingColor(visit.rating);

  const metaParts = [
    info?.label,
    visit.price === 0 ? 'Free' : priceLabel,
    dateStr,
  ].filter(Boolean);

  return (
    <Pressable
      style={({ pressed }) => [s.row, pressed && { opacity: 0.75 }]}
      onPress={selectionMode ? onSelect : () => router.push(`/spot/${visit.id}`)}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityLabel={`${isSelected ? 'Selected' : 'Not selected'}, ${visit.venue_name}`}
    >
      <View style={[s.rowLeftBar, { backgroundColor: color }]} />
      {selectionMode ? (
        <View style={[s.checkbox, isSelected && s.checkboxChecked]}>
          {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
      ) : rank !== undefined ? (
        <Text style={s.rowRank}>{rank}</Text>
      ) : null}
      <View style={s.rowMain}>
        <View style={s.rowTop}>
          <Text style={s.rowName} numberOfLines={1}>{visit.venue_name}</Text>
          {visit.rating > 0 && (
            <View style={[s.scorePill, { borderColor: color }]}>
              <Text style={[s.scorePillText, { color }]}>{formatRating(visit.rating)}</Text>
            </View>
          )}
        </View>
        <Text style={s.rowMeta} numberOfLines={1}>{metaParts.join(' · ')}</Text>
        {visit.notes ? (
          <Text style={s.note} numberOfLines={1}>"{visit.notes.trim().slice(0, 70)}"</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ─── Future Spot Row ──────────────────────────────────────────────────────────

function FutureSpotRow({ spot }: { spot: FutureSpot }) {
  const categoryInfo = ACTIVITY_TYPES.find(a => a.value === spot.activity_type);
  const occasionInfo = OCCASION_TYPES.find(a => a.value === spot.occasion_type);
  const dateStr = friendlyDate(spot.created_at);
  const metaParts = [categoryInfo?.label, occasionInfo?.label, dateStr].filter(Boolean);

  return (
    <Pressable
      style={({ pressed }) => [s.row, pressed && { opacity: 0.75 }]}
      onPress={() => router.push(`/future/${spot.id}` as any)}
    >
      <View style={[s.rowLeftBar, { backgroundColor: FUTURE_BLUE }]} />
      <View style={s.rowMain}>
        <View style={s.rowTop}>
          <Text style={s.rowName} numberOfLines={1}>{spot.venue_name}</Text>
        </View>
        <Text style={s.rowMeta} numberOfLines={1}>{metaParts.join(' · ')}</Text>
      </View>
      <View style={s.futureBadge}>
        <Ionicons name="bookmark-outline" size={11} color={T.muted} />
        <Text style={s.futureBadgeText}>Want to go</Text>
      </View>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RankedScreen() {
  const [activeTab, setActiveTab] = useState<TabOption>('spots');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [stacks, setStacks] = useState<StackSummary[]>([]);
  const [sort, setSort] = useState<SortOption>('best');
  const [category, setCategory] = useState<CategoryFilter>(null);
  const [activityFilter, setActivityFilter] = useState<ActivityType | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [futureSpots, setFutureSpots] = useState<FutureSpot[]>([]);
  const [futureOccasion, setFutureOccasion] = useState<string | null>(null);
  const [futureActivityFilter, setFutureActivityFilter] = useState<ActivityType | null>(null);
  const [showFutureCategoryPicker, setShowFutureCategoryPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [naming, setNaming] = useState(false);
  const [flyData, setFlyData] = useState<FlyData | null>(null);
  const [bounceTier, setBounceTier] = useState<TierKey | null>(null);

  const { selectionMode, selectedIds, enter, exit, toggle, canStack } = useSelectionMode();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const flatListRef = useRef<FlatList>(null);
  const dateNightsScrollRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      dateNightsScrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
      setVisits(getAllVisits().filter(v => !(v as any).is_seed));
      setStacks(getAllStacks());
      setFutureSpots(getAllFutureSpots());
      if (tab === 'date-nights') setActiveTab('date-nights');
    }, [tab])
  );

  function handleTabChange(tab: TabOption) {
    setActiveTab(tab);
    if (tab === 'date-nights') setStacks(getAllStacks());
    if (tab === 'spots') exit();
  }

  const categoryCounts: Record<string, number> = {};
  for (const v of visits) {
    categoryCounts[v.occasion_type] = (categoryCounts[v.occasion_type] ?? 0) + 1;
  }

  const stacksByTier = useMemo(() => {
    const groups: Record<TierKey, StackSummary[]> = { S: [], A: [], B: [], C: [], F: [] };
    for (const stack of stacks) {
      groups[stackTier(stack)].push(stack);
    }
    return groups;
  }, [stacks]);

  const filtered = useMemo(() => {
    let list = category ? visits.filter(v => v.occasion_type === category) : visits;
    if (activityFilter) list = list.filter(v => v.activity_type === activityFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(v =>
        v.venue_name.toLowerCase().includes(q) ||
        (v.notes ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [visits, category, activityFilter, search]);
  const sorted = sortVisits(filtered, sort);

  const filteredFuture = useMemo(() => {
    let list = futureOccasion
      ? futureSpots.filter(f => f.occasion_type === futureOccasion)
      : futureSpots;
    if (futureActivityFilter) list = list.filter(f => f.activity_type === futureActivityFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(f => f.venue_name.toLowerCase().includes(q));
    }
    return list;
  }, [futureSpots, futureOccasion, futureActivityFilter, search]);

  const futureOccasionCounts: Record<string, number> = {};
  for (const f of futureSpots) {
    if (f.occasion_type) {
      futureOccasionCounts[f.occasion_type] = (futureOccasionCounts[f.occasion_type] ?? 0) + 1;
    }
  }

  function handleStackConfirm(name: string, tier: TierKey, note: string, coverPhoto: string | null) {
    const visitIds = Array.from(selectedIds);
    const spotCount = visitIds.length;
    createStack(name, visitIds, tier, note, coverPhoto);
    setNaming(false);
    exit();
    const updatedStacks = getAllStacks();
    const photoUrl = updatedStacks.find(s => s.name === name)?.cover_photo ?? null;
    setActiveTab('date-nights');
    setFlyData({ tier, name, spotCount, photoUrl });
  }

  function handleNewStackFromDateNights() {
    setActiveTab('spots');
    enter();
  }

  return (
    <TabSlideWrapper myIndex={1}>
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.statLabel}>
            {activeTab === 'spots'
              ? `${visits.length} SPOTS LOGGED`
              : activeTab === 'future'
              ? `${futureSpots.length} SAVED`
              : `${stacks.length} DATE NIGHTS`}
          </Text>
          <Text style={s.statNum}>Your list</Text>
        </View>
        <ProfileAvatar onPress={() => router.push('/(tabs)/profile')} />
      </View>

      {/* Tab toggle */}
      <View style={s.tabRow}>
        <SlidingPills
          options={[
            { label: 'Spots', value: 'spots' },
            { label: 'Future', value: 'future' },
            { label: 'Date Nights', value: 'date-nights' },
          ]}
          value={activeTab}
          onChange={v => handleTabChange(v as TabOption)}
        />
      </View>

      {/* ── Spots Tab ── */}
      {activeTab === 'spots' && (
        <View style={{ flex: 1 }}>
          {/* Search + filter always visible at top */}
          {!selectionMode && (
            <>
              <View style={s.searchBar}>
                <Ionicons name="search-outline" size={16} color={T.placeholder} style={{ marginRight: 8 }} />
                <TextInput
                  style={s.searchInput}
                  placeholder="Search your spots and notes"
                  placeholderTextColor={T.placeholder}
                  value={search}
                  onChangeText={setSearch}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                />
              </View>
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
                {OCCASION_TYPES.map(a => {
                  const active = category === a.value;
                  return (
                    <Pressable
                      key={a.value}
                      style={[s.chip, active && s.chipActive]}
                      onPress={() => setCategory(active ? null : a.value)}
                    >
                      <Text style={[s.chipText, active && s.chipTextActive]}>{a.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}

          {selectionMode && (
            <View style={s.selectionHeader}>
              <Text style={s.selectionHint}>
                {selectedIds.size === 0
                  ? 'Tap spots to select'
                  : `${selectedIds.size} selected`}
              </Text>
              <Pressable onPress={exit} hitSlop={8}>
                <Text style={s.cancelSelection}>Cancel</Text>
              </Pressable>
            </View>
          )}

          {visits.length === 0 && !selectionMode && category !== 'future' ? (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No dates logged yet</Text>
              <View style={s.emptyHintRow}>
                <Text style={s.emptyHint}>Tap </Text>
                <View style={s.plusCircle}><Text style={s.plusCircleText}>+</Text></View>
                <Text style={s.emptyHint}> below to log your first date spot</Text>
              </View>
            </View>
          ) : (
            <>
              {!selectionMode && (
                <View style={s.sortRow}>
                  <Text style={s.countLabel}>
                    {sorted.length} spot{sorted.length !== 1 ? 's' : ''}
                  </Text>
                  <View style={s.sortButtons}>
                    <Pressable style={s.sortToggle} onPress={() => setShowSortPicker(true)}>
                      <Text style={s.sortToggleText}>
                        {SORT_OPTIONS.find(o => o.value === sort)?.label ?? 'Best'} ↓
                      </Text>
                    </Pressable>
                    <Pressable style={s.sortToggle} onPress={() => setShowCategoryPicker(true)}>
                      <Text style={[s.sortToggleText, activityFilter && s.sortToggleActive]}>
                        {activityFilter
                          ? (ACTIVITY_TYPES.find(a => a.value === activityFilter)?.label ?? 'Category')
                          : 'Category'} ↓
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {sorted.length === 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptyTitle}>
                    {activityFilter
                      ? `No ${ACTIVITY_TYPES.find(a => a.value === activityFilter)?.label} spots`
                      : `No ${OCCASION_TYPES.find(a => a.value === category)?.label ?? ''} spots yet`}
                  </Text>
                  <Pressable onPress={() => { setCategory(null); setActivityFilter(null); }}>
                    <Text style={s.clearFilter}>Clear filter</Text>
                  </Pressable>
                </View>
              ) : (
                <FlatList
                  ref={flatListRef}
                  data={selectionMode ? visits : sorted}
                  keyExtractor={v => v.id}
                  renderItem={({ item, index }) => (
                    <SpotRow
                      visit={item}
                      rank={selectionMode ? undefined : index + 1}
                      selectionMode={selectionMode}
                      isSelected={selectedIds.has(item.id)}
                      onSelect={() => toggle(item.id)}
                      onLongPress={() => { if (!selectionMode) { enter(); toggle(item.id); } }}
                    />
                  )}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={s.listContent}
                />
              )}
            </>
          )}

          {/* Floating stack action bar */}
          {selectionMode && (
            <View style={s.floatingBar}>
              <Pressable
                style={[s.stackBtn, !canStack && s.stackBtnDisabled]}
                onPress={() => canStack && setNaming(true)}
                disabled={!canStack}
                accessibilityRole="button"
                accessibilityLabel={`Stack these, ${selectedIds.size} selected`}
              >
                <Ionicons
                  name="layers-outline"
                  size={18}
                  color={canStack ? '#fff' : T.muted}
                />
                <Text style={[s.stackBtnText, !canStack && s.stackBtnTextDisabled]}>
                  Stack these ({selectedIds.size})
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* ── Future Tab ── */}
      {activeTab === 'future' && (
        <View style={{ flex: 1 }}>
          <View style={s.searchBar}>
            <Ionicons name="search-outline" size={16} color={T.placeholder} style={{ marginRight: 8 }} />
            <TextInput
              style={s.searchInput}
              placeholder="Search future spots"
              placeholderTextColor={T.placeholder}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.chipScroll}
            contentContainerStyle={s.chipRow}
          >
            <Pressable
              style={[s.chip, futureOccasion === null && s.chipFutureActive]}
              onPress={() => setFutureOccasion(null)}
            >
              <Text style={[s.chipText, futureOccasion === null && s.chipTextFutureActive]}>All</Text>
            </Pressable>
            {OCCASION_TYPES.map(oc => {
              const active = futureOccasion === oc.value;
              return (
                <Pressable
                  key={oc.value}
                  style={[s.chip, active && s.chipFutureActive]}
                  onPress={() => setFutureOccasion(active ? null : oc.value)}
                >
                  <Text style={[s.chipText, active && s.chipTextFutureActive]}>{oc.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={s.sortRow}>
            <Text style={s.countLabel}>
              {filteredFuture.length} spot{filteredFuture.length !== 1 ? 's' : ''}
            </Text>
            <Pressable style={s.sortToggle} onPress={() => setShowFutureCategoryPicker(true)}>
              <Text style={[s.sortToggleText, futureActivityFilter && s.sortToggleActive]}>
                {futureActivityFilter
                  ? (ACTIVITY_TYPES.find(a => a.value === futureActivityFilter)?.label ?? 'Category')
                  : 'Category'} ↓
              </Text>
            </Pressable>
          </View>

          {futureSpots.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="bookmark-outline" size={36} color={T.muted} style={{ marginBottom: 12 }} />
              <Text style={s.emptyTitle}>No future spots yet</Text>
              <Text style={s.emptyHint}>Save spots from the map or Discover tab</Text>
            </View>
          ) : filteredFuture.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyTitle}>No spots match this filter</Text>
              <Pressable onPress={() => { setFutureOccasion(null); setFutureActivityFilter(null); }}>
                <Text style={[s.clearFilter, { color: FUTURE_BLUE }]}>Clear filters</Text>
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
          )}
        </View>
      )}

      {/* ── Date Nights Tab ── */}
      {activeTab === 'date-nights' && (
        <View style={{ flex: 1 }}>
          {stacks.length === 0 ? (
            <View style={s.emptyDateNights}>
              <Ionicons name="layers-outline" size={36} color={T.muted} style={{ marginBottom: 12 }} />
              <Text style={s.emptyTitle}>No stacks yet</Text>
              <Text style={s.emptySubtitle}>
                Group spots from the same date night into a single story.
              </Text>
              <Pressable style={s.tryItBtn} onPress={handleNewStackFromDateNights}>
                <Text style={s.tryItBtnText}>Try it</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={s.dateNightsToolbar}>
                <Text style={s.dnCount}>{stacks.length} stack{stacks.length !== 1 ? 's' : ''}</Text>
                <Pressable style={s.newStackBtn} onPress={handleNewStackFromDateNights}>
                  <Ionicons name="add" size={16} color={T.accent} />
                  <Text style={s.newStackBtnText}>New Stack</Text>
                </Pressable>
              </View>
              <ScrollView
                ref={dateNightsScrollRef}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.listContent}
              >
                {TIER_ORDER.map(tier => (
                  <TierRow
                    key={tier}
                    tier={tier}
                    stacks={stacksByTier[tier]}
                    bounce={bounceTier === tier}
                  />
                ))}
              </ScrollView>
            </>
          )}
        </View>
      )}

      {naming && (
        <CreateStackModal
          visitIds={Array.from(selectedIds)}
          onConfirm={handleStackConfirm}
          onCancel={() => setNaming(false)}
        />
      )}
      {showSortPicker && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowSortPicker(false)}>
          <Pressable style={cp.backdrop} onPress={() => setShowSortPicker(false)}>
            <Pressable style={cp.card} onPress={() => {}}>
              <Text style={cp.title}>Sort by</Text>
              {SORT_OPTIONS.map(o => (
                <Pressable
                  key={o.value}
                  style={[cp.option, sort === o.value && cp.optionActive]}
                  onPress={() => { setSort(o.value); setShowSortPicker(false); }}
                >
                  <Text style={[cp.optionText, sort === o.value && cp.optionTextActive]}>{o.label}</Text>
                  {sort === o.value && <Ionicons name="checkmark" size={16} color={T.accent} />}
                </Pressable>
              ))}
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {showCategoryPicker && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowCategoryPicker(false)}>
          <Pressable style={cp.backdrop} onPress={() => setShowCategoryPicker(false)}>
            <Pressable style={cp.card} onPress={() => {}}>
              <Text style={cp.title}>Filter by category</Text>
              <Pressable
                style={[cp.option, activityFilter === null && cp.optionActive]}
                onPress={() => { setActivityFilter(null); setShowCategoryPicker(false); }}
              >
                <Text style={[cp.optionText, activityFilter === null && cp.optionTextActive]}>All categories</Text>
                {activityFilter === null && <Ionicons name="checkmark" size={16} color={T.accent} />}
              </Pressable>
              {ACTIVITY_TYPES.map(a => (
                <Pressable
                  key={a.value}
                  style={[cp.option, activityFilter === a.value && cp.optionActive]}
                  onPress={() => { setActivityFilter(a.value as ActivityType); setShowCategoryPicker(false); }}
                >
                  <Text style={[cp.optionText, activityFilter === a.value && cp.optionTextActive]}>{a.label}</Text>
                  {activityFilter === a.value && <Ionicons name="checkmark" size={16} color={T.accent} />}
                </Pressable>
              ))}
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {showFutureCategoryPicker && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setShowFutureCategoryPicker(false)}>
          <Pressable style={cp.backdrop} onPress={() => setShowFutureCategoryPicker(false)}>
            <Pressable style={cp.card} onPress={() => {}}>
              <Text style={cp.title}>Filter by category</Text>
              <Pressable
                style={[cp.option, futureActivityFilter === null && cp.optionActive]}
                onPress={() => { setFutureActivityFilter(null); setShowFutureCategoryPicker(false); }}
              >
                <Text style={[cp.optionText, futureActivityFilter === null && cp.optionTextActive]}>All categories</Text>
                {futureActivityFilter === null && <Ionicons name="checkmark" size={16} color={T.accent} />}
              </Pressable>
              {ACTIVITY_TYPES.map(a => (
                <Pressable
                  key={a.value}
                  style={[cp.option, futureActivityFilter === a.value && cp.optionActive]}
                  onPress={() => { setFutureActivityFilter(a.value as ActivityType); setShowFutureCategoryPicker(false); }}
                >
                  <Text style={[cp.optionText, futureActivityFilter === a.value && cp.optionTextActive]}>{a.label}</Text>
                  {futureActivityFilter === a.value && <Ionicons name="checkmark" size={16} color={T.accent} />}
                </Pressable>
              ))}
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {flyData && (
        <StackFlyAnimation
          data={flyData}
          onDone={() => {
            const tier = flyData.tier;
            setFlyData(null);
            setStacks(getAllStacks());
            setBounceTier(tier);
            setTimeout(() => setBounceTier(null), 800);
          }}
        />
      )}
    </SafeAreaView>
    </TabSlideWrapper>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },

  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: T.bg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  statNum: {
    fontSize: 32,
    fontWeight: '700',
    color: T.primary,
    fontFamily: 'InstrumentSerif-Regular',
    lineHeight: 36,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: T.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: T.primary,
  },

  tabRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: T.bg,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },

  chipScroll: { flexShrink: 0, flexGrow: 0 },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.border,
    alignSelf: 'center',
  },
  chipActive: { backgroundColor: 'rgba(231,111,81,0.12)', borderColor: '#E76F51' },
  chipText: { fontSize: 13, fontWeight: '600', color: T.muted },
  chipTextActive: { color: '#E76F51' },

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
  sortToggle: { paddingVertical: 4, paddingHorizontal: 2 },
  sortToggleText: { fontSize: 13, fontWeight: '600', color: T.primary },

  selectionHeader: {
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
    paddingVertical: 14,
    paddingRight: 16,
    paddingLeft: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  rowLeftBar: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: 12,
  },
  rowRank: {
    width: 24,
    fontSize: 12,
    fontWeight: '500',
    color: T.muted,
    textAlign: 'right',
    marginRight: 10,
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
  },
  checkboxChecked: { backgroundColor: T.accent, borderColor: T.accent },
  rowMain: { flex: 1 },
  rowTop: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 3,
  },
  rowName: {
    fontSize: 15, fontWeight: '600', color: T.primary,
    fontFamily: 'InstrumentSerif-Regular', flex: 1, marginRight: 10,
  },
  scorePill: {
    borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3,
    backgroundColor: 'transparent', minWidth: 42, alignItems: 'center',
  },
  scorePillText: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  rowMeta: { fontSize: 12, color: T.muted, marginBottom: 3 },
  note: { fontSize: 12, color: '#A0927E', fontStyle: 'italic', lineHeight: 17 },

  floatingBar: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
  },
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

  // Date Nights tab
  dateNightsToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  dnCount: { fontSize: 13, color: T.muted },
  newStackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.accent,
    backgroundColor: T.accentTint,
  },
  newStackBtnText: { fontSize: 13, fontWeight: '600', color: T.accent },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyInvite: { alignItems: 'center' },
  emptyDateNights: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 16, fontWeight: '700', color: T.primary,
    fontFamily: 'InstrumentSerif-Regular', textAlign: 'center',
  },
  emptySubtitle: { fontSize: 14, color: T.muted, textAlign: 'center', lineHeight: 20, marginTop: 4 },
  tryItBtn: {
    marginTop: 16,
    backgroundColor: T.accent,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  tryItBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  clearFilter: { fontSize: 14, color: T.accent, fontWeight: '600' },
  emptyHintRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
  emptyHint: { fontSize: 14, color: T.muted, textAlign: 'center' },

  chipFutureActive: { backgroundColor: FUTURE_BLUE_TINT, borderColor: FUTURE_BLUE },
  chipTextFutureActive: { color: FUTURE_BLUE },

  futureBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10, borderWidth: 1, borderColor: T.border,
    alignSelf: 'center', marginRight: 12,
  },
  futureBadgeText: { fontSize: 11, fontWeight: '600', color: T.muted },

  sortButtons: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sortToggleActive: { color: T.accent },

  plusCircle: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#E76F51',
    borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  plusCircleText: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 14, includeFontPadding: false },
});

const tc = StyleSheet.create({
  row: {
    marginHorizontal: 16,
    marginVertical: 4,
    backgroundColor: T.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: T.border,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    height: 96,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  wash: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0.07,
  },
  badgeWrap: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    zIndex: 1,
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  badgeText: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -1,
  },
  stackCount: {
    fontSize: 9,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: T.border,
    marginVertical: 14,
    zIndex: 1,
  },
  photoArea: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 5,
    paddingHorizontal: 12,
    paddingTop: 12,
    alignItems: 'flex-start',
    overflow: 'hidden',
    zIndex: 1,
  },
  photo: {
    width: 30,
    height: 30,
    borderRadius: 7,
    backgroundColor: T.inputBg,
    flexShrink: 0,
  },
  photoPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 7,
    backgroundColor: T.accentTint,
    borderWidth: 1,
    borderColor: T.accent,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderText: {
    fontSize: 13,
    fontWeight: '600',
    color: T.accent,
    textTransform: 'uppercase',
  },
  chevron: {
    alignSelf: 'center',
    paddingRight: 14,
    zIndex: 1,
  },
});

const ns = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  sheet: {
    backgroundColor: T.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: T.border, alignSelf: 'center', marginBottom: 20,
  },
  title: {
    fontSize: 20, fontWeight: '700', color: T.primary,
    fontFamily: 'InstrumentSerif-Regular', marginBottom: 4, textAlign: 'center',
  },
  subtitle: { fontSize: 13, color: T.muted, textAlign: 'center', marginBottom: 20 },
  input: {
    backgroundColor: T.inputBg, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 16,
    fontSize: 18, fontWeight: '600', color: T.primary,
    marginBottom: 16, textAlign: 'center',
  },
  confirmBtn: {
    backgroundColor: T.accent, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 10,
  },
  confirmBtnDisabled: { backgroundColor: T.inputBg },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  confirmBtnTextDisabled: { color: T.muted },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelBtnText: { fontSize: 15, color: T.muted, fontWeight: '500' },
  // Photo picker row
  photoPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: T.accentTint,
    borderWidth: 1,
    borderColor: T.accent,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  photoPreview: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: T.inputBg,
  },
  photoPreviewFallback: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPreviewLetter: {
    fontSize: 22,
    fontWeight: '700',
    color: T.accent,
  },
  photoPickerLabel: { flex: 1 },
  photoPickerTitle: { fontSize: 14, fontWeight: '600', color: T.accent },
  photoPickerSub: { fontSize: 12, color: T.muted, marginTop: 2 },
  photoRemoveBtn: { padding: 4 },
  // Tier step
  backRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginBottom: 16, alignSelf: 'flex-start',
  },
  backText: { fontSize: 14, color: T.muted, fontWeight: '500' },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  tierBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: T.border,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: T.card,
  },
  tierBtnSelected: {
    backgroundColor: T.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  tierBadge: {
    width: 40, height: 40, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  tierBadgeText: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  noteInput: {
    backgroundColor: T.inputBg, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 14, color: T.primary,
    marginBottom: 16, minHeight: 70,
    textAlignVertical: 'top',
  },
});

const fly = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 999,
  },
  tile: {
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22, shadowRadius: 20,
  },
  tileImage: { width: 110, height: 110, borderRadius: 26 },
  tileFallback: { alignItems: 'center', justifyContent: 'center' },
  tileFallbackText: { fontSize: 44, fontWeight: '800', color: '#fff', letterSpacing: -2 },
});

const cp = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  card: {
    backgroundColor: T.bg,
    borderRadius: 20,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  optionActive: { backgroundColor: T.accentTint },
  optionText: { fontSize: 15, fontWeight: '500', color: T.primary },
  optionTextActive: { fontWeight: '600', color: T.accent },
});
