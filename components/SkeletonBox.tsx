import { useEffect } from 'react';
import { View, useWindowDimensions, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing,
} from 'react-native-reanimated';

export const SK_BASE = '#EAE4D9';
export const SK_LIGHT = '#F8F4EC';

export type ShimmerStyle = ReturnType<typeof useAnimatedStyle>;

export function useShimmer(): { shimmer: ShimmerStyle; screenW: number } {
  const { width: screenW } = useWindowDimensions();
  const offset = useSharedValue(-screenW * 0.65);

  useEffect(() => {
    offset.value = withRepeat(
      withTiming(screenW, { duration: 1800, easing: Easing.linear }),
      -1,
      false,
    );
  }, [screenW]);

  const shimmer = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  return { shimmer, screenW };
}

export function SkBox({
  shimmer,
  w,
  h,
  r = 4,
  style,
  screenW,
}: {
  shimmer: ShimmerStyle;
  w: number | `${number}%`;
  h: number;
  r?: number;
  style?: ViewStyle;
  screenW: number;
}) {
  return (
    <View style={[{ width: w, height: h, backgroundColor: SK_BASE, overflow: 'hidden', borderRadius: r }, style]}>
      <Animated.View
        style={[
          { position: 'absolute', top: 0, left: 0, bottom: 0, width: screenW * 0.6, backgroundColor: SK_LIGHT, opacity: 0.95 },
          shimmer as any,
        ]}
      />
    </View>
  );
}
