import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, Pressable, FlatList, ScrollView,
  Modal, TextInput, Image, Alert, Animated, Dimensions, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  getAllVisits, Visit, ACTIVITY_TYPES, OCCASION_TYPES, PRICE_LABELS, Price,
  formatRating, ratingColor, friendlyDate, ActivityType,
} from '@/lib/visits';
import {
  getAllStacks, createStack, StackSummary, TierKey, TIER_ORDER, TIER_CONFIG, stackTier,
} from '@/lib/stacks';
import { useSelectionMode } from '@/lib/useSelectionMode';
import { T } from '@/lib/theme';

type SortOption = 'best' | 'newest' | 'oldest' | 'worst';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'best', label: 'Best' },
  { value: 'worst', label: 'Worst' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
];

function sortVisits(visits: Visit[], sort: SortOption): Visit[] {
  const copy = [...visits];
  if (sort === 'best') return copy.sort((a, b) => b.rating - a.rating);
  if (sort === 'worst') return copy.sort((a, b) => a.rating - b.rating);
  if (sort === 'newest') return copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  if (sort === 'oldest') return copy.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return copy;
}

// ─── Create Stack Modal ───────────────────────────────────────────────────────

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
                  <Text style={ns.photoPickerTitle}>{coverPhoto ? 'Change cover photo' : 'Add cover photo'}</Text>
                  <Text style={ns.photoPickerSub}>{coverPhoto ? 'Tap to replace' : 'Optional — defaults to first letter'}</Text>
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
                <Text style={[ns.confirmBtnText, !name.trim() && ns.confirmBtnTextDisabled]}>Next →</Text>
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

// ─── Stack Fly Animation ──────────────────────────────────────────────────────

type FlyData = { tier: TierKey; name: string; spotCount: number; photoUrl: string | null };

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

// ─── Spot Row ─────────────────────────────────────────────────────────────────

