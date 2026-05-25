// app/walkthrough.tsx
// 3-page feature walkthrough shown once right after a new user completes onboarding.
// Pages: 1) Log a spot  2) Stack your night  3) Compare (this or that)
// Ported from walkthrough-app.jsx design source.

import { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '@/lib/theme';

// Walkthrough uses the design's warm-cream palette, not the app's default white.
const WT = {
  bg: '#FCF9F2', card: '#FFFFFF', inputBg: '#F2ECE4',
  primary: '#4B3621', muted: '#8B7762', placeholder: '#B0A090',
  accent: '#E76F51', border: '#EDE8E0',
} as const;

const RC = { great: '#34c759', okay: '#ff9500', bad: '#ff3b30' } as const;

const TIER: Record<string, { c: string; wash: string }> = {
  S: { c: '#34C759', wash: '#E8F7EA' },
  A: { c: '#86C457', wash: '#EFF6E4' },
  B: { c: '#E6B843', wash: '#FAF1DA' },
  C: { c: '#E97C3A', wash: '#FBE9DC' },
  F: { c: '#E55B5B', wash: '#FBE2E2' },
};

const ACT: Record<string, string> = {
  food: '#C4604A', bars: '#8B7BB0', cafes: '#A07850',
  outdoors: '#6A8F6A', indoors: '#7A8CAA', shopping: '#C47890',
};

const LOOP_MS = 5200;
const TOTAL = 3;

const PAGES = [
  { eyebrow: '01 · The Log',
    title: 'Log every spot in five quick steps.',
    body: 'Find the place, tell us about it, give it a first impression. Each spot lands on your map — colored by how good it was.' },
  { eyebrow: '02 · The Stack',
    title: 'Stack the spots from one night.',
    body: "A great night isn't one place — it's a journey. Tap a few spots, then slot the whole night onto your tier board: S to F." },
  { eyebrow: '03 · The Compare',
    title: 'This one, or that one?',
    body: "No stars. No 1-to-10 guessing. Just pick which place you liked better and we'll rank every spot you've been." },
] as const;

// ── Root screen ───────────────────────────────────────────────────
export default function WalkthroughScreen() {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;

  const go = (next: number) => {
    if (next < 0 || next >= TOTAL) return;
    const d = next > page ? 1 : -1;
    Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(slide, { toValue: -d * 28, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setPage(next);
      slide.setValue(d * 28);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, damping: 24, stiffness: 260, useNativeDriver: true }),
      ]).start();
    });
  };

  const finish = () => router.replace('/(tabs)');
  const p = PAGES[page];

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Soft accent wash at top */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: WT.accent + '0D' }]} pointerEvents="none" />

      {/* Top bar */}
      <View style={s.topBar}>
        <Pressable onPress={() => go(page - 1)} disabled={page === 0} hitSlop={12} style={s.backBtn}>
          {page > 0 && <Ionicons name="chevron-back" size={20} color={WT.muted} />}
        </Pressable>
        <Pressable onPress={finish} hitSlop={12}>
          <Text style={s.skipText}>Skip</Text>
        </Pressable>
      </View>

      {/* Animated page content */}
      <Animated.View style={[s.pageContent, { opacity: fade, transform: [{ translateX: slide }] }]}>
        {page === 0 && <LogShowcase active />}
        {page === 1 && <StackShowcase active />}
        {page === 2 && <CompareShowcase active />}

        <View style={s.caption}>
          <Text style={[s.eyebrow, { color: WT.accent }]}>{p.eyebrow.toUpperCase()}</Text>
          <Text style={s.pageTitle}>{p.title}</Text>
          <Text style={s.pageBody}>{p.body}</Text>
        </View>
      </Animated.View>

      {/* Footer */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom + 8, 32) }]}>
        <View style={s.dots}>
          {Array.from({ length: TOTAL }).map((_, i) => (
            <View key={i} style={[s.dot, {
              width: i === page ? 24 : 8,
              backgroundColor: i === page ? WT.accent : WT.border,
            }]} />
          ))}
        </View>
        <Pressable
          onPress={page < TOTAL - 1 ? () => go(page + 1) : finish}
          style={({ pressed }) => [s.cta, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}
        >
          <Text style={s.ctaText}>{page === TOTAL - 1 ? 'Enter DateSpot' : 'Next'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Shared showcase card shell ────────────────────────────────────
function Card({ children, bg }: { children: React.ReactNode; bg?: string }) {
  return (
    <View style={[s.card, bg ? { backgroundColor: bg } : null]}>
      {children}
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════
// MAP BACKGROUND — SVG replaced with styled Views
// ════════════════════════════════════════════════════════════════════
function MapBg() {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#EFE7D6' }]}>
      {/* Green park blobs */}
      <View style={{ position: 'absolute', left: 10, top: 10, width: 80, height: 42, borderRadius: 20, backgroundColor: '#CCD9B8', opacity: 0.75 }} />
      <View style={{ position: 'absolute', right: 18, top: 6, width: 60, height: 32, borderRadius: 16, backgroundColor: '#CCD9B8', opacity: 0.7 }} />
      {/* Main streets (horizontal) */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: '28%', height: 3, backgroundColor: '#FCF9F2', opacity: 0.85 }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: '52%', height: 3, backgroundColor: '#FCF9F2', opacity: 0.85 }} />
      {/* Main streets (vertical) */}
      <View style={{ position: 'absolute', left: '25%', top: 0, bottom: 0, width: 3, backgroundColor: '#FCF9F2', opacity: 0.85 }} />
      <View style={{ position: 'absolute', left: '53%', top: 0, bottom: 0, width: 3, backgroundColor: '#FCF9F2', opacity: 0.85 }} />
      <View style={{ position: 'absolute', left: '78%', top: 0, bottom: 0, width: 3, backgroundColor: '#FCF9F2', opacity: 0.85 }} />
      {/* Minor streets */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: '40%', height: 1.5, backgroundColor: '#FCF9F2', opacity: 0.5 }} />
      <View style={{ position: 'absolute', left: '38%', top: 0, bottom: 0, width: 1.5, backgroundColor: '#FCF9F2', opacity: 0.5 }} />
      <View style={{ position: 'absolute', left: '64%', top: 0, bottom: 0, width: 1.5, backgroundColor: '#FCF9F2', opacity: 0.5 }} />
      {/* Building blocks */}
      <View style={{ position: 'absolute', left: 68, top: 15, width: 32, height: 22, borderRadius: 3, backgroundColor: '#F4ECD9', opacity: 0.55 }} />
      <View style={{ position: 'absolute', left: 126, top: 15, width: 40, height: 22, borderRadius: 3, backgroundColor: '#F4ECD9', opacity: 0.55 }} />
      <View style={{ position: 'absolute', left: 186, top: 42, width: 38, height: 22, borderRadius: 3, backgroundColor: '#F4ECD9', opacity: 0.55 }} />
      <View style={{ position: 'absolute', left: 244, top: 72, width: 30, height: 22, borderRadius: 3, backgroundColor: '#F4ECD9', opacity: 0.55 }} />
    </View>
  );
}

