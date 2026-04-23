/**
 * RatingPin — Beli-style teardrop map marker.
 *
 * Renders a colored bubble + downward triangle pointer.
 * Color thresholds match constants/colors.ts:
 *   1–3  → red     (#ef4444)
 *   4–6  → amber   (#f59e0b)
 *   7–10 → green   (#22c55e)
 *
 * Usage:
 *   <Marker coordinate={{ latitude, longitude }} tracksViewChanges={false}>
 *     <RatingPin rating={8.7} />
 *   </Marker>
 *
 * tracksViewChanges={false} is critical for performance with many markers —
 * it tells iOS not to re-render the marker view on every map frame.
 */

import { View, Text, StyleSheet } from 'react-native';
import { ratingColor } from '@/constants/colors';

interface Props {
  rating: number;
}

export function RatingPin({ rating }: Props) {
  const color = ratingColor(rating);
  // Show "8" for whole numbers, "8.7" for decimals
  const label = Number.isInteger(rating) ? String(rating) : rating.toFixed(1);

  return (
    <View style={styles.container}>
      <View style={[styles.bubble, { backgroundColor: color }]}>
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={[styles.tip, { borderTopColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    // No background / shadow — keep it clean like Beli
  },
  bubble: {
    minWidth: 38,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  tip: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    // borderTopColor is set dynamically above
  },
});
