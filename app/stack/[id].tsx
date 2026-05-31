import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Alert,
  ScrollView, TextInput, Image, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getStackDetail, updateStack, deleteStack,
  removeVisitFromStack,
  StackDetail, StackVisitRow,
} from '@/lib/stacks';
import { ratingColor, formatRating, friendlyDate, ACTIVITY_TYPES } from '@/lib/visits';
import { T } from '@/lib/theme';

// ─── Edit Stack Modal ─────────────────────────────────────────────────────────

function EditStackModal({ stack, onClose, onSave }: {
  stack: StackDetail;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState(stack.name);
  const [saving, setSaving] = useState(false);
  const [visits, setVisits] = useState<StackVisitRow[]>(stack.visits);

  function handleRemoveSpot(visitId: string) {
    if (visits.length <= 2) {
      Alert.alert(
        'Cannot Remove',
        'A stack needs at least 2 spots. Remove another spot first or delete the stack.'
      );
      return;
    }
    setVisits(prev => prev.filter(v => v.visit_id !== visitId));
  }

  function handleSave() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give this stack a name.');
      return;
    }
    setSaving(true);
    updateStack(stack.id, name.trim());
    // Apply spot removals
    const removedIds = stack.visits
      .map(v => v.visit_id)
      .filter(id => !visits.find(v => v.visit_id === id));
    for (const visitId of removedIds) {
      removeVisitFromStack(stack.id, visitId);
    }
    setSaving(false);
    onSave();
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={em.root} edges={['top', 'bottom']}>
        <View style={em.header}>
          <Pressable onPress={onClose} hitSlop={8}><Text style={em.cancel}>Cancel</Text></Pressable>
          <Text style={em.title}>Edit Stack</Text>
          <Pressable onPress={handleSave} disabled={saving} hitSlop={8}>
            <Text style={em.save}>{saving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>
        <ScrollView style={em.form} keyboardShouldPersistTaps="handled">
          <Text style={em.label}>Stack name</Text>
          <TextInput
            style={em.input}
            value={name}
            onChangeText={setName}
            placeholder="Name this date night"
            placeholderTextColor={T.placeholder}
            autoFocus
          />
          <Text style={em.label}>Spots ({visits.length})</Text>
          {visits.map((v, idx) => {
            const color = ratingColor(v.rating);
            return (
              <View key={v.visit_id} style={em.spotRow}>
                <View style={[em.spotAccent, { backgroundColor: color }]} />
                <Text style={em.spotName} numberOfLines={1}>{v.venue_name}</Text>
                <Pressable
                  onPress={() => handleRemoveSpot(v.visit_id)}
                  hitSlop={8}
                  style={em.removeBtn}
                  accessibilityLabel={`Remove ${v.venue_name}`}
                >
                  <Ionicons name="close-circle" size={20} color={T.muted} />
                </Pressable>
              </View>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Spot Mini Card ───────────────────────────────────────────────────────────

function SpotMiniCard({ visit, index }: { visit: StackVisitRow; index: number }) {
  const color = ratingColor(visit.rating);
  const dateStr = friendlyDate(visit.visited_at);

  return (
    <Pressable
      style={({ pressed }) => [s.spotCard, pressed && { opacity: 0.7 }]}
      onPress={() => router.push(`/spot/${visit.visit_id}`)}
    >
      <View style={[s.accentBar, { backgroundColor: color }]} />
      <Text style={s.spotIndex}>{index + 1}</Text>
      <View style={s.spotInfo}>
        <Text style={s.spotName} numberOfLines={1}>{visit.venue_name}</Text>
        <Text style={s.spotMeta}>{ACTIVITY_TYPES.find(a => a.value === visit.activity_type)?.label ?? visit.activity_type} · {dateStr}</Text>
      </View>
      {visit.rating > 0 && (
        <View style={[s.scorePill, { borderColor: color }]}>
          <Text style={[s.scorePillText, { color }]}>{formatRating(visit.rating)}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function StackDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<StackDetail | null>(() => id ? getStackDetail(id) : null);
  const [editing, setEditing] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!id) return;
    setDetail(getStackDetail(id));
  }, [id]));

  if (!detail) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
      <ActivityIndicator color={T.accent} />
    </SafeAreaView>
  );

  const avgRating = detail.visits.length > 0
    ? detail.visits.reduce((sum, v) => sum + v.rating, 0) / detail.visits.length
    : 0;
  const qualityColor = ratingColor(avgRating);
  const dateStr = friendlyDate(detail.created_at);
  const allPhotos = detail.visits.flatMap(v => v.photos).filter(Boolean);

  function handleDelete() {
    Alert.alert(
      'Delete Stack',
      `Delete "${detail!.name}"? The individual spots will remain in your log.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: () => {
            deleteStack(id);
            router.back();
          },
        },
      ]
    );
  }

  return (
    <View style={s.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={s.headerSafe} edges={['top']}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.headerBtn}>
            <Ionicons name="chevron-back" size={26} color={T.primary} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => setEditing(true)} hitSlop={12} style={s.headerBtn}>
            <Ionicons name="pencil-outline" size={20} color={T.primary} />
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={12} style={s.headerBtn}>
            <Ionicons name="trash-outline" size={20} color={T.danger} />
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroName}>{detail.name}</Text>
          <View style={s.heroMeta}>
            <View style={s.spotCountBadge}>
              <Text style={s.spotCountText}>{detail.visits.length} spot{detail.visits.length !== 1 ? 's' : ''}</Text>
            </View>
            {avgRating > 0 && (
              <View style={[s.qualityDot, { borderColor: qualityColor }]}>
                <Text style={[s.qualityLabel, { color: qualityColor }]}>{formatRating(avgRating)} avg</Text>
              </View>
            )}
          </View>

          {(() => {
            const types = [...new Set(detail.visits.map(v => v.activity_type))];
            return types.length > 0 ? (
              <View style={s.categoryPills}>
                {types.map(at => {
                  const label = ACTIVITY_TYPES.find(a => a.value === at)?.label ?? at;
                  return (
                    <View key={at} style={s.categoryPill}>
                      <Text style={s.categoryPillText}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null;
          })()}

        </View>

        {/* Spots */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>SPOTS</Text>
          {detail.visits.map((v, idx) => (
            <SpotMiniCard key={v.visit_id} visit={v} index={idx} />
          ))}
        </View>

        {/* Photos */}
        {allPhotos.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>PHOTOS</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.photoStrip}
              contentContainerStyle={s.photoStripContent}
            >
              {allPhotos.map((uri, i) => (
                <Image key={i} source={{ uri }} style={s.photoThumb} />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>

      {editing && (
        <EditStackModal
          stack={detail}
          onClose={() => setEditing(false)}
          onSave={() => {
            setEditing(false);
            const refreshed = getStackDetail(id);
            if (refreshed) {
              setDetail(refreshed);
            } else {
              router.back();
            }
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  headerSafe: { backgroundColor: T.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 2 },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  hero: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  heroName: {
    fontSize: 26,
    fontWeight: '400',
    color: T.primary,
    fontFamily: 'Fraunces-Regular',
    lineHeight: 32,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroDate: { fontSize: 14, color: T.muted, fontWeight: '500', marginBottom: 12 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' },

  spotCountBadge: {
    backgroundColor: T.inputBg,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  spotCountText: { fontSize: 13, fontWeight: '600', color: T.muted },

  qualityDot: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  qualityLabel: { fontSize: 13, fontWeight: '700' },

  categoryPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  categoryPill: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10, borderWidth: 1, borderColor: T.border,
    backgroundColor: T.inputBg,
  },
  categoryPillText: { fontSize: 12, fontWeight: '500', color: T.muted },

  photoStrip: {
    marginHorizontal: -20,
  },
  photoStripContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  photoThumb: {
    width: 96,
    height: 96,
    borderRadius: 10,
    backgroundColor: T.inputBg,
  },

  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: T.muted,
    letterSpacing: 1.2,
    marginBottom: 12,
  },

  spotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: 10,
    minHeight: 36,
  },
  spotIndex: { fontSize: 13, fontWeight: '500', color: T.muted, width: 20, textAlign: 'center', marginRight: 10 },
  spotInfo: { flex: 1, marginRight: 10 },
  spotName: { fontSize: 15, fontWeight: '600', color: T.primary, marginBottom: 2 },
  spotMeta: { fontSize: 12, color: T.muted, textTransform: 'capitalize' },
  scorePill: {
    borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3,
    backgroundColor: 'transparent', minWidth: 42, alignItems: 'center',
  },
  scorePillText: { fontSize: 12, fontWeight: '800' },

});

const em = StyleSheet.create({
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
  label: { fontSize: 12, fontWeight: '600', color: T.muted, marginBottom: 7, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: T.inputBg, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: T.primary, marginBottom: 20,
  },
  spotRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border,
    gap: 10,
    minHeight: 44,
  },
  spotAccent: { width: 4, height: 36, borderRadius: 2 },
  spotName: { flex: 1, fontSize: 14, fontWeight: '600', color: T.primary },
  removeBtn: { padding: 4 },
});
