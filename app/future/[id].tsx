import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Alert, ScrollView, Share,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useLocalSearchParams, router, useFocusEffect, Stack } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getFutureSpotById, deleteFutureSpot, updateFutureSpot, updateFutureSpotTypes, FutureSpot,
} from '@/lib/future';
import { friendlyDate, ACTIVITY_TYPES, OCCASION_TYPES } from '@/lib/visits';
import { T } from '@/lib/theme';

const H_PAD = 20;

export default function FutureSpotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [spot, setSpot] = useState<FutureSpot | null>(() =>
    id ? getFutureSpotById(id as string) : null
  );
  const [mapExpanded, setMapExpanded] = useState(false);
  const [editingTypes, setEditingTypes] = useState(false);
  const [draftActivity, setDraftActivity] = useState<string | null>(null);
  const [draftOccasion, setDraftOccasion] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    if (id) setSpot(getFutureSpotById(id));
  }, [id]));

  if (!spot) return null;

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

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.headerSafe, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={26} color={T.primary} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={handleShare} hitSlop={12} style={styles.headerBtn}>
            <Ionicons name="share-outline" size={22} color={T.primary} />
          </Pressable>
          <Pressable onPress={handleEdit} hitSlop={12} style={styles.headerBtn}>
            <Ionicons name="pencil-outline" size={20} color={T.primary} />
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={12} style={styles.headerBtn}>
            <Ionicons name="trash-outline" size={20} color={T.danger} />
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.venueName}>{spot.venue_name}</Text>
          <Text style={styles.dateStr}>Added {dateStr}</Text>

          <View style={styles.tags}>
            <View style={styles.tag}>
              <Ionicons name="bookmark" size={13} color="#5856d6" style={{ marginRight: 4 }} />
              <Text style={[styles.tagText, { color: '#5856d6' }]}>Want to go</Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {spot.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{spot.notes}</Text>
            </View>
          </View>
        ) : null}

        {/* Category / type */}
        {(spot.activity_type || spot.occasion_type) ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Type</Text>
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
          </View>
        ) : null}

        {/* Map */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Location</Text>
          <Pressable style={styles.mapCard} onPress={() => setMapExpanded(true)}>
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
            <View style={styles.mapHint}>
              <Ionicons name="expand-outline" size={12} color="#fff" />
              <Text style={styles.mapHintText}>Expand</Text>
            </View>
          </Pressable>
          {spot.address ? spot.address.split('\n').map((line, i) => (
            <Text key={i} style={styles.mapAddress}>{line}</Text>
          )) : null}
        </View>

        <View style={{ height: 48 }} />
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

      {/* Full-screen map modal */}
      <Modal visible={mapExpanded} animationType="slide">
        <View style={styles.fullMap}>
          <MapView
            style={StyleSheet.absoluteFill}
            initialRegion={{ latitude: spot.lat, longitude: spot.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
            showsUserLocation={false} showsPointsOfInterest={false} mapType="standard"
          >
            <Marker coordinate={{ latitude: spot.lat, longitude: spot.lng }}>
              <View style={styles.pin}>
                <Ionicons name="bookmark" size={14} color="#fff" />
              </View>
            </Marker>
          </MapView>
          <SafeAreaView style={styles.modalOverlay} edges={['top']} pointerEvents="box-none">
            <View style={styles.modalHeader} pointerEvents="auto">
              <Pressable onPress={() => setMapExpanded(false)} hitSlop={16} style={styles.modalBackBtn}>
                <Ionicons name="chevron-back" size={22} color="#1c1c1e" />
              </Pressable>
              <View style={styles.modalPill}>
                <Text style={styles.modalPillText} numberOfLines={1}>{spot.venue_name}</Text>
              </View>
              <View style={{ width: 44 }} />
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
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

  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EEEEFF', borderWidth: 1, borderColor: '#5856d6',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  tagText: { fontSize: 13, fontWeight: '600' },

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

  mapCard: { height: 140, borderRadius: 14, overflow: 'hidden', backgroundColor: '#e8e8ed' },
  mapHint: {
    position: 'absolute', bottom: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 20,
    paddingHorizontal: 9, paddingVertical: 4,
  },
  mapHintText: { fontSize: 11, fontWeight: '600', color: '#fff' },

  pin: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#5856d6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 3,
  },

  mapAddress: { fontSize: 12, color: T.muted, marginTop: 8, paddingHorizontal: 2 },

  typeTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeTag: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  typeTagText: { fontSize: 13, color: T.primary, fontWeight: '500' },

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
