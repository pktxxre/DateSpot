import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Alert, ScrollView, Share,
} from 'react-native';
import { Map, Camera } from '@maplibre/maplibre-react-native';
import { MAP_STYLE_URL, latitudeDeltaToZoom } from '@/lib/mapStyle';
import { useLocalSearchParams, router, useFocusEffect, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getFutureSpotById, deleteFutureSpot, updateFutureSpotTypes, FutureSpot,
} from '@/lib/future';
import { friendlyDate, ACTIVITY_TYPES, OCCASION_TYPES } from '@/lib/visits';
import { T } from '@/lib/theme';
import { scheduleOpenLogWithLocation, scheduleSelectFutureSpot, cleanAddress } from '@/app/(tabs)/map';
import { useShimmer, SkBox } from '@/components/SkeletonBox';

const FUTURE_BLUE = '#5856d6';
const MAP_HERO_H = 290;

function FutureSpotDetailSkeleton() {
  const { shimmer, screenW } = useShimmer();
  const sk = (w: number | `${number}%`, h: number, r?: number, style?: object) => (
    <SkBox shimmer={shimmer} w={w} h={h} r={r ?? 4} style={style} screenW={screenW} />
  );
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Real nav — already loaded */}
      <SafeAreaView style={styles.stickyNav} edges={['top']}>
        <View style={styles.stickyNavInner}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.navBtnCompact}>
            <Ionicons name="chevron-back" size={22} color={T.primary} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            {sk(34, 34, 17)}
            {sk(34, 34, 17)}
            {sk(34, 34, 17)}
          </View>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Map hero */}
        <View style={{ height: MAP_HERO_H, backgroundColor: '#e8e8ed' }} />

        {/* White card */}
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -24, paddingHorizontal: 20, paddingTop: 20 }}>
          {sk('68%', 28, 4, { marginBottom: 16 })}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            {sk(110, 44, 12)}
            {sk(110, 44, 12)}
          </View>
          {sk('55%', 13, 3, { marginBottom: 8 })}
          {sk('75%', 13, 3, { marginBottom: 20 })}
        </View>
      </ScrollView>
    </View>
  );
}

