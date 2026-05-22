import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

const ACCENT  = '#E76F51';
const MUTED   = '#8B7762';
const CARD    = '#FCF9F2';
const BORDER  = '#EDE8E0';
const PADDING = 3;

export interface PillOption {
  label: string;
  value: string;
}

interface Props {
  options: PillOption[];
  value: string;
  onChange: (value: string) => void;
  style?: ViewStyle;
}

export function SlidingPills({ options, value, onChange, style }: Props) {
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const slideX = useRef(new Animated.Value(PADDING)).current;
  const slideW = useRef(new Animated.Value(60)).current;
  const initialized = useRef(false);

  useEffect(() => {
    const allMeasured = options.every(o => layouts[o.value]);
    if (!allMeasured) return;

    const layout = layouts[value];
    if (!layout) return;

    if (!initialized.current) {
      slideX.setValue(layout.x);
      slideW.setValue(layout.width);
      initialized.current = true;
      return;
    }

    Animated.parallel([
      Animated.spring(slideX, { toValue: layout.x, useNativeDriver: false, tension: 120, friction: 14 }),
      Animated.spring(slideW, { toValue: layout.width, useNativeDriver: false, tension: 120, friction: 14 }),
    ]).start();
  }, [value, layouts]);

  return (
    <View style={[s.container, style]}>
      <Animated.View style={[s.indicator, { left: slideX, width: slideW }]} />
      {options.map(opt => (
        <Pressable
          key={opt.value}
          style={s.pill}
          onLayout={e => {
            const { x, width } = e.nativeEvent.layout;
            setLayouts(prev => ({ ...prev, [opt.value]: { x, width } }));
          }}
          onPress={() => onChange(opt.value)}
        >
          <Text style={[s.text, value === opt.value && s.textActive]}>
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: CARD,
    borderRadius: 22,
    padding: PADDING,
    borderWidth: 1,
    borderColor: BORDER,
    alignSelf: 'flex-start',
  },
  indicator: {
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    borderRadius: 19,
    backgroundColor: ACCENT,
  },
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 19,
    zIndex: 1,
  },
  text: { fontSize: 14, fontWeight: '600', color: MUTED },
  textActive: { color: '#fff' },
});