// Map pin — teardrop approximated with circle + bottom nub
function MapPin({ x, y, color, large }: { x: number; y: number; color: string; large?: boolean }) {
  const s = large ? 22 : 16;
  const nub = large ? 7 : 5;
  return (
    <View style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: [{ translateX: -s / 2 }, { translateY: -s - nub }], alignItems: 'center' }}>
      <View style={{
        width: s, height: s, borderRadius: s / 2,
        backgroundColor: color, borderWidth: 2, borderColor: '#fff',
        shadowColor: '#4B3621', shadowOffset: { width: 0, height: 2 }, shadowRadius: 3, shadowOpacity: 0.3, elevation: 3,
      }}>
        {/* Inner white dot */}
        <View style={{ width: s * 0.38, height: s * 0.38, borderRadius: s * 0.19, backgroundColor: '#fff', position: 'absolute', top: s * 0.27, left: s * 0.27 }} />
      </View>
      {/* Nub */}
      <View style={{ width: nub, height: nub, backgroundColor: color, transform: [{ rotate: '45deg' }], marginTop: -nub * 0.6, shadowColor: '#4B3621', shadowOffset: { width: 0, height: 1 }, shadowRadius: 1, shadowOpacity: 0.2, elevation: 2 }} />
    </View>
  );
}