export default function FutureSpotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [spot, setSpot] = useState<FutureSpot | null>(() =>
    id ? getFutureSpotById(id as string) : null
  );
  const [editingTypes, setEditingTypes] = useState(false);
  const [draftActivity, setDraftActivity] = useState<string | null>(null);
  const [draftOccasion, setDraftOccasion] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    if (id) setSpot(getFutureSpotById(id));
  }, [id]));

  if (!spot) return <FutureSpotDetailSkeleton />;

  const dateStr = friendlyDate(spot.created_at);

  async function handleShare() {
    try {
      await Share.share({ message: `Saving ${spot!.venue_name} to check out on DateSpot.` });
    } catch {}
  }

  function handleEdit() {
    setDraftActivity(spot!.activity_type ?? null);
    setDraftOccasion(spot!.occasion_type ?? null);
    setEditingTypes(true);
  }

  function saveTypes() {
    updateFutureSpotTypes(spot!.id, draftActivity, draftOccasion);
    setSpot(s => s ? { ...s, activity_type: draftActivity, occasion_type: draftOccasion } : s);
    setEditingTypes(false);
  }

  function handleLog() {
    scheduleOpenLogWithLocation(spot!.venue_name, spot!.lat, spot!.lng, spot!.activity_type, spot!.occasion_type);
    router.navigate('/(tabs)/map');
  }

  function handleDelete() {
    Alert.alert('Remove Spot', `Remove "${spot!.venue_name}" from your want-to-go list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: () => {
          try {
            deleteFutureSpot(id);
            router.back();
          } catch {
            Alert.alert('Error', 'Could not remove this spot. Please try again.');
          }
        },
      },
    ]);
  }

  const activityInfo = ACTIVITY_TYPES.find(a => a.value === spot.activity_type);
  const occasionInfo = OCCASION_TYPES.find(a => a.value === spot.occasion_type);
  const metaParts = [activityInfo?.label, occasionInfo?.label].filter(Boolean);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Sticky nav — always visible */}
      <SafeAreaView style={styles.stickyNav} edges={['top']}>
        <View style={styles.stickyNavInner}>
          <View style={styles.stickyNavTitleWrap} pointerEvents="none">
            <Text style={styles.stickyNavTitle} numberOfLines={1} ellipsizeMode="tail">
              {spot.venue_name}
            </Text>
          </View>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.floatingNavBtn}>
            <Ionicons name="chevron-back" size={22} color={T.primary} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Pressable onPress={handleShare} hitSlop={8} style={styles.navBtnCompact}>
              <Ionicons name="share-outline" size={20} color={T.primary} />
            </Pressable>
            <Pressable onPress={handleEdit} hitSlop={8} style={styles.navBtnCompact}>
              <Ionicons name="pencil-outline" size={18} color={T.primary} />
            </Pressable>
            <Pressable onPress={handleDelete} hitSlop={8} style={styles.navBtnCompact}>
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
              center: [spot.lng, spot.lat],
              zoom: latitudeDeltaToZoom(0.015),
            }}
          />
        </Map>
        <View pointerEvents="none" style={styles.mapSolidOverlay} />
        <View pointerEvents="none" style={styles.mapPinOverlay}>
          <View style={styles.pin}>
            <Ionicons name="bookmark" size={14} color="#fff" />
          </View>
        </View>
        <Pressable
          style={styles.openInMapBtn}
          onPress={() => {
            scheduleSelectFutureSpot(spot.id);
            router.dismissTo('/(tabs)/map');
          }}
        >
          <Ionicons name="map-outline" size={12} color={T.muted} />
          <Text style={styles.openInMapText}>View Map</Text>
        </Pressable>
      </View>

      <View style={styles.beliCardContent}>
        {/* Venue name — inside card, matching top-spot layout */}
        <Text style={styles.heroName} numberOfLines={3}>{spot.venue_name}</Text>
        {/* Want-to-go badge + log button */}
        <View style={styles.beliTopRow}>
          <View style={styles.wantToGoTag}>
            <Ionicons name="bookmark" size={13} color={FUTURE_BLUE} style={{ marginRight: 4 }} />
            <Text style={[styles.wantToGoTagText, { color: FUTURE_BLUE }]}>Want to go</Text>
          </View>
          <Pressable style={styles.logVisitBtn} onPress={handleLog} hitSlop={8}>
            <Ionicons name="add" size={16} color={T.accent} />
            <Text style={styles.logVisitBtnText}>Log visit</Text>
          </Pressable>
        </View>

        {/* Tags */}
        {metaParts.length > 0 && (
          <Text style={styles.beliTags}>{metaParts.join(' · ')}</Text>
        )}

        {/* Address */}
        {spot.address ? (
          <Text style={styles.beliAddress} numberOfLines={2}>
            {cleanAddress(spot.address).split('\n').filter(Boolean).join(', ')}
          </Text>
        ) : null}

        {/* Notes */}
        {spot.notes ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>NOTES</Text>
            <Text style={styles.notesText}>{spot.notes}</Text>
          </>
        ) : null}

        <View style={{ height: 40 }} />
      </View>
      </ScrollView>

      {/* Edit types modal */}
      <Modal visible={editingTypes} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.editRoot} edges={['top', 'bottom']}>
          <ScrollView contentContainerStyle={styles.editContent}>
            <Text style={styles.editTitle}>Save for later</Text>
            <Text style={styles.editSubtitle}>{spot.venue_name}</Text>

            <View style={styles.editSectionRow}>
              <Text style={styles.editSectionLabel}>WHAT KIND OF DATE?</Text>
              <Text style={styles.editSectionAsterisk}> *</Text>
            </View>
            <View style={styles.occasionTrack}>
              {OCCASION_TYPES.map(o => {
                const selected = draftOccasion === o.value;
                return (
                  <Pressable
                    key={o.value}
                    style={[styles.occasionBtn, selected && styles.occasionBtnSelected]}
                    onPress={() => setDraftOccasion(selected ? null : o.value)}
                  >
                    <Text style={[styles.occasionLabel, selected && styles.occasionLabelSelected]}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.editSectionRow}>
              <Text style={styles.editSectionLabel}>CATEGORY</Text>
              <Text style={styles.editSectionAsterisk}> *</Text>
            </View>
            <View style={styles.chipWrap}>
              {ACTIVITY_TYPES.map(a => {
                const selected = draftActivity === a.value;
                return (
                  <Pressable
                    key={a.value}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setDraftActivity(selected ? null : a.value)}
                  >
                    <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{a.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.btnRow}>
              <Pressable style={styles.btnSecondary} onPress={() => setEditingTypes(false)}>
                <Text style={styles.btnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.btnPrimary} onPress={saveTypes}>
                <Text style={styles.btnPrimaryText}>Save</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  stickyNav: {
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
    zIndex: 10,
  },
  stickyNavInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 4, paddingVertical: 4, gap: 2,
  },
  stickyNavTitleWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    paddingHorizontal: 116,
    overflow: 'hidden',
  },
  stickyNavTitle: {
    fontSize: 15, fontWeight: '600', color: T.primary,
    fontFamily: 'Fraunces-Regular',
    textAlign: 'center',
  },
  floatingNav: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  floatingNavInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 6, gap: 4,
  },
  floatingNavBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  navBtnCompact: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },

  hero: { paddingTop: 96, paddingBottom: 10 },
  heroContent: { paddingHorizontal: 20, paddingTop: 20 },
  heroName: {
    fontSize: 45, fontWeight: '700', color: '#000',
    fontFamily: 'Fraunces-Regular', lineHeight: 50, marginBottom: 12,
  },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },

  whiteCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20,
  },

  tagsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tag: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EEEEFF', borderWidth: 1, borderColor: FUTURE_BLUE,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  tagText: { fontSize: 13, fontWeight: '600' },
  logBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: T.accentTint, borderWidth: 1.5, borderColor: T.accent,
    alignItems: 'center', justifyContent: 'center',
  },

  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: T.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10,
  },

  notesCard: {
    backgroundColor: T.card, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: T.border,
  },
  notesText: { fontSize: 15, color: T.primary, lineHeight: 23 },

  typeTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeTag: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  typeTagText: { fontSize: 13, color: T.primary, fontWeight: '500' },

  mapCard: { height: 140, borderRadius: 14, overflow: 'hidden', backgroundColor: '#e8e8ed' },
  pin: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: FUTURE_BLUE,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 3,
  },
  mapAddress: { fontSize: 12, color: T.muted, marginTop: 8, paddingHorizontal: 2 },

  editRoot: { flex: 1, backgroundColor: T.bg },
  editContent: { padding: 24, paddingTop: 28 },
  editTitle: { fontSize: 18, fontWeight: '700', color: T.primary, textAlign: 'center', marginBottom: 6 },
  editSubtitle: { fontSize: 13, color: T.muted, textAlign: 'center', marginBottom: 28 },
  editSectionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  editSectionLabel: { fontSize: 11, fontWeight: '700', color: T.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  editSectionAsterisk: { fontSize: 11, fontWeight: '700', color: T.accent },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: T.bg, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1.5, borderColor: T.border,
  },
  chipSelected: { backgroundColor: T.accent, borderColor: T.accent },
  chipLabel: { fontSize: 13, fontWeight: '600', color: T.primary },
  chipLabelSelected: { color: '#fff' },
  occasionTrack: {
    flexDirection: 'row', backgroundColor: T.segBg,
    borderRadius: 50, padding: 4, marginBottom: 28,
  },
  occasionBtn: {
    flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center',
    borderRadius: 50,
  },
  occasionBtnSelected: { backgroundColor: T.accent },
  occasionLabel: { fontSize: 14, fontWeight: '600', color: T.primary },
  occasionLabelSelected: { color: '#fff' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btnPrimary: { flex: 1, backgroundColor: 'transparent', borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: T.accent },
  btnPrimaryText: { color: T.accent, fontSize: 16, fontWeight: '700' },
  btnSecondary: { flex: 1, backgroundColor: T.inputBg, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnSecondaryText: { color: T.primary, fontSize: 16, fontWeight: '600' },

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
  beliCardContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    marginTop: -24,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 60,
  },
  beliTopRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  wantToGoTag: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EEEEFF', borderWidth: 1, borderColor: FUTURE_BLUE,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  wantToGoTagText: { fontSize: 13, fontWeight: '600' },
  logVisitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: T.accentTint, borderWidth: 1.5, borderColor: T.accent,
  },
  logVisitBtnText: { fontSize: 13, fontWeight: '600', color: T.accent },
  beliVenueName: {
    fontSize: 28, fontWeight: '700', color: '#000',
    fontFamily: 'Fraunces-Regular', lineHeight: 34, marginBottom: 10,
  },
  beliTags: { fontSize: 13, color: T.muted, marginBottom: 4, lineHeight: 19 },
  beliAddress: { fontSize: 13, color: T.muted, lineHeight: 18 },
  divider: {
    height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginVertical: 20,
  },
});
