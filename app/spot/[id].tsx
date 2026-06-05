import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Image,
  Alert, ScrollView, Dimensions, TextInput, Share, LayoutAnimation, Animated,
} from 'react-native';
import { Map, Camera, Marker } from '@maplibre/maplibre-react-native';
import { MAP_STYLE_URL, latitudeDeltaToZoom } from '@/lib/mapStyle';
import { useLocalSearchParams, router, useFocusEffect, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getVisitById, deleteVisit, updateVisit, getAllVisits, updateRankOrder, recomputeRatings, Visit,
  ACTIVITY_TYPES, OCCASION_TYPES, PRICE_LABELS, Price, ActivityType, OccasionType,
  ratingColor, formatRating, friendlyDate, normalizeName,
} from '@/lib/visits';
import { getStacksForVisit, createStack, TierKey } from '@/lib/stacks';
import {
  startComparison, advance, resolveRankOrder, resolveAtMid,
  currentComparison, ComparisonState,
} from '@/lib/ranking';
import { uploadPhoto } from '@/lib/storage';
import { getSeedSpotById, SeedSpot } from '@/lib/seeds';
import { supabase } from '@/lib/supabase';
import { getReactionsForVisit, addReaction, removeReaction, Reaction } from '@/lib/reactions';
import { getAllFutureSpots, insertFutureSpot, deleteFutureSpot } from '@/lib/future';
import { scheduleOpenLogWithLocation, scheduleSelectVisit, scheduleSelectSeedSpot, cleanAddress } from '@/app/(tabs)/map';
import * as Crypto from 'expo-crypto';
import { T } from '@/lib/theme';
import { useShimmer, SkBox } from '@/components/SkeletonBox';
import { getFriendScoreForVenue } from '@/lib/friends';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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
const H_PAD = 20;
const MAP_HERO_H = 290;
const SAVE_BLUE = '#5856d6';
const PHOTO_COLS = 3;
const PHOTO_GAP = 6;
const PHOTO_SIZE = (SCREEN_W - H_PAD * 2 - PHOTO_GAP * (PHOTO_COLS - 1)) / PHOTO_COLS;

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const _NOW = new Date();
const YEARS = Array.from({ length: 11 }, (_, i) => String(_NOW.getFullYear() - i));
const DATE_OPTION_H = 46;
const DATE_DROPDOWN_H = DATE_OPTION_H * 2.5;
type DateField = 'month' | 'day' | 'year';

function initDateState(dateStr?: string): { month: string; day: string; year: string } {
  if (dateStr) {
    const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return {
      month: MONTHS[parseInt(m[2]) - 1] ?? MONTHS[_NOW.getMonth()],
      day: String(parseInt(m[3])),
      year: m[1],
    };
  }
  return { month: MONTHS[_NOW.getMonth()], day: String(_NOW.getDate()), year: String(_NOW.getFullYear()) };
}

const ACTIVITY_COLORS: Record<string, string> = {
  food:          '#B5614A',
  bars:          '#6B6B9E',
  cafes:         '#8B6B45',
  outdoors:      '#5A8066',
  indoors:       '#6B7B8D',
  view:          '#6080A0',
  entertainment: '#4B8080',
  shopping:      '#9E6B80',
  other:         '#8B7762',
};

function RankAgainModal({ visit, onClose, onDone }: {
  visit: Visit; onClose: () => void; onDone: (updated: Visit) => void;
}) {
  const others = getAllVisits().filter(v => v.id !== visit.id && v.triage === visit.triage && v.occasion_type === visit.occasion_type);
  const [cmpState, setCmpState] = useState<ComparisonState<Visit> | null>(
    () => startComparison(others, (v) => v.triage === visit.triage && v.occasion_type === visit.occasion_type)
  );
  const thisScaleAnim = useRef(new Animated.Value(1)).current;
  const thatScaleAnim = useRef(new Animated.Value(1)).current;

  function animateTap(anim: Animated.Value) {
    Animated.sequence([
      Animated.timing(anim, { toValue: 1.06, duration: 80, useNativeDriver: true }),
      Animated.spring(anim, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }),
    ]).start();
  }

  function handleResult(result: 'better' | 'worse') {
    const prev = cmpState!;
    const next = advance(prev, result);
    if (next) {
      setCmpState(next);
    } else {
      const finalLo = result === 'better' ? prev.lo : prev.mid + 1;
      saveRank(resolveRankOrder({ ...prev, lo: finalLo }, others));
    }
  }

  function handleTooHard() { saveRank(cmpState!.sorted[cmpState!.mid].rank_order); }

  function saveRank(rank_order: number) {
    updateRankOrder(visit.id, rank_order);
    recomputeRatings();
    const updated = getVisitById(visit.id);
    if (updated) onDone(updated);
  }

  const opponent = cmpState ? currentComparison(cmpState) : null;

  const thisColor = ACTIVITY_COLORS[visit.activity_type] ?? T.muted;
  const thatColor = opponent ? (ACTIVITY_COLORS[opponent.activity_type] ?? T.muted) : T.muted;
  const thisLabel = ACTIVITY_TYPES.find(a => a.value === visit.activity_type)?.label ?? 'Spot';
  const thatLabel = opponent ? (ACTIVITY_TYPES.find(a => a.value === opponent.activity_type)?.label ?? 'Spot') : 'Spot';
  const thisRatingColor = ratingColor(visit.rating);
  const thatRatingColor = opponent ? ratingColor(opponent.rating) : T.muted;

  const cardContent = others.length === 0 ? (
    <>
      <Text style={r.title}>Nothing to compare</Text>
      <Text style={r.subtitle}>Log more {visit.triage} {OCCASION_TYPES.find(a => a.value === visit.occasion_type)?.label?.toLowerCase() ?? 'romantic'} spots to start ranking.</Text>
      <Pressable style={r.secBtn} onPress={onClose}><Text style={r.secBtnText}>Got it</Text></Pressable>
    </>
  ) : opponent ? (
    <>
      <Text style={r.title}>Which was better?</Text>
      <Text style={r.subtitle}>Tap to rank</Text>
      <View style={r.compareRow}>
        <Animated.View style={[r.cardWrap, { transform: [{ scale: thisScaleAnim }] }]}>
          <Pressable style={[r.card, r.cardThis]} onPress={() => { animateTap(thisScaleAnim); handleResult('better'); }}>
            <View style={[r.cardHeader, { backgroundColor: thisColor }]}>
              <Text style={r.cardCategory} numberOfLines={1}>{thisLabel.toUpperCase()}</Text>
              {visit.rating > 0 && (
                <View style={[r.cardRatingPill, { borderColor: thisRatingColor }]}>
                  <Text style={[r.cardRatingText, { color: thisRatingColor }]}>{formatRating(visit.rating)}</Text>
                </View>
              )}
            </View>
            <View style={r.cardBody}>
              <Text style={r.cardName} numberOfLines={2}>{visit.venue_name}</Text>
              <Text style={r.cardLabel}>This one</Text>
            </View>
          </Pressable>
        </Animated.View>
        <View style={r.vs}><Text style={r.vsText}>VS</Text></View>
        <Animated.View style={[r.cardWrap, { transform: [{ scale: thatScaleAnim }] }]}>
          <Pressable style={[r.card, r.cardThat]} onPress={() => { animateTap(thatScaleAnim); handleResult('worse'); }}>
            <View style={[r.cardHeader, { backgroundColor: thatColor }]}>
              <Text style={r.cardCategory} numberOfLines={1}>{thatLabel.toUpperCase()}</Text>
              {opponent.rating > 0 && (
                <View style={[r.cardRatingPill, { borderColor: thatRatingColor }]}>
                  <Text style={[r.cardRatingText, { color: thatRatingColor }]}>{formatRating(opponent.rating)}</Text>
                </View>
              )}
            </View>
            <View style={r.cardBody}>
              <Text style={r.cardName} numberOfLines={2}>{opponent.venue_name}</Text>
              <Text style={r.cardLabel}>That one</Text>
            </View>
          </Pressable>
        </Animated.View>
      </View>
      <Pressable style={r.tooHardBtn} onPress={handleTooHard}>
        <Text style={r.tooHardText}>Too hard to compare</Text>
      </Pressable>
      <Pressable style={r.secBtn} onPress={onClose}><Text style={r.secBtnText}>Cancel</Text></Pressable>
    </>
  ) : null;

  return (
    <Modal visible animationType="fade" transparent statusBarTranslucent>
      <Pressable style={r.overlay} onPress={onClose}>
        <Pressable style={r.floatingCard} onPress={() => {}}>
          {cardContent}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const r = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', paddingHorizontal: 16,
  },
  floatingCard: {
    backgroundColor: T.bg, borderRadius: 24,
    paddingHorizontal: 20, paddingVertical: 28,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 20,
  },
  title: { fontSize: 18, fontWeight: '400', color: T.primary, fontFamily: 'Fraunces-Regular', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, color: T.muted, textAlign: 'center', marginBottom: 20 },
  compareRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardWrap: { flex: 1, height: 140 },
  card: { flex: 1, borderRadius: 16, overflow: 'hidden', borderWidth: 2 },
  cardThis: { borderColor: T.accent },
  cardThat: { borderColor: T.border },
  cardHeader: { height: 47, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardCategory: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.9)', letterSpacing: 0.8, flexShrink: 1 },
  cardRatingPill: {
    backgroundColor: '#fff', borderWidth: 1.5,
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3,
  },
  cardRatingText: { fontSize: 12, fontWeight: '800' },
  cardBody: { flex: 1, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, backgroundColor: T.bg, justifyContent: 'space-between' },
  cardName: { fontSize: 14, fontWeight: '700', color: T.primary, lineHeight: 18 },
  cardLabel: { fontSize: 11, color: T.muted, fontWeight: '500' },
  vs: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: T.bg, borderWidth: 2, borderColor: T.accent,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10, marginHorizontal: -10,
  },
  vsText: { fontSize: 11, fontWeight: '700', color: T.accent },
  tooHardBtn: { backgroundColor: T.inputBg, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginBottom: 8 },
  tooHardText: { fontSize: 14, fontWeight: '600', color: T.muted },
  secBtn: { backgroundColor: T.inputBg, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  secBtnText: { fontSize: 14, fontWeight: '500', color: T.muted },
});