// Pulsing ring for the active pin
function PulseRing({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(0.3)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.timing(scale, { toValue: 2.4, duration: 1800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', width: 18, height: 18, borderRadius: 9,
      backgroundColor: color + '55',
      transform: [{ scale }], opacity,
    }} />
  );
}

// ════════════════════════════════════════════════════════════════════
// SHOWCASE 1 — Log a date
// ════════════════════════════════════════════════════════════════════
const LOG_STEPS = ['what', 'tell', 'impression'] as const;
type LogStep = typeof LOG_STEPS[number];

function LogShowcase({ active }: { active: boolean }) {
  const [stepIdx, setStepIdx] = useState(0);
  const stepFade = useRef(new Animated.Value(1)).current;
  const stepSlide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) { setStepIdx(0); return; }
    const per = Math.max(2400, LOOP_MS / LOG_STEPS.length);
    const id = setInterval(() => {
      Animated.parallel([
        Animated.timing(stepFade, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(stepSlide, { toValue: -6, duration: 120, useNativeDriver: true }),
      ]).start(() => {
        setStepIdx(x => (x + 1) % LOG_STEPS.length);
        stepSlide.setValue(6);
        Animated.parallel([
          Animated.timing(stepFade, { toValue: 1, duration: 220, useNativeDriver: true }),
          Animated.spring(stepSlide, { toValue: 0, damping: 20, stiffness: 280, useNativeDriver: true }),
        ]).start();
      });
    }, per);
    return () => clearInterval(id);
  }, [active]);

  const step = LOG_STEPS[stepIdx];

  return (
    <Card>
      {/* Map background (top 23%) */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: '77%' }}>
        <MapBg />
        <MapPin x={18} y={22} color={RC.great} />
        <MapPin x={78} y={18} color={RC.okay} />
        <MapPin x={40} y={42} color={RC.great} />
        <MapPin x={88} y={36} color={RC.bad} />
        {/* Active pin (accent) with pulse ring */}
        <View style={{ position: 'absolute', left: '54%', top: '32%', alignItems: 'center', justifyContent: 'center' }}>
          <PulseRing color={WT.accent} />
          <MapPin x={0} y={0} color={WT.accent} large />
        </View>
      </View>

      {/* FAB at map/sheet boundary */}
      <View style={ls.fab}>
        <Ionicons name="add" size={18} color="#fff" />
      </View>

      {/* Bottom sheet */}
      <View style={ls.sheet}>
        <View style={ls.dragHandle} />

        {/* 5-step progress pills */}
        <View style={ls.progressRow}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} style={[ls.pill, {
              width: i === stepIdx ? 22 : 6,
              backgroundColor: i === stepIdx ? WT.accent : (i < stepIdx ? WT.accent + '55' : WT.border),
            }]} />
          ))}
        </View>

        {/* Cycling step content */}
        <Animated.View style={{ flex: 1, opacity: stepFade, transform: [{ translateY: stepSlide }] }}>
          {step === 'what' && <LogStepWhat />}
          {step === 'tell' && <LogStepTell />}
          {step === 'impression' && <LogStepImpression />}
        </Animated.View>
      </View>
    </Card>
  );
}

function LogStepWhat() {
  return (
    <View style={{ paddingTop: 2 }}>
      <Text style={[ls.stepTitle, { fontFamily: Fonts.serif }]}>What are you logging?</Text>
      <Text style={ls.stepSub}>Choose one to get started</Text>
      <View style={{ marginTop: 10, gap: 7 }}>
        <ChoiceRow
          icon={
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: WT.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark" size={15} color="#fff" />
            </View>
          }
          title="Been To" sub="Log a place you've visited"
        />
        <ChoiceRow
          icon={
            <View style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="bookmark" size={20} color="#5C4EB2" />
            </View>
          }
          title="Want to Go" sub="Save a place for later"
        />
      </View>
    </View>
  );
}

