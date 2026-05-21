import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getProfile } from '@/lib/profile';
import { T } from '@/lib/theme';

interface Props {
  size?: number;
  onPress?: () => void;
}

export function ProfileAvatar({ size = 36, onPress }: Props) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [emoticon, setEmoticon] = useState(':)');

  useFocusEffect(useCallback(() => {
    getProfile().then(p => {
      setPhoto(p.profilePhotoUri ?? null);
      setEmoticon(p.avatarEmoticon || ':)');
    });
  }, []));

  const radius = size / 2;
  const ringStyle = {
    width: size + 4,
    height: size + 4,
    borderRadius: radius + 2,
    borderWidth: 2,
    borderColor: T.accent,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };
  const innerStyle = {
    width: size, height: size, borderRadius: radius,
    backgroundColor: '#E8C5B8',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  };

  const content = photo ? (
    <Image key={photo} source={{ uri: photo, cache: 'reload' }} style={{ width: size, height: size }} resizeMode="cover" />
  ) : (
    <Text style={[s.emoticon, { fontSize: size * 0.35 }]}>{emoticon}</Text>
  );

  if (onPress) {
    return (
      <Pressable style={({ pressed }) => [ringStyle, pressed && { opacity: 0.7 }]} onPress={onPress} hitSlop={8}>
        <View style={innerStyle}>{content}</View>
      </Pressable>
    );
  }

  return (
    <View style={ringStyle}>
      <View style={innerStyle}>{content}</View>
    </View>
  );
}

const s = StyleSheet.create({
  emoticon: { fontWeight: '600', color: '#A0523C', letterSpacing: 0 },
});
