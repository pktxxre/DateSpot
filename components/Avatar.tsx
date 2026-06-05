import { Image, Text, View } from 'react-native';

// Avatar palette — solid fill behind an emoticon/initial when no photo is set.
const AVATAR_BG = '#E8C5B8';

function initial(name: string): string {
  return (name?.[0] ?? '?').toUpperCase();
}

export function Avatar({ name, photoUri, emoticon, size }: {
  id?: string;
  name: string;
  photoUri: string | null;
  emoticon?: string;
  size: number;
}) {
  if (photoUri) {
    return <Image source={{ uri: photoUri }} style={{ width: size, height: size, borderRadius: size / 2 }} resizeMode="cover" />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: AVATAR_BG, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.42 }}>{emoticon || initial(name)}</Text>
    </View>
  );
}