function ChoiceRow({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <View style={ls.choiceRow}>
      <View style={{ width: 30, height: 30, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', fontSize: 14.5, color: WT.primary, letterSpacing: -0.2 }}>{title}</Text>
        <Text style={{ fontSize: 11.5, color: WT.muted, marginTop: 2 }}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={WT.muted} />
    </View>
  );
}

function LogStepTell() {
  const cats = ['Food', 'Bars', 'Cafes', 'Outdoors', 'Indoors', 'Scenic', 'Other'];
  return (
    <View style={{ gap: 2 }}>
      <Text style={[ls.stepTitle, { fontFamily: Fonts.serif }]}>Tell me about it</Text>
      <Text style={ls.stepSub}>Step 2 of 5</Text>
      <FormLabel>Category</FormLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
        {cats.map((c, i) => <CatChip key={c} label={c} selected={i === 0} />)}
      </View>
      <FormLabel>What kind of date?</FormLabel>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8 }}>
        {([['Romantic', true], ['Friend', false], ['Solo', false]] as [string, boolean][]).map(([l, sel]) => (
          <BigPill key={l} label={l} selected={sel} />
        ))}
      </View>
      <FormLabel>Price range</FormLabel>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {([['Free', false], ['$', false], ['$$', true], ['$$$', false]] as [string, boolean][]).map(([l, sel]) => (
          <BigPill key={l} label={l} selected={sel} />
        ))}
      </View>
    </View>
  );
}

function LogStepImpression() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 20 }}>
      <Text style={[ls.stepTitle, { fontFamily: Fonts.serif }]}>First impression?</Text>
      <Text style={ls.stepSub}>Narrows your comparisons</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 18, paddingHorizontal: 2 }}>
        <ImpressionBox label="Bad" color={RC.bad} />
        <ImpressionBox label="Okay" color={RC.okay} />
        <ImpressionBox label="Great" color={RC.great} selected />
      </View>
    </View>
  );
}

function FormLabel({ children }: { children: string }) {
  return <Text style={{ fontSize: 9.5, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase', color: WT.muted, marginBottom: 4, marginTop: 1 }}>{children}</Text>;
}

function CatChip({ label, selected }: { label: string; selected?: boolean }) {
  return (
    <View style={{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999, borderWidth: 1.3, borderColor: selected ? WT.accent : WT.border, backgroundColor: selected ? WT.accent + '14' : WT.card }}>
      <Text style={{ fontSize: 11.5, fontWeight: '600', color: selected ? WT.accent : WT.primary }}>{label}</Text>
    </View>
  );
}

function BigPill({ label, selected }: { label: string; selected?: boolean }) {
  return (
    <View style={{ flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: selected ? WT.accent : WT.border, backgroundColor: selected ? WT.accent + '14' : WT.inputBg, alignItems: 'center' }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: selected ? WT.accent : WT.primary }}>{label}</Text>
    </View>
  );
}

function ImpressionBox({ label, color, selected }: { label: string; color: string; selected?: boolean }) {
  return (
    <View style={{
      flex: 1, paddingVertical: 22, borderRadius: 14,
      borderWidth: 2, borderColor: color,
      backgroundColor: selected ? color + '22' : color + '10',
      alignItems: 'center',
      shadowColor: color, shadowOffset: { width: 0, height: 8 }, shadowRadius: 14, shadowOpacity: selected ? 0.38 : 0, elevation: selected ? 4 : 0,
      transform: [{ scale: selected ? 1.04 : 1 }],
    }}>
      <Text style={{ fontFamily: Fonts.serif, fontWeight: '400', fontSize: 17, color, letterSpacing: -0.3 }}>{label}</Text>
    </View>
  );
}

const ls = StyleSheet.create({
  sheet: {
    position: 'absolute', left: 0, right: 0, top: '23%', bottom: 0,
    backgroundColor: WT.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#4B3621', shadowOffset: { width: 0, height: -8 }, shadowRadius: 20, shadowOpacity: 0.14, elevation: 8,
    paddingHorizontal: 18, paddingTop: 10, overflow: 'hidden',
  },
  dragHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: WT.border, alignSelf: 'center', marginBottom: 8 },
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginBottom: 8 },
  pill: { height: 6, borderRadius: 3 },
  fab: {
    position: 'absolute', left: '50%', top: '21%',
    transform: [{ translateX: -19 }, { translateY: -19 }],
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: WT.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: WT.card,
    shadowColor: WT.accent, shadowOffset: { width: 0, height: 6 }, shadowRadius: 14, shadowOpacity: 0.65, elevation: 8, zIndex: 10,
  },
  stepTitle: { fontSize: 19, color: WT.primary, textAlign: 'center', letterSpacing: -0.3 },
  stepSub: { fontSize: 11.5, color: WT.muted, textAlign: 'center', marginTop: 3, marginBottom: 6 },
  choiceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 11, borderRadius: 14, borderWidth: 1.2, borderColor: WT.border, backgroundColor: WT.card,
  },
});

