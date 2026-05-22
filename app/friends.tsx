import { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TextInput, Pressable, ScrollView, Image,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getFriends, AcceptedFriend } from '@/lib/friends';

const BG          = '#FFFFFF';
const CARD        = '#FCF9F2';
const BORDER      = '#EDE8E0';
const PRIMARY     = '#4B3621';
const MUTED       = '#8B7762';
const ACCENT      = '#E76F51';
const PLACEHOLDER = '#B0A090';

const AVATAR_PALETTE = ['#F2C18B', '#B5D5C5', '#E8B4D8', '#C9B6E4', '#F4C2A1'];

function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function Avatar({ person }: { person: AcceptedFriend }) {
  const size = 44;
  if (person.profilePhotoUri) {
    return (
      <Image
        source={{ uri: person.profilePhotoUri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: avatarColor(person.id),
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.42 }}>
        {person.avatarEmoticon || (person.username?.[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );
}

export default function FriendsListScreen() {
  const [friends, setFriends] = useState<AcceptedFriend[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    getFriends().then(setFriends);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q ? friends.filter(f =>
    f.username.toLowerCase().includes(q) || f.handle?.toLowerCase().includes(q)
  ) : friends;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={PRIMARY} />
        </Pressable>
        <Text style={s.headerTitle}>Friends</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Search bar */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={MUTED} style={{ marginRight: 8 }} />
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
            <Ionicons name="close-circle" size={15} color={MUTED} />
          </Pressable>
        )}
      </View>

      {/* List */}
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {filtered.length === 0 ? (
          <View style={s.emptyWrap}>
            <Ionicons name="person-outline" size={40} color={BORDER} />
            <Text style={s.emptyText}>
              {q ? `No results for "${query}"` : 'No friends yet'}
            </Text>
          </View>
        ) : (
          <View style={s.listWrap}>
            {filtered.map((person, i) => (
              <View
                key={person.id}
                style={[s.row, i < filtered.length - 1 && s.rowBorder]}
              >
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
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 6, paddingBottom: 14,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 17, fontWeight: '600', color: PRIMARY,
    fontFamily: 'InstrumentSerif-Regular',
  },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: CARD, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 11,
    borderWidth: 1, borderColor: BORDER,
  },
  searchInput: { flex: 1, fontSize: 14, color: PRIMARY, padding: 0 },

  listWrap: { paddingHorizontal: 16, paddingBottom: 40 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, gap: 12,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 15, fontWeight: '600', color: PRIMARY },
  rowHandle: { fontSize: 13, color: MUTED, marginTop: 1 },

  statusPill: {
    borderWidth: 1.5, borderColor: ACCENT, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: 'transparent',
  },
  statusPillText: { fontSize: 12, fontWeight: '600', color: ACCENT },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 14, color: MUTED, textAlign: 'center' },
});
