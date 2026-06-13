import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { formatRating, ratingColor } from '@/lib/visits';
import { T } from '@/lib/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Signature score badge: a colored arc that fills rating/10 of the circle
 * (a 9.2 reads nearly closed, a 4.8 under half) over a faint full track,
 * with the score inside, color-coded by rating tier. The arc starts at
 * 12 o'clock and sweeps clockwise. Used on home, ranked lists, stack
 * detail, and the friends feed so scores read identically everywhere.
 */
export function ScoreRing({ rating, size = 40, bg, locked = false, selected = false }: {
  rating: number;
  size?: number;
  /** Background fill behind the ring — defaults to T.card; pass an opaque value over colored headers / maps. */
  bg?: string;
  /** Empty/locked state: track only, muted "–" centered (e.g. Friend Score before friends rate). */
  locked?: boolean;
  /** Map selection state: filled disc in the rating color with a white score, arc hidden. */
  selected?: boolean;
}) {
  const color = ratingColor(rating);
  // Scale stroke with size so big rings (SCORES cards) don't look anemic.
  const strokeWidth = Math.max(2, size * 0.06);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.min(Math.max(rating, 0), 10) / 10;

  const background = selected ? color : (bg ?? T.card);
  const textColor = selected ? '#fff' : locked ? T.muted : color;

  return (
    <View style={[s.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: background }]}>
      {!selected && (
        <Svg width={size} height={size}>
          {/* Track: faint full circle so the unfilled remainder still reads as a ring */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={T.border}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Score arc: fills rating/10 of the circumference, clockwise from the top */}
          {!locked && fraction > 0 && (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${circumference * fraction} ${circumference}`}
              fill="none"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )}
        </Svg>
      )}
      <Text style={[s.text, { color: textColor, fontSize: size * 0.32 }]}>
        {locked ? '–' : formatRating(rating)}
      </Text>
    </View>
  );
}

/**
 * Live variant of ScoreRing for the This-or-That flow: same coin, but the arc
 * tweens to a new provisional score and the number fade-swaps on every change,
 * with a small scale pop. `color` is supplied (and locked to the triage tier)
 * rather than derived from the rating, so the ring never crosses color
 * mid-decision. Kept separate from the static ScoreRing so list/map renders
 * stay allocation-free.
 */
export function AnimatedScoreRing({ rating, color, size = 40 }: { rating: number; color: string; size?: number }) {
  const strokeWidth = Math.max(2, size * 0.06);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.min(Math.max(rating, 0), 10) / 10;

  const progress = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.7)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(rating);
  const mounted = useRef(false);

  useEffect(() => {
    // Swap the displayed number at the trough of the fade (instant on mount).
    const swap = setTimeout(() => setShown(rating), mounted.current ? 90 : 0);
    Animated.parallel([
      Animated.timing(progress, {
        toValue: fraction,
        duration: mounted.current ? 280 : 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.08, friction: 5, tension: 200, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 180, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(textOpacity, { toValue: 0, duration: mounted.current ? 90 : 0, useNativeDriver: true }),
        Animated.timing(textOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
    ]).start();
    mounted.current = true;
    return () => clearTimeout(swap);
  }, [rating]);

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <Animated.View style={[s.wrap, { width: size, height: size, borderRadius: size / 2, transform: [{ scale }] }]}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={T.border} strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Animated.Text style={[s.text, { color, fontSize: size * 0.32, opacity: textOpacity }]}>
        {formatRating(shown)}
      </Animated.Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: T.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text: {
    position: 'absolute',
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
});