function SpotRow({ visit, selectionMode, isSelected, onSelect, onLongPress }: {
  visit: Visit;
  selectionMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onLongPress: () => void;
}) {
  const info = ACTIVITY_TYPES.find(a => a.value === visit.activity_type);
  const priceLabel = visit.price > 0 ? PRICE_LABELS[visit.price as Price] : null;
  const occasionInfo = OCCASION_TYPES.find(a => a.value === visit.occasion_type);
  const dateStr = friendlyDate(visit.visited_at || visit.created_at);
  const color = ratingColor(visit.rating);
  const metaLine = [priceLabel, info?.label, occasionInfo?.label].filter(Boolean).join(' · ');

  return (
    <Pressable
      style={({ pressed }) => [s.row, pressed && { opacity: 0.75 }]}
      onPress={selectionMode ? onSelect : () => router.push(`/spot/${visit.id}`)}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityLabel={`${isSelected ? 'Selected' : 'Not selected'}, ${visit.venue_name}`}
    >
      {selectionMode && (
        <View style={[s.checkbox, isSelected && s.checkboxChecked]}>
          {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>
      )}
      <View style={s.rowMain}>
        <Text style={s.rowName} numberOfLines={1}>{visit.venue_name}</Text>
        <Text style={s.rowMeta} numberOfLines={1}>{metaLine}</Text>
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MySpotsScreen() {
  const { select } = useLocalSearchParams<{ select?: string }>();
  const [visits, setVisits] = useState<Visit[]>(() => getAllVisits().filter(v => !(v as any).is_seed));
  const [sort, setSort] = useState<SortOption>('best');
  const [categories, setCategories] = useState<string[]>([]);
  const [activityFilters, setActivityFilters] = useState<ActivityType[]>([]);
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [naming, setNaming] = useState(false);
  const [flyData, setFlyData] = useState<FlyData | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const { selectionMode, selectedIds, enter, exit, toggle, canStack } = useSelectionMode();

  useFocusEffect(
    useCallback(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      setVisits(getAllVisits().filter(v => !(v as any).is_seed));
      if (select === 'true') {
        enter();
      }
    }, [select])
  );

  function toggleCategory(val: string) {
    setCategories(prev => prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val]);
  }
  function toggleActivity(val: ActivityType) {
    setActivityFilters(prev => prev.includes(val) ? prev.filter(c => c !== val) : [...prev, val]);
  }

  const filtered = useMemo(() => {
    let list = visits;
    if (categories.length > 0) list = list.filter(v => categories.includes(v.occasion_type));
    if (activityFilters.length > 0) list = list.filter(v => activityFilters.includes(v.activity_type));
    return list;
  }, [visits, categories, activityFilters]);

  const sorted = sortVisits(filtered, sort);

  function handleStackConfirm(name: string, tier: TierKey, note: string, coverPhoto: string | null) {
    const visitIds = Array.from(selectedIds);
    const spotCount = visitIds.length;
    createStack(name, visitIds, tier, note, coverPhoto);
    setNaming(false);
    exit();
    const updatedStacks = getAllStacks();
    const photoUrl = updatedStacks.find(s => s.name === name)?.cover_photo ?? null;
    setFlyData({ tier, name, spotCount, photoUrl });
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={T.primary} />
          </Pressable>
          <Text style={s.title}>Your Spots</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Occasion filter chips */}
        {!selectionMode && (
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
        )}

        {/* Activity filter chips */}
        {!selectionMode && (
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
        )}

        {selectionMode && (
          <View style={s.selectionHeader}>
            <Text style={s.selectionHint}>
              {selectedIds.size === 0 ? 'Tap spots to select' : `${selectedIds.size} selected`}
            </Text>
            <Pressable onPress={exit} hitSlop={8}>
              <Text style={s.cancelSelection}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {/* Sort row */}
        {!selectionMode && (
          <View style={s.sortRow}>
            <Text style={s.countLabel}>{sorted.length} spot{sorted.length !== 1 ? 's' : ''}</Text>
            <Pressable style={s.sortToggle} onPress={() => setShowSortPicker(true)}>
              <Text style={s.sortToggleText}>{SORT_OPTIONS.find(o => o.value === sort)?.label ?? 'Best'} ↓</Text>
            </Pressable>
          </View>
        )}

        {visits.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No spots logged yet</Text>
            <Text style={s.emptyHint}>Tap + to log your first date spot</Text>
          </View>
        ) : sorted.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No spots match these filters</Text>
            <Pressable onPress={() => { setCategories([]); setActivityFilters([]); }}>
              <Text style={s.clearFilter}>Clear filters</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={selectionMode ? visits : sorted}
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
        )}

        {selectionMode && (
          <View style={s.floatingBar}>
            <Pressable
              style={[s.stackBtn, !canStack && s.stackBtnDisabled]}
              onPress={() => canStack && setNaming(true)}
              disabled={!canStack}
              accessibilityRole="button"
            >
              <Ionicons name="layers-outline" size={18} color={canStack ? '#fff' : T.muted} />
              <Text style={[s.stackBtnText, !canStack && s.stackBtnTextDisabled]}>
                Stack these ({selectedIds.size})
              </Text>
            </Pressable>
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

        {flyData && (
          <StackFlyAnimation
            data={flyData}
            onDone={() => {
              setFlyData(null);
              router.push('/my-date-nights' as any);
            }}
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
  chipActive: { backgroundColor: 'rgba(231,111,81,0.12)', borderColor: T.accent },
  chipText: { fontSize: 13, fontWeight: '600', color: T.muted },
  chipTextActive: { color: T.accent },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  countLabel: { fontSize: 13, color: T.muted },
  sortToggle: { paddingVertical: 4 },
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
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
    backgroundColor: 'transparent',
    minWidth: 42,
    alignItems: 'center',
    flexShrink: 0,
  },
  scoreText: { fontSize: 12, fontWeight: '800' },
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '400', color: T.primary, fontFamily: 'Fraunces-Regular', textAlign: 'center' },
  emptyHint: { fontSize: 14, color: T.muted, textAlign: 'center' },
  clearFilter: { fontSize: 14, color: T.accent, fontWeight: '600' },
});

const ns = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'transparent' },
  sheet: {
    backgroundColor: T.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
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
  photoPickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.accentTint, borderWidth: 1, borderColor: T.accent,
    borderRadius: 14, padding: 12, marginBottom: 16,
  },
  photoPreview: { width: 48, height: 48, borderRadius: 10, backgroundColor: T.inputBg },
  photoPreviewFallback: {
    width: 48, height: 48, borderRadius: 10, backgroundColor: '#fff',
    borderWidth: 1, borderColor: T.accent, alignItems: 'center', justifyContent: 'center',
  },
  photoPreviewLetter: { fontSize: 22, fontWeight: '700', color: T.accent },
  photoPickerLabel: { flex: 1 },
  photoPickerTitle: { fontSize: 14, fontWeight: '600', color: T.accent },
  photoPickerSub: { fontSize: 12, color: T.muted, marginTop: 2 },
  photoRemoveBtn: { padding: 4 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16, alignSelf: 'flex-start' },
  backText: { fontSize: 14, color: T.muted, fontWeight: '500' },
  tierRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 8 },
  tierBtn: {
    flex: 1, borderRadius: 14, borderWidth: 2, borderColor: T.border,
    alignItems: 'center', paddingVertical: 10, backgroundColor: T.card,
  },
  tierBadge: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tierBadgeText: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  noteInput: {
    backgroundColor: T.inputBg, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 14, color: T.primary, marginBottom: 16, minHeight: 70, textAlignVertical: 'top',
  },
});

const fly = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 999 },
  tile: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 20 },
  tileImage: { width: 110, height: 110, borderRadius: 26 },
  tileFallback: { alignItems: 'center', justifyContent: 'center' },
  tileFallbackText: { fontSize: 44, fontWeight: '800', color: '#fff', letterSpacing: -2 },
});

const cp = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', paddingHorizontal: 40 },
  card: { backgroundColor: T.bg, borderRadius: 20, paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20 },
  title: { fontSize: 13, fontWeight: '700', color: T.muted, letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border },
  optionActive: { backgroundColor: T.accentTint },
  optionText: { fontSize: 15, fontWeight: '500', color: T.primary },
  optionTextActive: { fontWeight: '600', color: T.accent },
});
