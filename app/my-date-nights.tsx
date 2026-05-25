import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, ScrollView, Image, Animated, Easing, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getAllStacks, StackSummary, TierKey, TIER_ORDER, TIER_CONFIG, stackTier } from '@/lib/stacks';
import { T } from '@/lib/theme';

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
        <View style={[tc.wash, { backgroundColor: cfg.bg }]} />
        <View style={tc.badgeWrap}>
          <View style={[tc.badge, { backgroundColor: cfg.bg }]}>
            <Text style={[tc.badgeText, { color: cfg.text }]}>{tier}</Text>
          </View>
          <Text style={tc.stackCount}>
            {stacks.length} {stacks.length === 1 ? 'Stack' : 'Stacks'}
          </Text>
        </View>
        <View style={tc.divider} />
        <View style={tc.photoArea}>
          {stacks.map((st) =>
            st.cover_photo ? (
              <Image key={st.id} source={{ uri: st.cover_photo }} style={tc.photo} resizeMode="cover" />
            ) : (
              <View key={st.id} style={tc.photoPlaceholder}>
                <Text style={tc.photoPlaceholderText}>{st.name.trim()[0] ?? '?'}</Text>
              </View>
            )
          )}
        </View>
        <Ionicons name="chevron-forward" size={14} color={T.muted} style={tc.chevron} />
      </Pressable>
    </Animated.View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MyDateNightsScreen() {
  const [stacks, setStacks] = useState<StackSummary[]>(() => getAllStacks());
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
      setStacks(getAllStacks());
    }, [])
  );

  const stacksByTier = useMemo(() => {
    const groups: Record<TierKey, StackSummary[]> = { S: [], A: [], B: [], C: [], F: [] };
    for (const stack of stacks) {
      groups[stackTier(stack)].push(stack);
    }
    return groups;
  }, [stacks]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.header}>
          <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={T.primary} />
          </Pressable>
          <Text style={s.title}>Date Nights</Text>
          <View style={{ width: 44 }} />
        </View>

        {stacks.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="layers-outline" size={36} color={T.muted} style={{ marginBottom: 12 }} />
            <Text style={s.emptyTitle}>No stacks yet</Text>
            <Text style={s.emptySubtitle}>
              Group spots from the same date night into a single story.
            </Text>
            <Pressable style={s.tryItBtn} onPress={() => router.push('/my-spots?select=true' as any)}>
              <Text style={s.tryItBtnText}>Try it</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={s.toolbar}>
              <Text style={s.countLabel}>{stacks.length} stack{stacks.length !== 1 ? 's' : ''}</Text>
              <Pressable style={s.newStackBtn} onPress={() => router.push('/my-spots?select=true' as any)}>
                <Ionicons name="add" size={16} color={T.accent} />
                <Text style={s.newStackBtnText}>New Stack</Text>
              </Pressable>
            </View>
            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.listContent}
            >
              {TIER_ORDER.map(tier => (
                <TierRow key={tier} tier={tier} stacks={stacksByTier[tier]} />
              ))}
            </ScrollView>
          </>
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
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  countLabel: { fontSize: 13, color: T.muted },
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
  listContent: { paddingBottom: 120, paddingTop: 8 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 16, fontWeight: '400', color: T.primary,
    fontFamily: 'Fraunces-Regular', textAlign: 'center',
  },
  emptySubtitle: { fontSize: 14, color: T.muted, textAlign: 'center', lineHeight: 20, marginTop: 4 },
  tryItBtn: {
    marginTop: 16, backgroundColor: T.accent, borderRadius: 20,
    paddingHorizontal: 24, paddingVertical: 10,
  },
  tryItBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
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
  wash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.07 },
  badgeWrap: { width: 88, alignItems: 'center', justifyContent: 'center', gap: 5, zIndex: 1 },
  badge: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6,
  },
  badgeText: { fontSize: 24, fontWeight: '800', letterSpacing: -1 },
  stackCount: { fontSize: 9, fontWeight: '700', color: T.muted, letterSpacing: 0.3, textTransform: 'uppercase' },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: T.border, marginVertical: 14, zIndex: 1 },
  photoArea: {
    flex: 1, flexDirection: 'row', flexWrap: 'nowrap', gap: 5,
    paddingHorizontal: 12, paddingTop: 12, alignItems: 'flex-start', overflow: 'hidden', zIndex: 1,
  },
  photo: { width: 30, height: 30, borderRadius: 7, backgroundColor: T.inputBg, flexShrink: 0 },
  photoPlaceholder: {
    width: 30, height: 30, borderRadius: 7, backgroundColor: T.accentTint,
    borderWidth: 1, borderColor: T.accent, flexShrink: 0, alignItems: 'center', justifyContent: 'center',
  },
  photoPlaceholderText: { fontSize: 13, fontWeight: '600', color: T.accent, textTransform: 'uppercase' },
  chevron: { alignSelf: 'center', paddingRight: 14, zIndex: 1 },
});
