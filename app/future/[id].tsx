import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Alert, ScrollView, Share, Dimensions,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useLocalSearchParams, router, useFocusEffect, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getFutureSpotById, deleteFutureSpot, updateFutureSpotTypes, FutureSpot,
} from '@/lib/future';
import { friendlyDate, ACTIVITY_TYPES, OCCASION_TYPES } from '@/lib/visits';
import { T } from '@/lib/theme';
import { scheduleOpenLogWithLocation, cleanAddress } from '@/app/(tabs)/map';
import { useShimmer, SkBox } from '@/components/SkeletonBox';

const FUTURE_BLUE = '#5856d6';
const SCREEN_H = Dimensions.get('window').height;

function FutureSpotDetailSkeleton() {
  const { shimmer, screenW } = useShimmer();
  const sk = (w: number | `${number}%`, h: number, r?: number, style?: object) => (
    <SkBox shimmer={shimmer} w={w} h={h} r={r ?? 4} style={style} screenW={screenW} />
  );
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ backgroundColor: FUTURE_BLUE, paddingTop: 96, paddingBottom: 10 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          {sk(100, 11, 3, { marginBottom: 6 })}
          {sk(200, 26, 4, { marginBottom: 4 })}
          {sk(120, 13, 3)}
        </View>
      </View>
      <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {sk(120, 30, 20)}
          {sk(38, 38, 19)}
        </View>
        <View style={{ height: 20 }} />
        {sk(38, 10, 3, { marginBottom: 10 })}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
          {sk(64, 28, 20)}
          {sk(80, 28, 20)}
        </View>
        {sk(70, 10, 3, { marginBottom: 10 })}
        {sk('100%', 140, 14)}
        {sk(180, 12, 3, { marginTop: 8, marginLeft: 2 })}
      </View>
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
          deleteFutureSpot(id);
          router.back();
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

      {/* Floating header */}
      <SafeAreaView style={styles.floatingHeader} edges={['top']}>
        <View style={styles.floatingHeaderInner}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.floatingBtn}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={handleShare} hitSlop={12} style={styles.floatingBtn}>
            <Ionicons name="share-outline" size={20} color="#fff" />
          </Pressable>
          <Pressable onPress={handleEdit} hitSlop={12} style={styles.floatingBtn}>
            <Ionicons name="pencil-outline" size={18} color="#fff" />
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={12} style={styles.floatingBtn}>
            <Ionicons name="trash-outline" size={18} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ backgroundColor: FUTURE_BLUE }}>

          {/* Colored hero */}
          <View style={styles.hero}>
            <View style={styles.heroContent}>
              <Text style={styles.heroMeta}>
                {metaParts.length > 0 ? metaParts.join(' · ').toUpperCase() : 'WANT TO GO'}
              </Text>
              <Text style={styles.heroName}>{spot.venue_name}</Text>
              <Text style={styles.heroSub}>Added {dateStr}</Text>
            </View>
          </View>

          {/* White card */}
          <View style={[styles.whiteCard, { minHeight: SCREEN_H }]}>

            {/* Tags row — want to go badge + log button */}
            <View style={styles.tagsRow}>
              <View style={styles.tag}>
                <Ionicons name="bookmark" size={13} color={FUTURE_BLUE} style={{ marginRight: 4 }} />
                <Text style={[styles.tagText, { color: FUTURE_BLUE }]}>Want to go</Text>
              </View>
              <Pressable style={styles.logBtn} onPress={handleLog} hitSlop={8}>
                <Ionicons name="add" size={18} color={T.accent} />
              </Pressable>
            </View>

            <View style={{ height: 20 }} />

            {/* Notes */}
            {spot.notes ? (
              <>
                <Text style={styles.sectionLabel}>NOTES</Text>
                <View style={styles.notesCard}>
                  <Text style={styles.notesText}>{spot.notes}</Text>
                </View>
                <View style={{ height: 20 }} />
              </>
            ) : null}

            {/* Category / type */}
            {(spot.activity_type || spot.occasion_type) ? (
              <>
                <Text style={styles.sectionLabel}>TYPE</Text>
                <View style={styles.typeTags}>
                  {spot.activity_type ? (
                    <View style={styles.typeTag}>
                      <Text style={styles.typeTagText}>
                        {ACTIVITY_TYPES.find(a => a.value === spot.activity_type)?.label ?? spot.activity_type}
                      </Text>
                    </View>
                  ) : null}
                  {spot.occasion_type ? (
                    <View style={styles.typeTag}>
                      <Text style={styles.typeTagText}>
                        {OCCASION_TYPES.find(a => a.value === spot.occasion_type)?.label ?? spot.occasion_type}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={{ height: 20 }} />
              </>
            ) : null}

            {/* Map */}
            <Text style={styles.sectionLabel}>WHERE IT IS</Text>
            <View style={styles.mapCard}>
              <MapView
                style={StyleSheet.absoluteFill}
                region={{ latitude: spot.lat, longitude: spot.lng, latitudeDelta: 0.006, longitudeDelta: 0.006 }}
                scrollEnabled={false} zoomEnabled={false} rotateEnabled={false}
                pitchEnabled={false} showsUserLocation={false} showsPointsOfInterest={false}
                showsCompass={false} showsScale={false} mapType="standard" pointerEvents="none"
              >
                <Marker coordinate={{ latitude: spot.lat, longitude: spot.lng }}>
                  <View style={styles.pin}>
                    <Ionicons name="bookmark" size={14} color="#fff" />
                  </View>
                </Marker>
              </MapView>
            </View>
            {spot.address ? cleanAddress(spot.address).split('\n').filter(Boolean).map((line, i) => (
              <Text key={i} style={styles.mapAddress}>{line}</Text>
            )) : null}

            <View style={{ height: 40 }} />
          </View>
        </View>
      </ScrollView>

      {/* Edit types modal */}
      <Modal visible={editingTypes} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.editRoot} edges={['top', 'bottom']}>
          <ScrollView contentContainerStyle={styles.editContent}>
            <Text style={styles.editTitle}>Save for later</Text>
            <Text style={styles.editSubtitle}>{spot.venue_name}</Text>
            <Text style={styles.editSectionLabel}>Category</Text>
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
            <Text style={styles.editSectionLabel}>What kind of date?</Text>
            <View style={styles.occasionRow}>
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
  floatingHeader: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 10,
  },
  floatingHeaderInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8, gap: 10,
  },
  floatingBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  hero: { paddingTop: 96, paddingBottom: 10 },
  heroContent: { paddingHorizontal: 20, paddingTop: 20 },
  heroMeta: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1, marginBottom: 6,
  },
  heroName: {
    fontSize: 24, fontWeight: '400', color: '#fff',
    fontFamily: 'Fraunces-Regular', lineHeight: 30, marginBottom: 4,
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
  editSectionLabel: { fontSize: 12, fontWeight: '600', color: T.muted, marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.5 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: T.card, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9,
    borderWidth: 1.5, borderColor: T.border,
  },
  chipSelected: { backgroundColor: T.accentTint, borderColor: T.accent },
  chipLabel: { fontSize: 13, fontWeight: '600', color: T.primary },
  chipLabelSelected: { color: T.accent },
  occasionRow: { flexDirection: 'row', gap: 8, marginBottom: 28 },
  occasionBtn: {
    flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.inputBg,
  },
  occasionBtnSelected: { backgroundColor: T.accentTint, borderColor: T.accent },
  occasionLabel: { fontSize: 14, fontWeight: '600', color: T.primary },
  occasionLabelSelected: { color: T.accent },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btnPrimary: { flex: 1, backgroundColor: 'transparent', borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: T.accent },
  btnPrimaryText: { color: T.accent, fontSize: 16, fontWeight: '700' },
  btnSecondary: { flex: 1, backgroundColor: T.inputBg, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnSecondaryText: { color: T.primary, fontSize: 16, fontWeight: '600' },
});
