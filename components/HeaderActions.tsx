import { useCallback, useState } from 'react';
import { StyleSheet, View, Text, Pressable, AppState } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AddFriendModal } from '@/components/AddFriendModal';
import { getUnreadCount } from '@/lib/notifications';

const PRIMARY = '#4B3621';
const BG      = '#FFFFFF';

// Shared header action cluster used on Home, Ranked, and Friends.
// Add-friends on the left, notifications on the far right (where the profile
// avatar used to sit). The notification badge reflects unread count and stays
// live while the screen is focused.
export function HeaderActions() {
  const [addOpen, setAddOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    const refresh = () => getUnreadCount().then(c => { if (active) setUnread(c); });
    refresh();
    const interval = setInterval(refresh, 15000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => { active = false; clearInterval(interval); sub.remove(); };
  }, []));

  return (
    <View style={s.row}>
      <Pressable style={s.iconBtn} hitSlop={8} onPress={() => setAddOpen(true)}>
        <Ionicons name="person-add-outline" size={20} color={PRIMARY} />
      </Pressable>
      <Pressable style={s.iconBtn} hitSlop={8} onPress={() => router.push('/inbox')}>
        <Ionicons name="notifications-outline" size={20} color={PRIMARY} />
        {unread > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </Pressable>
      <AddFriendModal visible={addOpen} onClose={() => setAddOpen(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EDE7DE', alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: 0, right: 0,
    minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#E53935',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: BG,
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },
});