function EditDatePicker({ month, day, year, onMonthChange, onDayChange, onYearChange }: {
  month: string; day: string; year: string;
  onMonthChange: (v: string) => void;
  onDayChange: (v: string) => void;
  onYearChange: (v: string) => void;
}) {
  const [open, setOpen] = useState<DateField | null>(null);
  const [tabRowH, setTabRowH] = useState(68);
  const [tabLayouts, setTabLayouts] = useState<Partial<Record<DateField, { x: number; width: number }>>>({});
  const listRef = useRef<ScrollView>(null);

  function toggle(field: DateField) {
    LayoutAnimation.configureNext({ duration: 220, update: { type: 'easeInEaseOut' }, create: { type: 'easeInEaseOut', property: 'opacity' }, delete: { type: 'easeInEaseOut', property: 'opacity' } });
    setOpen(prev => prev === field ? null : field);
  }

  useEffect(() => {
    if (!open) return;
    const items = open === 'month' ? MONTHS : open === 'day' ? DAYS : YEARS;
    const val = open === 'month' ? month : open === 'day' ? day : year;
    const idx = items.indexOf(val);
    if (idx >= 0) setTimeout(() => listRef.current?.scrollTo({ y: idx * DATE_OPTION_H, animated: false }), 40);
  }, [open]);

  function pick(field: DateField, val: string) {
    if (field === 'month') onMonthChange(val);
    else if (field === 'day') onDayChange(val);
    else onYearChange(val);
    LayoutAnimation.configureNext({ duration: 180, update: { type: 'easeInEaseOut' }, delete: { type: 'easeInEaseOut', property: 'opacity' } });
    setOpen(null);
  }

  const fields: { key: DateField; label: string; value: string; flex?: number }[] = [
    { key: 'month', label: 'Month', value: month, flex: 1.3 },
    { key: 'day',   label: 'Day',   value: day },
    { key: 'year',  label: 'Year',  value: year, flex: 1.4 },
  ];
  const openItems = open === 'month' ? MONTHS : open === 'day' ? DAYS : YEARS;
  const openVal   = open === 'month' ? month  : open === 'day' ? day  : year;
  const dropLayout = open ? tabLayouts[open] : null;

  return (
    <View style={{ marginBottom: 12, zIndex: 20 }}>
      <View style={e.dateTabRow} onLayout={ev => setTabRowH(ev.nativeEvent.layout.height)}>
        {fields.map(f => (
          <Pressable
            key={f.key}
            style={[e.dateTab, { flex: f.flex ?? 1 }, open === f.key && e.dateTabOpen]}
            onPress={() => toggle(f.key)}
            onLayout={ev => {
              const { x, width } = ev.nativeEvent.layout;
              setTabLayouts(prev => ({ ...prev, [f.key]: { x, width } }));
            }}
          >
            <Text style={e.dateTabLabel}>{f.label}</Text>
            <Text style={[e.dateTabValue, open === f.key && e.dateTabValueOpen]}>{f.value}</Text>
            <Ionicons name={open === f.key ? 'chevron-up' : 'chevron-down'} size={11} color={open === f.key ? T.accent : T.muted} />
          </Pressable>
        ))}
      </View>
      {open && dropLayout && (
        <View style={[e.dateDropdown, { position: 'absolute', top: tabRowH + 4, left: dropLayout.x, width: dropLayout.width, height: DATE_DROPDOWN_H }]}>
          <ScrollView ref={listRef} showsVerticalScrollIndicator={false} nestedScrollEnabled style={{ flex: 1 }}>
            {openItems.map(item => {
              const selected = item === openVal;
              return (
                <Pressable key={item} style={[e.dateOption, selected && e.dateOptionSelected]} onPress={() => pick(open, item)}>
                  <Text style={[e.dateOptionText, selected && e.dateOptionTextSelected]}>{item}</Text>
                  {selected && <Ionicons name="checkmark" size={16} color={T.accent} />}
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={e.dateFade} pointerEvents="none">
            <View style={{ flex: 1, backgroundColor: 'rgba(252,249,242,0)' }} />
            <View style={{ flex: 1, backgroundColor: 'rgba(252,249,242,0.55)' }} />
            <View style={{ flex: 1, backgroundColor: 'rgba(252,249,242,0.9)' }} />
          </View>
        </View>
      )}
    </View>
  );
}


const ACTIVITY_COLORS_HERO: Record<string, string> = {
  // Occasion types (personal visits)
  romantic: '#C4604A',
  friend:   '#C49A4A',
  solo:     '#6A8FA0',
  // Venue types (seed spots — fallback colors)
  food: '#C4604A', bars: '#C49A4A', cafes: '#A07850',
  outdoors: '#6A8F6A', indoors: '#7A8CAA', view: '#6A8FA0',
  entertainment: '#8B7BB0', shopping: '#C47890', other: '#8B7255',
};

function triageToTier(rating: number): TierKey {
  if (rating >= 8.0) return 'S';
  if (rating >= 6.5) return 'A';
  if (rating >= 5.0) return 'B';
  if (rating >= 3.5) return 'C';
  return 'F';
}

function MakeStackModal({ visit, onClose }: { visit: Visit; onClose: () => void }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    const stack = createStack(name.trim(), [visit.id], triageToTier(visit.rating));
    setSaving(false);
    onClose();
    router.push(`/stack/${stack.id}` as any);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={e.root} edges={['top', 'bottom']}>
        <View style={e.header}>
          <Pressable onPress={onClose} hitSlop={8}><Text style={e.cancel}>Cancel</Text></Pressable>
          <Text style={e.title}>Make a Stack</Text>
          <Pressable onPress={handleCreate} disabled={saving || !name.trim()} hitSlop={8}>
            <Text style={[e.save, (!name.trim() || saving) && { opacity: 0.35 }]}>Create</Text>
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <TextInput
            style={e.input}
            placeholder="Name this stack…"
            placeholderTextColor={T.placeholder}
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

interface FriendVisit {
  id: string;
  userId: string;
  venue_name: string;
  lat: number;
  lng: number;
  address: string | null;
  visited_at: string | null;
  rating: number;
  notes: string | null;
  activity_type: string;
  price: number;
}

const REACTION_EMOJIS = ['🔥', '❤️', '😍', '👏'];

function ReactionsRow({ visitId, visitOwnerId }: { visitId: string; visitOwnerId: string }) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => setMyUserId(data.user?.id ?? null));
    getReactionsForVisit(visitId).then(setReactions);
  }, [visitId]);

  const myReaction = reactions.find(r => r.userId === myUserId);

  async function handleReact(emoji: string) {
    if (!myUserId || loading) return;
    setLoading(true);
    if (myReaction?.emoji === emoji) {
      await removeReaction(visitId);
      setReactions(prev => prev.filter(r => r.userId !== myUserId));
    } else {
      await addReaction(visitId, visitOwnerId, emoji);
      setReactions(prev => {
        const without = prev.filter(r => r.userId !== myUserId);
        return [...without, { id: 'tmp', visitId, userId: myUserId!, emoji, createdAt: new Date().toISOString() }];
      });
    }
    setLoading(false);
  }

  const countsByEmoji: Record<string, number> = {};
  for (const r of reactions) {
    countsByEmoji[r.emoji] = (countsByEmoji[r.emoji] ?? 0) + 1;
  }

  return (
    <View style={rx.wrap}>
      <Text style={rx.label}>REACT</Text>
      <View style={rx.emojiRow}>
        {REACTION_EMOJIS.map(emoji => {
          const count = countsByEmoji[emoji] ?? 0;
          const isMine = myReaction?.emoji === emoji;
          return (
            <Pressable
              key={emoji}
              style={[rx.chip, isMine && rx.chipActive]}
              onPress={() => handleReact(emoji)}
            >
              <Text style={rx.chipEmoji}>{emoji}</Text>
              {count > 0 && <Text style={[rx.chipCount, isMine && rx.chipCountActive]}>{count}</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const rx = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingVertical: 16 },
  label: { fontSize: 11, fontWeight: '700', color: T.muted, letterSpacing: 1.2, marginBottom: 10 },
  emojiRow: { flexDirection: 'row', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, backgroundColor: T.inputBg,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  chipActive: { borderColor: T.accent, backgroundColor: T.accentTint },
  chipEmoji: { fontSize: 18 },
  chipCount: { fontSize: 13, fontWeight: '600', color: T.muted },
  chipCountActive: { color: T.accent },
});

function FriendVisitDetail({ fv }: { fv: FriendVisit }) {
  const [savedFutureId, setSavedFutureId] = useState<string | null>(null);
  const [alreadyLogged, setAlreadyLogged] = useState(() =>
    getAllVisits().some(v => v.venue_name.toLowerCase().trim() === fv.venue_name.toLowerCase().trim())
  );
  const [friendScore, setFriendScore] = useState<number | null | 'loading'>('loading');
  const [photos, setPhotos] = useState<string[]>([]);
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveScale = useRef(new Animated.Value(1)).current;

  const color = ratingColor(fv.rating);
  const info = ACTIVITY_TYPES.find(a => a.value === fv.activity_type);
  const priceLabel = fv.price != null ? PRICE_LABELS[fv.price as Price] : null;
  const dateStr = fv.visited_at ? friendlyDate(fv.visited_at) : '';
  const tagParts = [info?.label].filter(Boolean);

  useEffect(() => {
    const existing = getAllFutureSpots().find(
      f => f.venue_name === fv.venue_name && Math.abs(f.lat - fv.lat) < 0.001
    );
    setSavedFutureId(existing?.id ?? null);
    setAlreadyLogged(getAllVisits().some(v => v.venue_name.toLowerCase().trim() === fv.venue_name.toLowerCase().trim()));
    getFriendScoreForVenue(fv.venue_name).then(s => setFriendScore(s));
  }, [fv.id]);

  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('visits')
      .select('photos')
      .ilike('venue_name', fv.venue_name)
      .not('photos', 'is', null)
      .then(({ data }) => {
        if (!data) return;
        const all: string[] = [];
        for (const row of data) {
          if (Array.isArray(row.photos)) all.push(...(row.photos as string[]));
        }
        setPhotos(all);
      });
  }, [fv.venue_name]);

  async function handleShare() {
    try { await Share.share({ message: `Check out ${fv.venue_name} on DateSpot!` }); } catch {}
  }

  function showSavedBanner() {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerAnim.setValue(0);
    Animated.sequence([
      Animated.timing(bannerAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.delay(700),
      Animated.timing(bannerAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }

  function popSave() {
    Animated.sequence([
      Animated.timing(saveScale, { toValue: 1.2, duration: 80, useNativeDriver: true }),
      Animated.spring(saveScale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
    ]).start();
  }

  function toggleSave() {
    if (savedFutureId) {
      deleteFutureSpot(savedFutureId);
      setSavedFutureId(null);
    } else {
      popSave();
      const newId = Crypto.randomUUID();
      insertFutureSpot({
        id: newId,
        venue_name: fv.venue_name,
        lat: fv.lat,
        lng: fv.lng,
        address: fv.address ?? null,
        activity_type: fv.activity_type ?? null,
        occasion_type: null,
        created_at: new Date().toISOString(),
      });
      setSavedFutureId(newId);
      showSavedBanner();
    }
  }

  function handleLogVisit() {
    scheduleOpenLogWithLocation(fv.venue_name, fv.lat, fv.lng, fv.activity_type, null);
    router.dismissTo('/(tabs)/map');
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Sticky nav — always visible */}
      <SafeAreaView style={sd.stickyNav} edges={['top']}>
        <View style={sd.stickyNavInner}>
          <View style={sd.stickyNavTitleWrap} pointerEvents="none">
            <Text style={sd.stickyNavTitle} numberOfLines={1} ellipsizeMode="tail">
              {normalizeName(fv.venue_name)}
            </Text>
          </View>
          <Pressable onPress={() => router.back()} hitSlop={12} style={sd.floatingNavBtn}>
            <Ionicons name="chevron-back" size={22} color={T.primary} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={handleShare} hitSlop={12} style={sd.floatingNavBtn}>
            <Ionicons name="share-outline" size={20} color={T.primary} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false}>
      {/* Map hero */}
      <View style={{ height: MAP_HERO_H, backgroundColor: '#e8e8ed' }}>
        <Map
          style={StyleSheet.absoluteFill}
          mapStyle={MAP_STYLE_URL}
          dragPan={false} touchZoom={false} touchRotate={false} touchPitch={false}
          doubleTapZoom={false}
          logo={false} attribution={false} compass={false}
          pointerEvents="none"
        >
          <Camera
            initialViewState={{
              center: [fv.lng, fv.lat],
              zoom: latitudeDeltaToZoom(0.015),
            }}
          />
        </Map>
        <View pointerEvents="none" style={sd.mapSolidOverlay} />
        <View pointerEvents="none" style={sd.mapPinOverlay}>
          <View style={[styles.pin, { borderColor: color }]}>
            <Text style={[styles.pinText, { color }]}>{fv.rating.toFixed(1)}</Text>
          </View>
        </View>
      </View>

      <View style={sd.beliCardContent}>
        {/* Venue name */}
        <Text style={sd.heroName} numberOfLines={3}>{normalizeName(fv.venue_name)}</Text>

        {/* Tags + price with save/log actions */}
        {(tagParts.length > 0 || priceLabel || dateStr) && (
          <View style={sd.tagsActionsRow}>
            <Text style={sd.beliTags}>
              {[...tagParts, priceLabel, dateStr].filter(Boolean).join(' · ')}
            </Text>
            <View style={sd.heroBtns}>
              <Pressable
                onPress={alreadyLogged ? undefined : handleLogVisit}
                style={[sd.actionCircleBtn, alreadyLogged && { borderColor: '#34c759', backgroundColor: '#eefff0' }]}
                disabled={alreadyLogged}
              >
                <Ionicons name={alreadyLogged ? 'checkmark' : 'add'} size={18} color={alreadyLogged ? '#34c759' : T.accent} />
              </Pressable>
              <Animated.View style={{ transform: [{ scale: saveScale }] }}>
                <Pressable onPress={toggleSave} style={[sd.actionCircleBtn, { backgroundColor: savedFutureId ? SAVE_BLUE : `${SAVE_BLUE}18`, borderColor: SAVE_BLUE }]}>
                  <Ionicons name={savedFutureId ? 'bookmark' : 'bookmark-outline'} size={16} color={savedFutureId ? '#fff' : SAVE_BLUE} />
                </Pressable>
              </Animated.View>
              <Animated.Text
                pointerEvents="none"
                style={[sd.savedMicroToast, { opacity: bannerAnim, position: 'absolute', bottom: 40, right: 0 }]}
              >
                Saved
              </Animated.Text>
            </View>
          </View>
        )}

        {/* Address */}
        {fv.address ? (
          <Text style={sd.beliAddress} numberOfLines={2}>{cleanAddress(fv.address)}</Text>
        ) : null}

        <View style={sd.divider} />

        {/* Scores */}
        <Text style={sd.sectionLabel}>SCORES</Text>
        <View style={sd.scoresRow}>
          <View style={sd.scoreCard}>
            <View style={[sd.scoreNumberPill, { backgroundColor: color, borderColor: 'rgba(255,255,255,0.35)' }]}>
              <Text style={sd.scoreNumber}>{fv.rating.toFixed(1)}</Text>
            </View>
            <Text style={sd.scoreCardTitle}>Their Rating</Text>
            {dateStr ? <Text style={sd.scoreCardSub}>{dateStr}</Text> : null}
          </View>
          {friendScore !== 'loading' && friendScore !== null ? (
            <View style={sd.scoreCard}>
              <View style={[sd.scoreNumberPill, { backgroundColor: ratingColor(friendScore), borderColor: 'rgba(255,255,255,0.35)' }]}>
                <Text style={sd.scoreNumber}>{formatRating(friendScore)}</Text>
              </View>
              <Text style={sd.scoreCardTitle}>Friend Score</Text>
              <Text style={sd.scoreCardSub}>Avg. of friends</Text>
            </View>
          ) : (
            <View style={[sd.scoreCard, sd.scoreCardLocked]}>
              <View style={[sd.scoreNumberPill, { backgroundColor: T.border, borderColor: 'rgba(0,0,0,0.06)' }]}>
                <Text style={[sd.scoreNumber, { color: T.muted }]}>–</Text>
              </View>
              <Text style={[sd.scoreCardTitle, { color: T.muted }]}>Friend Score</Text>
              <Text style={sd.scoreCardSub}>Avg. of friends</Text>
            </View>
          )}
        </View>

        <View style={sd.divider} />

        {/* Notes */}
        {fv.notes ? (
          <>
            <Text style={sd.sectionLabel}>NOTES</Text>
            <Text style={sd.notesText}>{fv.notes}</Text>
            <View style={{ height: 20 }} />
          </>
        ) : null}

        {/* Photos */}
        <Text style={sd.sectionLabel}>PHOTOS</Text>
        {photos.length > 0 ? (
          <View style={sd.photosGrid}>
            {photos.map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={sd.photoThumb} resizeMode="cover" />
            ))}
          </View>
        ) : (
          <View style={sd.emptySection}>
            <Ionicons name="camera-outline" size={28} color={T.border} />
            <Text style={sd.emptySectionText}>No photos yet</Text>
          </View>
        )}

        <View style={sd.divider} />

        {/* Reactions */}
        <ReactionsRow visitId={fv.id} visitOwnerId={fv.userId} />

        <View style={{ height: 40 }} />
      </View>
      </ScrollView>
    </View>
  );
}

function SpotDetailSkeleton({ isVisit }: { isVisit: boolean }) {
  const { shimmer, screenW } = useShimmer();
  const sk = (w: number | `${number}%`, h: number, r?: number, style?: object) => (
    <SkBox shimmer={shimmer} w={w} h={h} r={r ?? 4} style={style} screenW={screenW} />
  );
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Real nav — already loaded so no skeleton flash */}
      <SafeAreaView style={sd.stickyNav} edges={['top']}>
        <View style={sd.stickyNavInner}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={sd.navBtnCompact}>
            <Ionicons name="chevron-back" size={22} color={T.primary} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            {sk(34, 34, 17)}
            {isVisit && sk(34, 34, 17)}
            {isVisit && sk(34, 34, 17)}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Map hero — plain gray, matching real screen */}
        <View style={{ height: MAP_HERO_H, backgroundColor: '#e8e8ed' }}>
          {/* View Map pill placeholder */}
          <View style={{ position: 'absolute', bottom: 32, right: 12 }}>
            {sk(90, 30, 20)}
          </View>
        </View>

        {/* White card — structure matches beliCardContent exactly */}
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -24, paddingHorizontal: 20, paddingTop: 20 }}>
          {/* heroName: lineHeight 50, marginBottom 6 */}
          {sk('78%', 50, 4, { marginBottom: 4 })}
          {sk('52%', 50, 4, { marginBottom: 6 })}

          {/* Tags + action buttons row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            {sk('40%', 13, 3)}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {sk(100, 26, 20)}
              {sk(32, 32, 16)}
            </View>
          </View>

          {/* Address */}
          {sk('65%', 13, 3, { marginBottom: 0 })}

          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginVertical: 20 }} />

          {/* SCORES */}
          {sk(52, 10, 2, { marginBottom: 12 })}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 4 }}>
            <View style={{ flex: 1, borderRadius: 16, borderWidth: 1, borderColor: T.border, padding: 16, gap: 3 }}>
              {sk(40, 32, 3)}
              {sk('75%', 12, 3)}
              {sk('55%', 11, 3)}
            </View>
            <View style={{ flex: 1, borderRadius: 16, borderWidth: 1, borderColor: T.border, padding: 16, gap: 3 }}>
              {sk(40, 32, 3)}
              {sk('75%', 12, 3)}
              {sk('55%', 11, 3)}
            </View>
          </View>

          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginVertical: 20 }} />

          {/* PHOTOS */}
          {sk(48, 10, 2, { marginBottom: 8 })}
          <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
            {sk(28, 28, 14)}
            {sk(90, 13, 3)}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export default function SpotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [seedSpot, setSeedSpot] = useState<SeedSpot | null>(null);
  const [friendVisit, setFriendVisit] = useState<FriendVisit | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [rankingAgain, setRankingAgain] = useState(false);
  const [friendScore, setFriendScore] = useState<number | null | 'loading'>('loading');

  useFocusEffect(useCallback(() => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    setFriendScore('loading');
    const local = getVisitById(id);
    if (local) {
      setVisit(local);
      setSeedSpot(null);
      setFriendVisit(null);
      setLoading(false);
      getFriendScoreForVenue(local.venue_name).then(score => setFriendScore(score));
    } else {
      setVisit(null);
      getSeedSpotById(id).then(async s => {
        if (s) {
          setSeedSpot(s);
          setFriendVisit(null);
        } else if (supabase) {
          // Supabase fallback for friends' visits
          const { data } = await supabase
            .from('visits')
            .select('id, user_id, venue_name, lat, lng, address, visited_at, rating, notes, activity_type, price')
            .eq('id', id)
            .single();
          if (data) {
            setFriendVisit({
              id: data.id,
              userId: data.user_id,
              venue_name: data.venue_name,
              lat: data.lat,
              lng: data.lng,
              address: data.address ?? null,
              visited_at: data.visited_at ?? null,
              rating: data.rating ?? 0,
              notes: data.notes ?? null,
              activity_type: data.activity_type ?? 'other',
              price: data.price ?? 0,
            });
          } else {
            setFriendVisit(null);
          }
        }
        setLoading(false);
      });
    }
  }, [id]));

  if (loading) return <SpotDetailSkeleton isVisit={!!getVisitById(id)} />;

  if (!visit && seedSpot) {
    return <SeedSpotDetail spot={seedSpot} />;
  }

  if (!visit && friendVisit) {
    return <FriendVisitDetail fv={friendVisit} />;
  }

  if (!visit) return null;

  const info = ACTIVITY_TYPES.find(a => a.value === visit.activity_type);
  const occasionInfo = OCCASION_TYPES.find(a => a.value === visit.occasion_type);
  const color = ratingColor(visit.rating);
  const dateStr = friendlyDate(visit.visited_at || visit.created_at);
  const priceLabel = visit.price != null ? PRICE_LABELS[visit.price] : null;
  const allSorted = getAllVisits().sort((a, b) => b.rating - a.rating);
  const rank = allSorted.findIndex(v => v.id === visit.id) + 1;
  const occasionDisplay = visit.occasion_type === 'other' && visit.occasion_label
    ? `Other (${visit.occasion_label})`
    : occasionInfo?.label;
  const tagParts = [occasionDisplay, info?.label].filter(Boolean);

  async function handleShare() {
    try {
      await Share.share({ message: `Checked out ${visit!.venue_name} — rated it ${formatRating(visit!.rating)}/10 on DateSpot.` });
    } catch {}
  }

  function handleDelete() {
    const inStacks = getStacksForVisit(id);
    const stackNames = inStacks.map(s => `"${s.name}"`).join(', ');
    const stackNote = inStacks.length > 0
      ? `\n\nThis spot is in ${stackNames} and will be permanently removed from it.`
      : '';
    Alert.alert('Remove Spot', `Remove "${visit!.venue_name}" from your log?${stackNote}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: () => {
          try {
            deleteVisit(id);
            router.back();
          } catch {
            Alert.alert('Error', 'Could not remove this spot. Please try again.');
          }
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Sticky nav — always visible */}
      <SafeAreaView style={sd.stickyNav} edges={['top']}>
        <View style={sd.stickyNavInner}>
          <View style={sd.stickyNavTitleWrap} pointerEvents="none">
            <Text style={sd.stickyNavTitle} numberOfLines={1} ellipsizeMode="tail">
              {normalizeName(visit.venue_name)}
            </Text>
          </View>
          <Pressable onPress={() => router.back()} hitSlop={8} style={sd.floatingNavBtn}>
            <Ionicons name="chevron-back" size={22} color={T.primary} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Pressable onPress={handleShare} hitSlop={8} style={sd.navBtnCompact}>
              <Ionicons name="share-outline" size={20} color={T.primary} />
            </Pressable>
            <Pressable onPress={() => setEditing(true)} hitSlop={8} style={sd.navBtnCompact}>
              <Ionicons name="pencil-outline" size={18} color={T.primary} />
            </Pressable>
            <Pressable onPress={handleDelete} hitSlop={8} style={sd.navBtnCompact}>
              <Ionicons name="trash-outline" size={18} color={T.primary} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false}>
      {/* Map hero — scrolls with content */}
      <View style={{ height: MAP_HERO_H, backgroundColor: '#e8e8ed' }}>
        <Map
          style={StyleSheet.absoluteFill}
          mapStyle={MAP_STYLE_URL}
          dragPan={false} touchZoom={false} touchRotate={false} touchPitch={false}
          doubleTapZoom={false}
          logo={false} attribution={false} compass={false}
          pointerEvents="none"
        >
          <Camera
            initialViewState={{
              center: [visit.lng, visit.lat],
              zoom: latitudeDeltaToZoom(0.015),
            }}
          />
        </Map>
        <View pointerEvents="none" style={sd.mapSolidOverlay} />
        <View pointerEvents="none" style={sd.mapPinOverlay}>
          <View style={[styles.pin, { borderColor: color }]}>
            <Text style={[styles.pinText, { color }]}>{formatRating(visit.rating)}</Text>
          </View>
        </View>
        <Pressable
          style={sd.openInMapBtn}
          onPress={() => {
            scheduleSelectVisit(visit.id);
            router.dismissTo('/(tabs)/map');
          }}
        >
          <Ionicons name="map-outline" size={12} color={T.muted} />
          <Text style={sd.openInMapText}>View Map</Text>
        </Pressable>
      </View>

      <View style={sd.beliCardContent}>
        {/* Venue name */}
        <Text style={sd.heroName} numberOfLines={3}>{visit.venue_name}</Text>

        {/* Tags + price with rank actions */}
        {(tagParts.length > 0 || priceLabel) && (
          <View style={sd.tagsActionsRow}>
            <Text style={sd.beliTags}>
              {[...tagParts, priceLabel].filter(Boolean).join(' · ')}
            </Text>
            <View style={sd.heroBtns}>
              <Pressable style={styles.rankAgainBtn} onPress={() => setRankingAgain(true)}>
                <Ionicons name="git-compare-outline" size={13} color={T.accent} />
                <Text style={styles.rankAgainText}>Rank again</Text>
              </Pressable>
              <View style={sd.checkBadge}>
                <Ionicons name="checkmark" size={14} color="#34c759" />
              </View>
            </View>
          </View>
        )}

        {/* Address */}
        {visit.address ? (
          <Text style={sd.beliAddress} numberOfLines={2}>
            {cleanAddress(visit.address).split('\n').filter(Boolean).join(', ')}
          </Text>
        ) : null}

        <View style={sd.divider} />

        {/* Scores */}
        <Text style={sd.sectionLabel}>SCORES</Text>
        <View style={sd.scoresRow}>
          <View style={sd.scoreCard}>
            <View style={[sd.scoreNumberPill, { backgroundColor: color, borderColor: 'rgba(255,255,255,0.35)' }]}>
              <Text style={sd.scoreNumber}>{formatRating(visit.rating)}</Text>
            </View>
            <Text style={sd.scoreCardTitle}>Your Rating</Text>
            {rank > 0 && <Text style={sd.scoreCardSub}>#{rank} on your list</Text>}
          </View>
          {friendScore !== 'loading' && friendScore !== null ? (
            <View style={sd.scoreCard}>
              <View style={[sd.scoreNumberPill, { backgroundColor: ratingColor(friendScore), borderColor: 'rgba(255,255,255,0.35)' }]}>
                <Text style={sd.scoreNumber}>{formatRating(friendScore)}</Text>
              </View>
              <Text style={sd.scoreCardTitle}>Friend Score</Text>
              <Text style={sd.scoreCardSub}>Avg. of friends</Text>
            </View>
          ) : (
            <View style={[sd.scoreCard, sd.scoreCardLocked]}>
              <View style={[sd.scoreNumberPill, { backgroundColor: T.border, borderColor: 'rgba(0,0,0,0.06)' }]}>
                <Text style={[sd.scoreNumber, { color: T.muted }]}>–</Text>
              </View>
              <Text style={[sd.scoreCardTitle, { color: T.muted }]}>Friend Score</Text>
              <Text style={sd.scoreCardSub}>What your{'\n'}friends think</Text>
            </View>
          )}
        </View>

        <View style={sd.divider} />

        {/* Notes */}
        {visit.notes ? (
          <>
            <Text style={sd.sectionLabel}>NOTES FROM THE NIGHT</Text>
            <Text style={sd.notesText}>{visit.notes}</Text>
            <View style={{ height: 20 }} />
          </>
        ) : null}

        {/* Photos */}
        <Text style={sd.sectionLabel}>PHOTOS</Text>
        {visit.photos.length > 0 ? (
          <View style={sd.photosGrid}>
            {visit.photos.map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={sd.photoThumb} resizeMode="cover" />
            ))}
          </View>
        ) : (
          <View style={sd.emptySection}>
            <Ionicons name="camera-outline" size={28} color={T.border} />
            <Text style={sd.emptySectionText}>No photos yet</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </View>
      </ScrollView>

      {editing && (
        <EditModal
          visit={visit}
          onClose={() => setEditing(false)}
          onSave={(updated) => { setVisit(updated); setEditing(false); }}
        />
      )}
      {rankingAgain && (
        <RankAgainModal
          visit={visit}
          onClose={() => setRankingAgain(false)}
          onDone={(updated) => { setVisit(updated); setRankingAgain(false); }}
        />
      )}
    </View>
  );
}


function SeedSpotDetail({ spot }: { spot: SeedSpot }) {
  const [savedFutureId, setSavedFutureId] = useState<string | null>(null);
  const [spotPhotos, setSpotPhotos] = useState<string[]>([]);
  const [alreadyLogged, setAlreadyLogged] = useState(() =>
    getAllVisits().some(v => v.venue_name.toLowerCase().trim() === spot.venue_name.toLowerCase().trim())
  );
  const [ratingExpanded, setRatingExpanded] = useState(false);
  const [seedFriendScore, setSeedFriendScore] = useState<number | null | 'loading'>('loading');
  const bannerAnim = useRef(new Animated.Value(0)).current;
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveScale = useRef(new Animated.Value(1)).current;
  const color = ratingColor(spot.rating);
  const priceLabel = PRICE_LABELS[spot.price as Price];

  useEffect(() => {
    const existing = getAllFutureSpots().find(
      f => f.venue_name === spot.venue_name && Math.abs(f.lat - spot.lat) < 0.001
    );
    setSavedFutureId(existing?.id ?? null);
    setAlreadyLogged(getAllVisits().some(v => v.venue_name.toLowerCase().trim() === spot.venue_name.toLowerCase().trim()));
    getFriendScoreForVenue(spot.venue_name).then(score => setSeedFriendScore(score));
  }, [spot.id]);

  // Fetch any user-uploaded photos for this venue
  useEffect(() => {
    if (!supabase) return;
    supabase
      .from('visits')
      .select('photos')
      .ilike('venue_name', spot.venue_name)
      .not('photos', 'is', null)
      .then(({ data }) => {
        if (!data) return;
        const all: string[] = [];
        for (const row of data) {
          if (Array.isArray(row.photos)) all.push(...(row.photos as string[]));
        }
        setSpotPhotos(all);
      });
  }, [spot.venue_name]);

  async function handleShare() {
    try {
      await Share.share({ message: `Check out ${spot.venue_name} on DateSpot!` });
    } catch {}
  }

  function showSavedBanner() {
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    // Mirror the friends-tab micro-toast: quick fade in, brief hold, fade out.
    bannerAnim.setValue(0);
    Animated.sequence([
      Animated.timing(bannerAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.delay(700),
      Animated.timing(bannerAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }

  function popSave() {
    Animated.sequence([
      Animated.timing(saveScale, { toValue: 1.2, duration: 80, useNativeDriver: true }),
      Animated.spring(saveScale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }),
    ]).start();
  }

  function toggleSave() {
    if (savedFutureId) {
      deleteFutureSpot(savedFutureId);
      setSavedFutureId(null);
    } else {
      popSave();
      const newId = Crypto.randomUUID();
      insertFutureSpot({
        id: newId,
        venue_name: spot.venue_name,
        lat: spot.lat,
        lng: spot.lng,
        address: spot.address ?? null,
        activity_type: spot.activity_type ?? null,
        occasion_type: spot.occasion_type ?? null,
        created_at: new Date().toISOString(),
      });
      setSavedFutureId(newId);
      showSavedBanner();
    }
  }

  function handleLogVisit() {
    scheduleOpenLogWithLocation(spot.venue_name, spot.lat, spot.lng, spot.activity_type, spot.occasion_type);
    router.dismissTo('/(tabs)/map');
  }

  const activityInfo = ACTIVITY_TYPES.find(a => a.value === spot.activity_type);
  const seedTagParts = [activityInfo?.label].filter(Boolean);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Sticky nav — always visible */}
      <SafeAreaView style={sd.stickyNav} edges={['top']}>
        <View style={sd.stickyNavInner}>
          <View style={sd.stickyNavTitleWrap} pointerEvents="none">
            <Text style={sd.stickyNavTitle} numberOfLines={1} ellipsizeMode="tail">
              {spot.venue_name}
            </Text>
          </View>
          <Pressable onPress={() => router.back()} hitSlop={12} style={sd.floatingNavBtn}>
            <Ionicons name="chevron-back" size={22} color={T.primary} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={handleShare} hitSlop={12} style={sd.floatingNavBtn}>
            <Ionicons name="share-outline" size={20} color={T.primary} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false}>
      {/* Map hero — scrolls with content */}
      <View style={{ height: MAP_HERO_H, backgroundColor: '#e8e8ed' }}>
        <Map
          style={StyleSheet.absoluteFill}
          mapStyle={MAP_STYLE_URL}
          dragPan={false} touchZoom={false} touchRotate={false} touchPitch={false}
          doubleTapZoom={false}
          logo={false} attribution={false} compass={false}
          pointerEvents="none"
        >
          <Camera
            initialViewState={{
              center: [spot.lng, spot.lat],
              zoom: latitudeDeltaToZoom(0.015),
            }}
          />
        </Map>
        <View pointerEvents="none" style={sd.mapSolidOverlay} />
        <View pointerEvents="none" style={sd.mapPinOverlay}>
          <View style={[styles.pin, { borderColor: color }]}>
            <Text style={[styles.pinText, { color }]}>{spot.rating.toFixed(1)}</Text>
          </View>
        </View>
        <Pressable
          style={sd.openInMapBtn}
          onPress={() => {
            scheduleSelectSeedSpot(spot.id);
            router.dismissTo('/(tabs)/map');
          }}
        >
          <Ionicons name="map-outline" size={12} color={T.muted} />
          <Text style={sd.openInMapText}>View Map</Text>
        </Pressable>
      </View>

      <View style={sd.beliCardContent}>
        {/* Venue name */}
        <Text style={sd.heroName} numberOfLines={3}>{spot.venue_name}</Text>

        {/* Tags + price with save/add actions */}
        {(seedTagParts.length > 0 || priceLabel) && (
          <View style={sd.tagsActionsRow}>
            <Text style={sd.beliTags}>
              {[...seedTagParts, priceLabel].filter(Boolean).join(' · ')}
            </Text>
            <View style={sd.heroBtns}>
              <Pressable
                onPress={alreadyLogged ? undefined : handleLogVisit}
                style={[sd.actionCircleBtn, alreadyLogged && { borderColor: '#34c759', backgroundColor: '#eefff0' }]}
                disabled={alreadyLogged}
              >
                <Ionicons name={alreadyLogged ? 'checkmark' : 'add'} size={18} color={alreadyLogged ? '#34c759' : T.accent} />
              </Pressable>
              <Animated.View style={{ transform: [{ scale: saveScale }] }}>
                <Pressable onPress={toggleSave} style={[sd.actionCircleBtn, { backgroundColor: savedFutureId ? SAVE_BLUE : `${SAVE_BLUE}18`, borderColor: SAVE_BLUE }]}>
                  <Ionicons name={savedFutureId ? 'bookmark' : 'bookmark-outline'} size={16} color={savedFutureId ? '#fff' : SAVE_BLUE} />
                </Pressable>
              </Animated.View>
              <Animated.Text
                pointerEvents="none"
                style={[sd.savedMicroToast, { opacity: bannerAnim, position: 'absolute', bottom: 40, right: 0 }]}
              >
                Saved
              </Animated.Text>
            </View>
          </View>
        )}

        {/* Address */}
        {spot.address ? (
          <Text style={sd.beliAddress} numberOfLines={2}>{cleanAddress(spot.address)}</Text>
        ) : null}

        <View style={sd.divider} />

        {/* Scores */}
        <Text style={sd.sectionLabel}>SCORES</Text>
        <View style={sd.scoresRow}>
          <View style={sd.scoreCard}>
            <View style={[sd.scoreNumberPill, { backgroundColor: color, borderColor: 'rgba(255,255,255,0.35)' }]}>
              <Text style={sd.scoreNumber}>{spot.rating.toFixed(1)}</Text>
            </View>
            <Text style={sd.scoreCardTitle}>Rec Score</Text>
            <Text style={sd.scoreCardSub}>Avg. of all logs</Text>
          </View>
          {seedFriendScore !== 'loading' && seedFriendScore !== null ? (
            <View style={sd.scoreCard}>
              <View style={[sd.scoreNumberPill, { backgroundColor: ratingColor(seedFriendScore), borderColor: 'rgba(255,255,255,0.35)' }]}>
                <Text style={sd.scoreNumber}>{formatRating(seedFriendScore)}</Text>
              </View>
              <Text style={sd.scoreCardTitle}>Friend Score</Text>
              <Text style={sd.scoreCardSub}>Avg. of friends</Text>
            </View>
          ) : (
            <View style={[sd.scoreCard, sd.scoreCardLocked]}>
              <View style={[sd.scoreNumberPill, { backgroundColor: T.border, borderColor: 'rgba(0,0,0,0.06)' }]}>
                <Text style={[sd.scoreNumber, { color: T.muted }]}>–</Text>
              </View>
              <Text style={[sd.scoreCardTitle, { color: T.muted }]}>Friend Score</Text>
              <Text style={sd.scoreCardSub}>What your{'\n'}friends think</Text>
            </View>
          )}
        </View>

        <View style={sd.divider} />

        {/* Why it's a great date */}
        {spot.notes ? (
          <>
            <Text style={sd.sectionLabel}>WHY IT'S A GREAT DATE</Text>
            <Text style={sd.notesText}>{spot.notes}</Text>
            <View style={{ height: 20 }} />
          </>
        ) : null}

        {/* Photos */}
        <Text style={sd.sectionLabel}>PHOTOS</Text>
        {spotPhotos.length > 0 ? (
          <View style={sd.photosGrid}>
            {spotPhotos.map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={sd.photoThumb} resizeMode="cover" />
            ))}
          </View>
        ) : (
          <View style={sd.emptySection}>
            <Ionicons name="camera-outline" size={28} color={T.border} />
            <Text style={sd.emptySectionText}>No photos yet</Text>
          </View>
        )}

        <View style={sd.divider} />

        {/* What your friends think */}
        <Text style={sd.sectionLabel}>WHAT YOUR FRIENDS THINK</Text>
        <View style={sd.emptySection}>
          <Ionicons name="people-outline" size={28} color={T.border} />
          <Text style={sd.emptySectionText}>None of your friends have logged this spot yet.</Text>
          <Pressable style={sd.addFriendsBtn} onPress={() => router.push('/(tabs)/friends')}>
            <Ionicons name="person-add-outline" size={14} color={T.accent} />
            <Text style={sd.addFriendsBtnText}>Add friends</Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </View>
      </ScrollView>
    </View>
  );
}

const sd = StyleSheet.create({
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  floatingHeaderInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  floatingBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedMicroToast: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5856d6',
  },
  hero: {
    paddingTop: 96,
    paddingBottom: 10,
  },
  heroContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  heroMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1,
    marginBottom: 6,
  },
  heroName: {
    fontSize: 45,
    fontWeight: '700',
    color: '#000',
    fontFamily: 'Fraunces-Regular',
    lineHeight: 50,
    marginBottom: 6,
  },
  heroCity: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  heroRank: {
    fontSize: 32,
    fontWeight: '200',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: -1,
  },
  whiteCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flex: 1,
    padding: 20,
    minHeight: SCREEN_H,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0EB',
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#E76F51',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  editorBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E76F51',
    letterSpacing: 0.4,
  },
  ratingWrap: {
    alignItems: 'flex-end',
    gap: 3,
  },
  ratingBadge: {
    borderRadius: 99,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  ratingBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  ratingCaption: {
    fontSize: 10,
    color: T.muted,
    fontWeight: '500',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  notesText: {
    fontSize: 15,
    color: '#4B3621',
    lineHeight: 23,
  },
  mapWrap: {
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#e8e8ed',
  },
  addressText: {
    fontSize: 13,
    color: T.muted,
    marginTop: 8,
    paddingHorizontal: 2,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PHOTO_GAP,
  },
  photoThumb: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    backgroundColor: '#f2f2f7',
    borderRadius: 6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.border,
    marginVertical: 20,
  },
  emptySection: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptySectionText: {
    fontSize: 13,
    color: T.muted,
    textAlign: 'center',
    lineHeight: 19,
  },
  addFriendsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: T.accent,
    backgroundColor: T.accentTint,
  },
  addFriendsBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: T.accent,
  },
  mapSolidOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  openInMapBtn: {
    position: 'absolute',
    bottom: 32,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: T.border,
  },
  openInMapText: {
    fontSize: 12,
    fontWeight: '600',
    color: T.muted,
  },
  mapPinOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 36,
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  heroBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 4,
  },
  beliCardContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 60,
  },
  beliTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tagsActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  beliTags: {
    fontSize: 13,
    color: T.muted,
    lineHeight: 19,
    flex: 1,
  },
  beliAddress: {
    fontSize: 13,
    color: T.muted,
    marginBottom: 0,
    lineHeight: 18,
  },
  checkBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eefff0',
    borderWidth: 1.5,
    borderColor: '#34c759',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoresRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: T.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.border,
    padding: 16,
    gap: 3,
  },
  scoreCardLocked: {
    alignItems: 'flex-start',
  },
  beliVenueName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    fontFamily: 'Fraunces-Regular',
    lineHeight: 34,
    marginBottom: 10,
  },
  scoreNumberPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  scoreNumber: {
    fontSize: 19,
    fontWeight: '800',
    color: '#fff',
  },
  scoreCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: T.primary,
  },
  scoreCardSub: {
    fontSize: 11,
    color: T.muted,
    lineHeight: 15,
  },
  actionCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: T.accentTint,
    borderWidth: 1.5,
    borderColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaSafe: {
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
  },
  logCta: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E76F51',
    borderRadius: 14,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 16,
  },
  logCtaText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  stickyNav: {
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
    zIndex: 10,
  },
  stickyNavInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 2,
  },
  stickyNavTitleWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: 116,
    overflow: 'hidden',
  },
  stickyNavTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: T.primary,
    fontFamily: 'Fraunces-Regular',
    textAlign: 'center',
  },
  floatingNav: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  floatingNavInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  floatingNavBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnCompact: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function EditModal({ visit, onClose, onSave }: { visit: Visit; onClose: () => void; onSave: (v: Visit) => void }) {
  const [name, setName] = useState(visit.venue_name);
  const [notes, setNotes] = useState(visit.notes ?? '');
  const [activity, setActivity] = useState<ActivityType | null>(visit.activity_type);
  const [occasion, setOccasion] = useState<OccasionType | null>(visit.occasion_type);
  const [occasionLabel, setOccasionLabel] = useState(visit.occasion_label ?? '');
  const [price, setPrice] = useState<Price | undefined>(visit.price);
  const [photos, setPhotos] = useState<string[]>(visit.photos ?? []);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const initDate = initDateState(visit.visited_at);
  const [month, setMonth] = useState(initDate.month);
  const [day, setDay] = useState(initDate.day);
  const [year, setYear] = useState(initDate.year);

  const visitedAt = (() => {
    const mi = MONTHS.indexOf(month) + 1;
    const di = parseInt(day);
    const yi = parseInt(year);
    return `${yi}-${String(mi).padStart(2, '0')}-${String(di).padStart(2, '0')}`;
  })();

  async function pickPhoto() {
    try {
      const ImagePicker = await import('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo library access.'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (result.canceled || !result.assets.length) return;
      setUploading(true);
      const uploaded: string[] = [];
      for (const asset of result.assets) {
        const url = await uploadPhoto(asset.uri, `spots/${visit.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
        if (url) uploaded.push(url);
      }
      if (uploaded.length) setPhotos(prev => [...prev, ...uploaded]);
      else Alert.alert('Upload failed', 'Could not upload photos.');
    } catch { Alert.alert('Error', 'Something went wrong.'); }
    finally { setUploading(false); }
  }

  async function handleSave() {
    if (!name.trim()) { Alert.alert('Name required', 'Give this spot a name.'); return; }
    setSaving(true);
    updateVisit(visit.id, {
      venue_name: name.trim(), visited_at: visitedAt,
      notes: notes.trim() || null,
      activity_type: activity ?? visit.activity_type,
      occasion_type: occasion ?? visit.occasion_type,
      occasion_label: (occasion ?? visit.occasion_type) === 'other' ? (occasionLabel.trim() || null) : null,
      price: price ?? visit.price,
      photos,
    });
    const updated = getVisitById(visit.id);
    setSaving(false);
    if (updated) onSave(updated);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={e.root} edges={['top', 'bottom']}>
        <View style={e.header}>
          <Pressable onPress={onClose} hitSlop={8}><Text style={e.cancel}>Cancel</Text></Pressable>
          <Text style={e.title}>Edit Spot</Text>
          <Pressable onPress={handleSave} disabled={saving} hitSlop={8}>
            <Text style={e.save}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>
        <ScrollView style={e.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <TextInput style={e.input} placeholder="Name your date!" placeholderTextColor={T.placeholder} value={name} onChangeText={setName} autoFocus returnKeyType="next" />

          <Text style={e.sectionLabel}>Date</Text>
          <EditDatePicker month={month} day={day} year={year} onMonthChange={setMonth} onDayChange={setDay} onYearChange={setYear} />

          <Text style={e.sectionLabel}>Photos</Text>
          <View style={e.photoGrid}>
            {photos.map((uri, idx) => (
              <Pressable key={idx} style={e.photoThumb} onLongPress={() => setPhotos(prev => prev.filter((_, i) => i !== idx))}>
                <Image source={{ uri }} style={e.photoThumbImg} resizeMode="cover" />
              </Pressable>
            ))}
            <Pressable style={e.photoAdd} onPress={pickPhoto} disabled={uploading}>
              <Ionicons name={uploading ? 'hourglass-outline' : 'camera-outline'} size={22} color={T.muted} />
              <Text style={e.photoAddLabel}>{uploading ? 'Uploading…' : 'Add photo'}</Text>
            </Pressable>
          </View>

          <Text style={e.sectionLabel}>Category</Text>
          <View style={e.chipWrap}>
            {ACTIVITY_TYPES.map(a => {
              const sel = activity === a.value;
              return (
                <Pressable key={a.value} style={[e.chip, sel && e.chipSel]} onPress={() => setActivity(sel ? null : a.value)}>
                  <Text style={[e.chipLabel, sel && e.chipLabelSel]}>{a.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={e.sectionLabel}>What kind of date?</Text>
          <View style={e.occasionRow}>
            {OCCASION_TYPES.map(a => {
              const sel = occasion === a.value;
              return (
                <Pressable key={a.value} style={[e.occasionBtn, sel && e.occasionBtnSel]} onPress={() => { setOccasion(sel ? null : a.value); if (a.value !== 'other') setOccasionLabel(''); }}>
                  <Text style={[e.occasionLabel, sel && e.occasionLabelSel]}>{a.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {occasion === 'other' && (
            <TextInput
              style={[e.input, { marginTop: 10 }]}
              value={occasionLabel}
              onChangeText={setOccasionLabel}
              placeholder="Describe the occasion…"
              placeholderTextColor={T.placeholder}
              returnKeyType="done"
            />
          )}

          <Text style={e.sectionLabel}>Price range</Text>
          <View style={e.priceRow}>
            {([0, 1, 2, 3] as Price[]).map(p => {
              const sel = price === p;
              return (
                <Pressable key={p} style={[e.priceBtn, sel && e.priceBtnSel]} onPress={() => setPrice(sel ? undefined : p)}>
                  <Text style={[e.priceBtnText, sel && e.priceBtnTextSel]}>{PRICE_LABELS[p]}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            style={[e.input, e.inputMulti]}
            placeholder="Notes — what made it memorable?"
            placeholderTextColor={T.placeholder}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
          />

          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  headerSafe: { backgroundColor: T.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 2 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  hero: {
    paddingHorizontal: H_PAD, paddingTop: 8, paddingBottom: 24,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  venueName: {
    fontSize: 26, fontWeight: '800', color: T.primary,
    lineHeight: 32, letterSpacing: -0.5, marginBottom: 6,
  },
  dateStr: { fontSize: 14, color: T.muted, fontWeight: '500', marginBottom: 14 },

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  tag: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  tagText: { fontSize: 13, fontWeight: '500', color: T.muted },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  rankAgainBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: T.accent, backgroundColor: T.accentTint,
  },
  rankAgainText: { fontSize: 12, fontWeight: '600', color: T.accent },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'baseline', gap: 2,
    paddingHorizontal: 13, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1.5, backgroundColor: 'transparent',
  },
  ratingScore: { fontSize: 18, fontWeight: '800' },
  ratingSlash: { fontSize: 11, fontWeight: '600' },
  ratingCaption: { fontSize: 13, color: T.muted, fontWeight: '500' },

  section: { paddingHorizontal: H_PAD, marginTop: 22 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: T.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },

  notesCard: {
    backgroundColor: T.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: T.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6,
  },
  notesText: { fontSize: 15, color: T.primary, lineHeight: 23 },

  photosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: PHOTO_GAP },
  photoThumb: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 0, backgroundColor: '#f2f2f7' },

  mapCard: { height: 140, borderRadius: 14, overflow: 'hidden', backgroundColor: '#e8e8ed' },
  mapHint: {
    position: 'absolute', bottom: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  mapHintText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  mapAddress: { fontSize: 12, color: T.muted, marginTop: 8, paddingHorizontal: 2 },

  pin: {
    minWidth: 34, height: 22, borderRadius: 11, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 3,
  },
  pinText: { fontSize: 10, fontWeight: '800' },

  fullMap: { flex: 1 },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, gap: 8 },
  modalBackBtn: {
    width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6,
  },
  modalPill: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 22,
    paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6,
  },
  modalPillText: { fontSize: 15, fontWeight: '600', color: '#1c1c1e', textAlign: 'center' },
});

const e = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border,
  },
  cancel: { fontSize: 16, color: T.muted },
  title: { fontSize: 17, fontWeight: '600', color: T.primary },
  save: { fontSize: 16, fontWeight: '600', color: T.accent },
  form: { paddingHorizontal: 20, paddingTop: 16 },

  sectionLabel: { fontSize: 12, fontWeight: '600', color: T.muted, marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: T.inputBg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: T.primary, marginBottom: 16 },
  inputMulti: { minHeight: 90, textAlignVertical: 'top', marginBottom: 0 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  occasionRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  occasionBtn: {
    flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.inputBg, gap: 4,
  },
  occasionBtnSel: { backgroundColor: T.accentTint, borderColor: T.accent },
  occasionLabel: { fontSize: 14, fontWeight: '600', color: T.primary },
  occasionLabelSel: { color: T.accent },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: T.inputBg, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  chipSel: { backgroundColor: T.accentTint, borderColor: T.accent },
  chipLabel: { fontSize: 13, fontWeight: '600', color: T.primary },
  chipLabelSel: { color: T.accent },

  priceRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  priceBtn: { flex: 1, backgroundColor: T.inputBg, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  priceBtnSel: { backgroundColor: T.accentTint, borderColor: T.accent },
  priceBtnText: { fontSize: 14, fontWeight: '600', color: T.primary },
  priceBtnTextSel: { color: T.accent },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: PHOTO_GAP, marginBottom: 16 },
  photoThumb: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 0, overflow: 'hidden' },
  photoThumbImg: { width: '100%', height: '100%' },
  photoAdd: {
    width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 0,
    backgroundColor: T.inputBg, alignItems: 'center', justifyContent: 'center', gap: 4,
    borderWidth: 1, borderColor: T.border, borderStyle: 'dashed',
  },
  photoAddLabel: { fontSize: 10, color: T.muted, fontWeight: '500' },

  dateTabRow: { flexDirection: 'row', gap: 8 },
  dateTab: { flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: T.border, paddingVertical: 10, paddingHorizontal: 10, alignItems: 'center', gap: 2 },
  dateTabOpen: { borderColor: T.accent, backgroundColor: T.accentTint },
  dateTabLabel: { fontSize: 10, fontWeight: '600', color: T.muted, letterSpacing: 0.5 },
  dateTabValue: { fontSize: 18, fontWeight: '700', color: T.primary },
  dateTabValueOpen: { color: T.accent },
  dateDropdown: { borderRadius: 12, borderWidth: 1.5, borderColor: T.accent, backgroundColor: T.card, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.13, shadowRadius: 14, elevation: 10 },
  dateOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, height: DATE_OPTION_H, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border },
  dateOptionSelected: { backgroundColor: T.accentTint },
  dateOptionText: { fontSize: 15, fontWeight: '500', color: T.primary },
  dateOptionTextSelected: { color: T.accent, fontWeight: '700' },
  dateFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 36 },
});