// ════════════════════════════════════════════════════════════════════
// SHOWCASE 2 — Stack your night
// ════════════════════════════════════════════════════════════════════
const STACK_STAGES = ['select', 'place', 'result'] as const;
type StackStage = typeof STACK_STAGES[number];

const SAMPLE_SPOTS = [
  { name: "Sam's Tavern",     cat: 'bars',    price: '$$', rating: 10  },
  { name: 'Saint Bread',      cat: 'cafes',   price: '$',  rating: 9.5 },
  { name: 'Smith Tower',      cat: 'indoors', price: '$',  rating: 9.0 },
  { name: 'Damn the Weather', cat: 'bars',    price: '$$', rating: 7.6 },
];

function StackShowcase({ active }: { active: boolean }) {
  const [stageIdx, setStageIdx] = useState(0);
  const stageFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) { setStageIdx(0); return; }
    const per = Math.max(2400, LOOP_MS / STACK_STAGES.length);
    const id = setInterval(() => {
      Animated.timing(stageFade, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
        setStageIdx(x => (x + 1) % STACK_STAGES.length);
        Animated.timing(stageFade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
      });
    }, per);
    return () => clearInterval(id);
  }, [active]);

  const stage = STACK_STAGES[stageIdx];

  return (
    <Card bg={WT.bg}>
      <Animated.View style={{ flex: 1, opacity: stageFade }}>
        {stage === 'select' && <StackStageSelect />}
        {stage === 'place'  && <StackStagePlace />}
        {stage === 'result' && <StackStageResult />}
      </Animated.View>
    </Card>
  );
}

function StackStageSelect() {
  const sel = new Set([1, 2]);
  return (
    <>
      <View style={{ backgroundColor: WT.accent + '14', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 13, color: WT.accent, fontWeight: '700' }}>2 selected</Text>
        <Text style={{ fontSize: 12, color: WT.muted, fontWeight: '600' }}>Cancel</Text>
      </View>
      <View style={{ paddingHorizontal: 14 }}>
        {SAMPLE_SPOTS.map((spot, i) => <SpotListRow key={spot.name} spot={spot} selected={sel.has(i)} />)}
      </View>
      {/* Floating CTA */}
      <View style={{
        position: 'absolute', left: 14, right: 14, bottom: 12,
        height: 48, borderRadius: 14, backgroundColor: WT.accent,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        shadowColor: WT.accent, shadowOffset: { width: 0, height: 10 }, shadowRadius: 20, shadowOpacity: 0.5, elevation: 6,
      }}>
        <Ionicons name="layers-outline" size={18} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Stack these (2)</Text>
      </View>
    </>
  );
}

function SpotListRow({ spot, selected }: { spot: typeof SAMPLE_SPOTS[0]; selected: boolean }) {
  const c = spot.rating >= 7 ? RC.great : spot.rating >= 4 ? RC.okay : RC.bad;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: WT.border }}>
      <View style={{ width: 3, height: 36, borderRadius: 2, backgroundColor: c }} />
      <View style={{
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: selected ? WT.accent : 'transparent',
        borderWidth: selected ? 0 : 1.5, borderColor: WT.border,
        alignItems: 'center', justifyContent: 'center',
      }}>
        {selected && <Ionicons name="checkmark" size={13} color="#fff" />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: Fonts.serif, fontSize: 14, color: WT.primary, fontWeight: '400', lineHeight: 16 }} numberOfLines={1}>{spot.name}</Text>
        <Text style={{ fontSize: 10.5, color: WT.muted, marginTop: 2, letterSpacing: 0.2 }}>
          {spot.cat[0].toUpperCase() + spot.cat.slice(1)} · {spot.price} · Today
        </Text>
      </View>
      <View style={{ borderWidth: 1.4, borderColor: c, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: c }}>{spot.rating}</Text>
      </View>
    </View>
  );
}

