import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Image,
  ActionSheetIOS, Alert, ScrollView, Dimensions, TextInput,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useLocalSearchParams, router, useFocusEffect, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getVisitById, deleteVisit, updateVisit, Visit,
  ACTIVITY_TYPES, PRICE_LABELS, Price, ActivityType,
  ratingColor, formatRating,
} from '@/lib/visits';

const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD = 20;
const PHOTO_COLS = 3;
const PHOTO_GAP = 4;
const PHOTO_SIZE = (SCREEN_W - H_PAD * 2 - PHOTO_GAP * (PHOTO_COLS - 1)) / PHOTO_COLS;

export default function SpotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [editing, setEditing] = useState(false);

  useFocusEffect(useCallback(() => {
    if (id) setVisit(getVisitById(id));
  }, [id]));

  if (!visit) return null;

  function handleMenu() {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Cancel', 'Edit', 'Delete spot'], destructiveButtonIndex: 2, cancelButtonIndex: 0 },
      (i) => {
        if (i === 1) setEditing(true);
        if (i === 2) {
          Alert.alert('Delete spot', `Remove "${visit!.venue_name}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete', style: 'destructive', onPress: () => {
                deleteVisit(id);
                router.back();
              },
            },
          ]);
        }
      }
    );
  }

  const info = ACTIVITY_TYPES.find((a) => a.value === visit.activity_type);
  const color = ratingColor(visit.rating);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.headerSafe} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.headerBtn}>
            <Ionicons name="chevron-back" size={26} color="#78350f" />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={handleMenu} hitSlop={12} style={styles.headerBtn}>
            <Ionicons name="ellipsis-horizontal" size={22} color="#78350f" />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={[styles.ratingBadge, { backgroundColor: color }]}>
            <Text style={styles.ratingScore}>{formatRating(visit.rating)}</Text>
            <Text style={styles.ratingLabel}>/ 10</Text>
          </View>
          <Text style={styles.venueName}>{visit.venue_name}</Text>
          <View style={styles.badges}>
            {info && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{info.emoji}  {info.label}</Text>
              </View>
            )}
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{PRICE_LABELS[visit.price as Price]}</Text>
            </View>
            {visit.visited_at ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{visit.visited_at}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Notes */}
        {visit.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{visit.notes}</Text>
            </View>
          </View>
        ) : null}

        {/* Map card */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Location</Text>
          <Pressable style={styles.mapCard} onPress={() => setMapExpanded(true)}>
            <MapView
              style={StyleSheet.absoluteFill}
              region={{
                latitude: visit.lat,
                longitude: visit.lng,
                latitudeDelta: 0.004,
                longitudeDelta: 0.004,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              showsUserLocation={false}
              showsPointsOfInterest={false}
              showsCompass={false}
              showsScale={false}
              mapType="standard"
              pointerEvents="none"
            >
              <Marker coordinate={{ latitude: visit.lat, longitude: visit.lng }}>
                <View style={[styles.pinBadge, { backgroundColor: color }]}>
                  <Text style={styles.pinScore}>{formatRating(visit.rating)}</Text>
                </View>
              </Marker>
            </MapView>
            <View style={styles.mapExpandHint}>
              <Ionicons name="expand-outline" size={13} color="#fff" />
              <Text style={styles.mapExpandText}>Tap to explore</Text>
            </View>
          </Pressable>
        </View>

        {/* Photos grid */}
        {visit.photos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Photos</Text>
            <View style={styles.photosGrid}>
              {visit.photos.map((uri, idx) => (
                <Image
                  key={idx}
                  source={{ uri }}
                  style={styles.photoThumb}
                  resizeMode="cover"
                />
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Full-screen map modal — MapView fills entirely, header overlays on top */}
      <Modal visible={mapExpanded} animationType="slide">
        <View style={styles.fullMapRoot}>
          <MapView
            style={StyleSheet.absoluteFill}
            initialRegion={{
              latitude: visit.lat,
              longitude: visit.lng,
              latitudeDelta: 0.012,
              longitudeDelta: 0.012,
            }}
            showsUserLocation={false}
            showsPointsOfInterest={false}
            mapType="standard"
          >
            <Marker coordinate={{ latitude: visit.lat, longitude: visit.lng }}>
              <View style={[styles.pinBadge, { backgroundColor: color }]}>
                <Text style={styles.pinScore}>{formatRating(visit.rating)}</Text>
              </View>
            </Marker>
          </MapView>

          {/* Overlay header — rendered after MapView so it's on top in z-order */}
          <SafeAreaView style={styles.modalOverlay} edges={['top']} pointerEvents="box-none">
            <View style={styles.modalHeader} pointerEvents="auto">
              <Pressable
                onPress={() => setMapExpanded(false)}
                hitSlop={16}
                style={styles.modalBackBtn}
              >
                <Ionicons name="chevron-back" size={22} color="#1c1c1e" />
              </Pressable>
              <View style={styles.modalTitlePill}>
                <Text style={styles.modalTitleText} numberOfLines={1}>{visit.venue_name}</Text>
              </View>
              <View style={{ width: 44 }} />
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {editing && (
        <EditModal
          visit={visit}
          onClose={() => setEditing(false)}
          onSave={(updated) => { setVisit(updated); setEditing(false); }}
        />
      )}
    </View>
  );
}

function EditModal({
  visit, onClose, onSave,
}: {
  visit: Visit;
  onClose: () => void;
  onSave: (updated: Visit) => void;
}) {
  const [name, setName] = useState(visit.venue_name);
  const [date, setDate] = useState(visit.visited_at);
  const [notes, setNotes] = useState(visit.notes ?? '');
  const [activity, setActivity] = useState<ActivityType>(visit.activity_type);
  const [price, setPrice] = useState<Price>(visit.price);

  function handleSave() {
    if (!name.trim()) { Alert.alert('Name required', 'Give this spot a name.'); return; }
    updateVisit(visit.id, {
      venue_name: name.trim(),
      visited_at: date,
      notes: notes.trim() || null,
      activity_type: activity,
      price,
    });
    const updated = getVisitById(visit.id);
    if (updated) onSave(updated);
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={editStyles.root} edges={['top', 'bottom']}>
        <View style={editStyles.header}>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={editStyles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={editStyles.title}>Edit spot</Text>
          <Pressable onPress={handleSave} hitSlop={8}>
            <Text style={editStyles.save}>Save</Text>
          </Pressable>
        </View>

        <ScrollView style={editStyles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TextInput
            style={editStyles.input}
            placeholder="Venue name"
            placeholderTextColor="#c7c7cc"
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="next"
          />
          <TextInput
            style={editStyles.input}
            placeholder="Date (e.g. Apr 28)"
            placeholderTextColor="#c7c7cc"
            value={date}
            onChangeText={setDate}
            returnKeyType="next"
          />

          <Text style={editStyles.sectionLabel}>What kind of spot?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={editStyles.chipScroll}>
            {ACTIVITY_TYPES.map((a) => {
              const sel = activity === a.value;
              return (
                <Pressable
                  key={a.value}
                  style={[editStyles.chip, sel && editStyles.chipSelected]}
                  onPress={() => setActivity(a.value)}
                >
                  <Text style={editStyles.chipEmoji}>{a.emoji}</Text>
                  <Text style={[editStyles.chipLabel, sel && editStyles.chipLabelSel]}>{a.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={editStyles.sectionLabel}>Price range</Text>
          <View style={editStyles.priceRow}>
            {([1, 2, 3] as Price[]).map((p) => {
              const sel = price === p;
              return (
                <Pressable
                  key={p}
                  style={[editStyles.priceBtn, sel && editStyles.priceBtnSel]}
                  onPress={() => setPrice(p)}
                >
                  <Text style={[editStyles.priceBtnText, sel && editStyles.priceBtnTextSel]}>
                    {PRICE_LABELS[p]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            style={[editStyles.input, editStyles.inputMultiline]}
            placeholder="Notes — what made it memorable?"
            placeholderTextColor="#c7c7cc"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
          />
          <View style={{ height: 24 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff8ee' },

  headerSafe: { backgroundColor: '#fff8ee' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 4,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  hero: {
    paddingHorizontal: H_PAD,
    paddingTop: 8,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: '#fde8c8',
    marginBottom: 4,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    marginBottom: 14,
    gap: 3,
  },
  ratingScore: { fontSize: 26, fontWeight: '800', color: '#fff' },
  ratingLabel: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },

  venueName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#431407',
    lineHeight: 32,
    letterSpacing: -0.5,
    marginBottom: 14,
  },

  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fde8c8',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: { fontSize: 13, fontWeight: '500', color: '#92400e' },

  section: { paddingHorizontal: H_PAD, marginTop: 24 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },

  notesCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fde8c8',
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  notesText: { fontSize: 15, color: '#431407', lineHeight: 22 },

  mapCard: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#e8e8ed',
  },
  mapExpandHint: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  mapExpandText: { fontSize: 12, fontWeight: '600', color: '#fff' },

  pinBadge: {
    minWidth: 38, height: 24, borderRadius: 12,
    paddingHorizontal: 7,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, shadowRadius: 3,
  },
  pinScore: { fontSize: 11, fontWeight: '800', color: '#fff' },

  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PHOTO_GAP,
  },
  photoThumb: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 10,
    backgroundColor: '#f2f2f7',
  },

  // Full-screen map modal
  fullMapRoot: { flex: 1 },

  // Overlay sits on top of the MapView — must come after MapView in JSX
  modalOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 8,
  },
  modalBackBtn: {
    width: 44, height: 44,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  modalTitlePill: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  modalTitleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1c1c1e',
    textAlign: 'center',
  },
});

const editStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5ea',
  },
  cancel: { fontSize: 16, color: '#8e8e93' },
  title: { fontSize: 17, fontWeight: '600', color: '#1c1c1e' },
  save: { fontSize: 16, fontWeight: '600', color: '#ff3b5c' },
  form: { paddingHorizontal: 20, paddingTop: 16 },
  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: '#8e8e93',
    marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#f2f2f7', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#1c1c1e', marginBottom: 12,
  },
  inputMultiline: { minHeight: 100, textAlignVertical: 'top' },
  chipScroll: { marginBottom: 16, marginHorizontal: -20 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#f2f2f7', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9, marginRight: 8,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  chipSelected: { backgroundColor: '#fff0f3', borderColor: '#ff3b5c' },
  chipEmoji: { fontSize: 15 },
  chipLabel: { fontSize: 14, fontWeight: '500', color: '#3a3a3c' },
  chipLabelSel: { color: '#ff3b5c', fontWeight: '700' },
  priceRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  priceBtn: {
    flex: 1, backgroundColor: '#f2f2f7', borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  priceBtnSel: { backgroundColor: '#fff0f3', borderColor: '#ff3b5c' },
  priceBtnText: { fontSize: 16, fontWeight: '600', color: '#3a3a3c' },
  priceBtnTextSel: { color: '#ff3b5c' },
});
