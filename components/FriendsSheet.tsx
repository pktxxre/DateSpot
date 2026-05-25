import { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Image, Modal, Pressable, ScrollView,
  StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFriends, AcceptedFriend } from '@/lib/friends';

const PRIMARY     = '#4B3621';
const MUTED       = '#8B7762';
const ACCENT      = '#E76F51';
const BORDER      = '#EDE8E0';
const CARD        = '#FCF9F2';
const PLACEHOLDER = '#B0A090';

const PALETTE = ['#F2C18B', '#B5D5C5', '#E8B4D8', '#C9B6E4', '#F4C2A1'];

function avatarBg(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function Avatar({ person }: { person: AcceptedFriend }) {
  if (person.profilePhotoUri) {
    return <Image source={{ uri: person.profilePhotoUri }} style={s.avatar} resizeMode="cover" />;
  }
  return (
    <View style={[s.avatar, { backgroundColor: avatarBg(person.id), alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={s.avatarText}>{person.avatarEmoticon || (person.username?.[0] ?? '?').toUpperCase()}</Text>
    </View>
  );
}

interface Props {
  visible: boolean;
  username: string;
  onClose: () => void;
}

export function FriendsSheet({ visible, username, onClose }: Props) {
  const { height: screenH } = useWindowDimensions();
  const sheetH = screenH;

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const translateY      = useRef(new Animated.Value(screenH * 0.5)).current;

  const [friends, setFriends] = useState<AcceptedFriend[]>([]);
  const [query, setQuery]   = useState('');
  const [mounted, setMounted] = useState(false);

  // Animate in/out
  useEffect(() => {
    if (visible) {
      setMounted(true);
      getFriends().then(setFriends);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1, duration: 260, easing: Easing.out(Easing.ease), useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0, duration: 200, useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: sheetH, duration: 220, easing: Easing.in(Easing.ease), useNativeDriver: true,
        }),
      ]).start(() => {
        setMounted(false);
        setQuery('');
      });
    }
  }, [visible]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? friends.filter(f => f.username.toLowerCase().includes(q) || f.handle?.toLowerCase().includes(q))
    : friends;

  if (!mounted && !visible) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[s.sheet, { height: sheetH, transform: [{ translateY }] }]}>
        {/* Handle */}
        <View style={s.handleWrap}>
          <View style={s.handle} />
        </View>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle} numberOfLines={1}>{username}</Text>
          <Pressable style={s.closeBtn} onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={18} color={PRIMARY} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={s.searchWrap}>
          <Ionicons name="search-outline" size={15} color={MUTED} style={{ marginRight: 8 }} />
          <TextInput
            style={s.searchInput}
            placeholder="Search friends"
            placeholderTextColor={PLACEHOLDER}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={14} color={MUTED} />
            </Pressable>
          )}
        </View>

        {/* List */}
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {filtered.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="person-outline" size={36} color={BORDER} />
              <Text style={s.emptyText}>
                {q ? `No results for "${query}"` : 'No friends yet'}
              </Text>
            </View>
          ) : (
            <View style={s.listWrap}>
              {filtered.map((person, i) => (
                <View key={person.id} style={[s.row, i < filtered.length - 1 && s.rowBorder]}>
                  <Avatar person={person} />
                  <View style={s.rowInfo}>
                    <Text style={s.rowName} numberOfLines={1}>{person.username}</Text>
                    {!!person.handle && (
                      <Text style={s.rowHandle} numberOfLines={1}>@{person.handle}</Text>
                    )}
                  </View>
                  <View style={s.statusPill}>
                    <Text style={s.statusPillText}>Friends</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const AVATAR_SIZE = 44;

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    overflow: 'hidden',
  },

  handleWrap: { alignItems: 'center', paddingTop: 20, paddingBottom: 4 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: BORDER },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 17, fontWeight: '400', color: PRIMARY,
    fontFamily: 'Fraunces-Variable',
  },
  closeBtn: {
    position: 'absolute', right: 20,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: CARD, alignItems: 'center', justifyContent: 'center',
  },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: CARD, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: BORDER,
  },
  searchInput: { flex: 1, fontSize: 14, color: PRIMARY, padding: 0 },

  listWrap: { paddingHorizontal: 16, paddingBottom: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, gap: 12,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  avatarText: { fontSize: AVATAR_SIZE * 0.42 },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 15, fontWeight: '600', color: PRIMARY },
  rowHandle: { fontSize: 13, color: MUTED, marginTop: 1 },

  statusPill: {
    borderWidth: 1.5, borderColor: ACCENT, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  statusPillText: { fontSize: 12, fontWeight: '600', color: ACCENT },

  emptyWrap: { alignItems: 'center', paddingTop: 48, gap: 10 },
  emptyText: { fontSize: 14, color: MUTED },
});