function StackStagePlace() {
  return (
    <View style={{ flex: 1, padding: 18, justifyContent: 'center' }}>
      <Text style={[ss.stageTitle, { fontFamily: Fonts.serif }]}>Place "Our Spot"</Text>
      <Text style={ss.stageSub}>Tap a tier to place this date night</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 22 }}>
        {(['S', 'A', 'B', 'C', 'F'] as const).map(letter => (
          <TierSquare key={letter} letter={letter} highlight={letter === 'S'} />
        ))}
      </View>
      <View style={{ marginTop: 20, backgroundColor: WT.inputBg, borderRadius: 14, padding: 14 }}>
        <Text style={{ fontSize: 13, color: WT.placeholder }}>Why this tier?</Text>
      </View>
    </View>
  );
}

function TierSquare({ letter, highlight }: { letter: string; highlight?: boolean }) {
  const tier = TIER[letter];
  return (
    <View style={{
      flex: 1, padding: 8, borderRadius: 14,
      borderWidth: 1.5, borderColor: highlight ? tier.c : WT.border, backgroundColor: WT.card,
      shadowColor: tier.c, shadowOffset: { width: 0, height: 8 }, shadowRadius: 16, shadowOpacity: highlight ? 0.45 : 0, elevation: highlight ? 4 : 0,
      transform: [{ scale: highlight ? 1.06 : 1 }],
    }}>
      <View style={{ aspectRatio: 1, backgroundColor: tier.c, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontFamily: Fonts.serif, fontSize: 24, fontWeight: '400', letterSpacing: -0.5 }}>{letter}</Text>
      </View>
    </View>
  );
}

