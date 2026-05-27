import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getProfile, UserProfile } from '@/lib/profile';
import { T } from '@/lib/theme';

export default function AccountDetailsScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    getProfile().then(setProfile);
  }, []);

  function DetailRow({ label, value }: { label: string; value: string }) {
    return (
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value || '—'}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <View style={styles.backBtnCircle}>
            <Ionicons name="chevron-back" size={20} color={T.primary} />
          </View>
        </Pressable>
        <Text style={styles.headerTitle}>Account Details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionHeader}>Profile</Text>
        <View style={styles.card}>
          <DetailRow label="Full Name" value={profile?.username ?? ''} />
          <View style={styles.divider} />
          <DetailRow label="Email" value={profile?.email ?? ''} />
          <View style={styles.divider} />
          <DetailRow label="City" value={profile?.city ?? ''} />
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14,
  },
  backBtnCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: T.inputBg,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 18, fontWeight: '400', color: T.primary,
    fontFamily: 'Fraunces-Regular', letterSpacing: -0.2,
  },

  sectionHeader: {
    fontSize: 12, fontWeight: '600', color: T.muted,
    letterSpacing: 0.6, textTransform: 'uppercase',
    paddingHorizontal: 20, marginTop: 24, marginBottom: 8,
  },

  card: {
    backgroundColor: T.card, marginHorizontal: 16, borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },

  row: {
    paddingHorizontal: 16, paddingVertical: 14,
  },
  rowLabel: {
    fontSize: 12, fontWeight: '600', color: T.muted,
    letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4,
  },
  rowValue: {
    fontSize: 16, color: T.primary, fontWeight: '400',
  },

  divider: { height: 1, backgroundColor: T.border, marginLeft: 16 },
});
