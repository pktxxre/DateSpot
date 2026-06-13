import { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, Pressable, Modal,
  FlatList, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import AppTextInput from '@/components/AppTextInput';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/Avatar';
import { T } from '@/lib/theme';
import { searchProfiles, getFollowing, getFollowers, followUser, unfollowUser, FriendProfile } from '@/lib/friends';
import { supabase } from '@/lib/supabase';

const PRIMARY  = '#4B3621';
const MUTED    = '#8B7762';
const PLACEHOLDER_CLR = '#B0A090';
const ACCENT   = '#E76F51';
const BORDER   = '#EDE8E0';

export function AddFriendModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  // Who I follow (optimistic — flips on tap) and who follows me (static for the session).
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followerIds, setFollowerIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    supabase?.auth.getUser().then(({ data }) => setMyUserId(data.user?.id ?? null));
    Promise.all([getFollowing(), getFollowers()]).then(([following, followers]) => {
      setFollowingIds(new Set(following.map(f => f.userId)));
      setFollowerIds(new Set(followers.map(f => f.userId)));
    });
  }, [visible]);

  useEffect(() => {
    if (!visible) { setQuery(''); setResults([]); }
  }, [visible]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const found = await searchProfiles(query);
      setResults(myUserId ? found.filter(p => p.id !== myUserId) : found);
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [query, myUserId]);

  // Friends/Following → tapping unfollows; Follow/Follow back → tapping follows.
  const handleToggle = async (profile: FriendProfile) => {
    if (followingIds.has(profile.id)) {
      setFollowingIds(prev => { const n = new Set(prev); n.delete(profile.id); return n; });
      await unfollowUser(profile.id);
    } else {
      setFollowingIds(prev => new Set(prev).add(profile.id));
      await followUser(profile.id);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <SafeAreaView style={m.safe} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={m.handleWrap}><View style={m.handle} /></View>
          <View style={m.header}>
            <Text style={m.title}>Add Friend</Text>
            <Pressable style={m.closeBtn} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={PRIMARY} />
            </Pressable>
          </View>
          <View style={m.searchRow}>
            <Ionicons name="search-outline" size={16} color={MUTED} />
            <AppTextInput
              style={m.searchInput} placeholder="Search by name or @handle"
              placeholderTextColor={PLACEHOLDER_CLR} value={query} onChangeText={setQuery}
              autoFocus autoCapitalize="none" autoCorrect={false} returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={MUTED} />
              </Pressable>
            )}
          </View>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 48 }} color={ACCENT} />
          ) : results.length > 0 ? (
            <FlatList
              data={results} keyExtractor={item => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={m.listContent}
              renderItem={({ item }) => {
                const iFollow = followingIds.has(item.id);
                const theyFollow = followerIds.has(item.id);
                const connected = iFollow; // Friends or Following — tapping unfollows
                const label = iFollow
                  ? (theyFollow ? 'Friends' : 'Following')
                  : (theyFollow ? 'Follow back' : 'Follow');
                return (
                  <View style={m.resultRow}>
                    <Avatar id={item.id} name={item.username} photoUri={item.profilePhotoUri} size={40} />
                    <View style={m.resultInfo}>
                      <Text style={m.resultName} numberOfLines={1}>{item.username}</Text>
                      {item.handle ? <Text style={m.resultHandle}>@{item.handle}</Text> : null}
                    </View>
                    <Pressable style={[m.addBtn, connected && m.addBtnSent]} onPress={() => handleToggle(item)}>
                      <Text style={[m.addBtnText, connected && m.addBtnTextSent]}>{label}</Text>
                    </Pressable>
                  </View>
                );
              }}
            />
          ) : query.trim().length > 0 ? (
            <View style={m.emptyWrap}>
              <Ionicons name="person-outline" size={40} color={BORDER} />
              <Text style={m.emptyText}>No users found</Text>
            </View>
          ) : (
            <View style={m.emptyWrap}>
              <Text style={m.emptyHint}>Search by name or @handle to find friends</Text>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const m = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  handleWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: BORDER },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  title: { fontSize: 20, fontWeight: '400', color: PRIMARY, fontFamily: 'Fraunces-Regular' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: T.inputBg, alignItems: 'center', justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginBottom: 12,
    backgroundColor: T.inputBg, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: PRIMARY, padding: 0 },
  listContent: { paddingHorizontal: 20, paddingTop: 4 },
  resultRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER, gap: 12,
  },
  resultInfo: { flex: 1, gap: 2 },
  resultName: { fontSize: 15, fontWeight: '600', color: PRIMARY },
  resultHandle: { fontSize: 13, color: MUTED },
  addBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: ACCENT },
  addBtnSent: { backgroundColor: T.inputBg },
  addBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  addBtnTextSent: { color: MUTED },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', color: PRIMARY },
  emptyHint: { fontSize: 14, color: MUTED, textAlign: 'center' },
});