function StackStageResult() {
  return (
    <View style={{ padding: 14, gap: 7 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, marginBottom: 2 }}>
        <Text style={{ fontSize: 12.5, color: WT.primary, fontWeight: '600' }}>1 stack</Text>
        <View style={{ borderWidth: 1.5, borderColor: WT.accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
          <Text style={{ fontSize: 11.5, color: WT.accent, fontWeight: '700' }}>+ New Stack</Text>
        </View>
      </View>
      {(['S', 'A', 'B', 'C', 'F'] as const).map(letter => (
        <TierResultRow key={letter} letter={letter} stacks={letter === 'S' ? 1 : 0} />
      ))}
    </View>
  );
}

function TierResultRow({ letter, stacks }: { letter: string; stacks: number }) {
  const tier = TIER[letter];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: tier.wash, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, minHeight: 40 }}>
      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: tier.c, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontFamily: Fonts.serif, fontSize: 18, fontWeight: '400' }}>{letter}</Text>
      </View>
      <Text style={{ fontSize: 8.5, fontWeight: '700', letterSpacing: 0.9, color: WT.muted, textTransform: 'uppercase' }}>
        {stacks} STACK{stacks !== 1 ? 'S' : ''}
      </Text>
      {stacks > 0 && (
        <View style={{ width: 26, height: 26, borderRadius: 7, borderWidth: 1.5, borderColor: WT.accent, alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}>
          <Text style={{ fontFamily: Fonts.serif, fontWeight: '400', fontSize: 12, color: WT.accent }}>O</Text>
        </View>
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  stageTitle: { fontSize: 21, color: WT.primary, textAlign: 'center', letterSpacing: -0.3 },
  stageSub: { fontSize: 12.5, color: WT.muted, textAlign: 'center', marginTop: 6 },
});

// ════════════════════════════════════════════════════════════════════
// SHOWCASE 3 — Compare (This or That)
// Matches the real app's CompareStep exactly: left card is always the
// "new" spot (accent border, ? badge), right is the opponent (muted
// border, rating badge). Step is hardcoded to 4 of 5.
// ════════════════════════════════════════════════════════════════════

// Exact activity colors from the real CompareStep in map.tsx
const COMPARE_COLORS: Record<string, string> = {
  food: '#B5614A', bars: '#6B6B9E', cafes: '#8B6B45',
  outdoors: '#5A8066', indoors: '#6B7B8D', view: '#6080A0',
  entertainment: '#4B8080', shopping: '#9E6B80', other: '#8B7762',
};

// Left = new spot being logged (no rating yet, always accent border)
// Right = opponent spot (has a rating, muted border)
type SpotData = { name: string; cat: string; rating: number | null };
const PAIRS: { left: SpotData; right: SpotData }[] = [
  { left:  { name: 'Damn the Weather', cat: 'bars',    rating: null },
    right: { name: 'Smith Tower',       cat: 'indoors', rating: 9.0  } },
  { left:  { name: 'Saint Bread',      cat: 'cafes',   rating: null },
    right: { name: "Sam's Tavern",      cat: 'bars',    rating: 10.0 } },
  { left:  { name: 'Our Night Out',    cat: 'outdoors', rating: null },
    right: { name: 'Damn the Weather',  cat: 'bars',    rating: 7.6  } },
];

function CompareShowcase({ active }: { active: boolean }) {
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'picked'>('idle');
  const [borderVisible, setBorderVisible] = useState(false);
  const pickedScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) { setPhase('idle'); setStep(0); setBorderVisible(false); pickedScale.setValue(1); return; }
    let t1: ReturnType<typeof setTimeout>, t2: ReturnType<typeof setTimeout>;
    const cycle = (i = 0) => {
      setStep(i % PAIRS.length);
      setPhase('idle');
      setBorderVisible(false);
      pickedScale.setValue(1);
      t1 = setTimeout(() => {
        setPhase('picked');
        setBorderVisible(true);
        Animated.sequence([
          Animated.timing(pickedScale, { toValue: 1.06, duration: 80, useNativeDriver: true }),
          Animated.spring(pickedScale, { toValue: 1.03, friction: 5, tension: 200, useNativeDriver: true }),
        ]).start();
      }, Math.max(1500, LOOP_MS * 0.5));
      t2 = setTimeout(() => cycle(i + 1), LOOP_MS);
    };
    cycle(0);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [active]);

  const pair = PAIRS[step];

  return (
    <Card bg={WT.card}>
      {/* Title — matches real app exactly */}
      <View style={{ alignItems: 'center', paddingTop: 22, paddingBottom: 0 }}>
        <Text style={{ fontFamily: Fonts.serif, fontSize: 22, color: WT.primary, fontWeight: '400', letterSpacing: -0.4 }}>
          Which was better?
        </Text>
        <Text style={{ fontSize: 12, color: WT.muted, marginTop: 6 }}>Step 4 of 5</Text>
      </View>

      {/* Cards row — vs puck uses marginHorizontal: -10 to overlap both cards, matching real app */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12, marginBottom: 10 }}>
        {/* Left = new spot, border flashes accent only during tap animation */}
        <Animated.View style={{ flex: 1, height: 128, transform: [{ scale: phase === 'picked' ? pickedScale : 1 }] }}>
          <View style={[cs.cardNew, borderVisible && { borderColor: WT.accent }]}>
            <CompareCardInner spot={pair.left} isNew label="This one" picked={phase === 'picked'} />
          </View>
        </Animated.View>

        {/* VS puck overlapping both cards */}
        <View style={cs.vsPuck}>
          <Text style={cs.vsText}>vs</Text>
        </View>

        {/* Right = opponent, muted border */}
        <View style={{ flex: 1, height: 128 }}>
          <View style={cs.cardOld}>
            <CompareCardInner spot={pair.right} isNew={false} label="That one" picked={false} />
          </View>
        </View>
      </View>

      {/* Bottom action */}
      <View style={{ position: 'absolute', left: 14, right: 14, bottom: 14 }}>
        <View style={cs.tooHardBtn}>
          <Text style={cs.tooHardText}>Too hard to compare</Text>
        </View>
      </View>
    </Card>
  );
}

function CompareCardInner({ spot, isNew, label, picked }: {
  spot: SpotData; isNew: boolean; label: string; picked: boolean;
}) {
  const bandColor = COMPARE_COLORS[spot.cat] ?? COMPARE_COLORS.other;
  const rc = spot.rating == null ? null
    : spot.rating >= 7 ? RC.great : spot.rating >= 4 ? RC.okay : RC.bad;

  return (
    <>
      {/* Category band — exact match to real app header */}
      <View style={[cs.band, { backgroundColor: bandColor }]}>
        <Text style={cs.bandCat}>{spot.cat.toUpperCase()}</Text>
        {rc != null ? (
          // Opponent with known rating
          <View style={[cs.ratingPill, { borderColor: rc }]}>
            <Text style={[cs.ratingPillText, { color: rc }]}>{(spot.rating as number).toFixed(1)}</Text>
          </View>
        ) : (
          // New spot: "?" pill
          <View style={cs.questionPill}>
            <Text style={cs.questionText}>?</Text>
          </View>
        )}
      </View>
      {/* Body */}
      <View style={cs.cardBody}>
        <Text style={cs.cardName} numberOfLines={2}>{spot.name}</Text>
        <Text style={[cs.cardLabel, picked && isNew && { color: WT.accent }]}>{label}</Text>
      </View>
    </>
  );
}

const cs = StyleSheet.create({
  // Cards
  cardNew: { flex: 1, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: WT.border },
  cardOld: { flex: 1, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: WT.border },
  // VS puck — marginHorizontal: -10 overlaps both card edges, matching real app
  vsPuck: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: WT.bg, borderWidth: 2, borderColor: WT.accent,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10, marginHorizontal: -10,
  },
  vsText: { fontSize: 11, fontWeight: '700', color: WT.accent },
  // Category band
  band: { height: 47, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bandCat: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.9)', letterSpacing: 0.8 },
  // "?" pill for new/unrated spot
  questionPill: { backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  questionText: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.8)' },
  // Rating pill for opponent with known rating
  ratingPill: { backgroundColor: '#fff', borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  ratingPillText: { fontSize: 12, fontWeight: '800' },
  // Card body
  cardBody: { flex: 1, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, backgroundColor: WT.card, justifyContent: 'space-between' },
  cardName: { fontSize: 14, fontWeight: '700', color: WT.primary, lineHeight: 18 },
  cardLabel: { fontSize: 11, color: WT.muted, fontWeight: '500' },
  // Buttons
  tooHardBtn: { backgroundColor: WT.inputBg, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  tooHardText: { fontSize: 14, fontWeight: '600', color: WT.muted },
});

// ── Root styles ───────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: WT.bg },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 4, paddingBottom: 8,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  skipText: { fontSize: 13, fontWeight: '600', color: WT.muted, letterSpacing: 0.2, paddingHorizontal: 4 },

  pageContent: { flex: 1 },

  caption: { paddingHorizontal: 30, marginTop: 24 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 12 },
  pageTitle: {
    fontFamily: Fonts.serif, fontWeight: '400',
    fontSize: 30, lineHeight: 33, letterSpacing: -0.8, color: WT.primary,
  },
  pageBody: { marginTop: 14, fontSize: 15.5, lineHeight: 24, color: WT.muted },

  footer: { paddingHorizontal: 28, paddingTop: 16, gap: 18, alignItems: 'center', backgroundColor: WT.bg },
  dots: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { height: 8, borderRadius: 4 },
  cta: {
    width: '100%', height: 56, borderRadius: 16,
    backgroundColor: WT.accent, alignItems: 'center', justifyContent: 'center',
    shadowColor: WT.accent, shadowOffset: { width: 0, height: 10 }, shadowRadius: 24, shadowOpacity: 0.5, elevation: 8,
  },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '600', letterSpacing: -0.1 },

  card: {
    marginHorizontal: 24,
    height: 310,
    borderRadius: 28, overflow: 'hidden',
    backgroundColor: WT.card,
    shadowColor: 'rgba(75,54,33,0.45)',
    shadowOffset: { width: 0, height: 16 },
    shadowRadius: 40, shadowOpacity: 0.28, elevation: 10,
    borderWidth: 1, borderColor: WT.border,
  },
});
