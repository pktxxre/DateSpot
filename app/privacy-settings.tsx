import { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Switch, Alert, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { T } from '@/lib/theme';

export default function PrivacySettingsScreen() {
  const [isPrivate, setIsPrivate] = useState(false);
  const [showActivity, setShowActivity] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!supabase) return;
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;
      const { data } = await supabase
        .from('profiles')
        .select('is_private, show_activity')
        .eq('id', userId)
        .single();
      if (data) {
        setIsPrivate(data.is_private ?? false);
        setShowActivity(data.show_activity ?? true);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleTogglePrivate(value: boolean) {
    const prev = isPrivate;
    setIsPrivate(value);
    if (!supabase) return;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) { setIsPrivate(prev); return; }
    const { error } = await supabase.from('profiles').update({ is_private: value }).eq('id', userId);
    if (error) {
      setIsPrivate(prev);
      Alert.alert('Error', 'Could not update privacy setting. Please try again.');
    }
  }

  async function handleToggleActivity(value: boolean) {
    const prev = showActivity;
    setShowActivity(value);
    if (!supabase) return;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) { setShowActivity(prev); return; }
    const { error } = await supabase.from('profiles').update({ show_activity: value }).eq('id', userId);
    if (error) {
      setShowActivity(prev);
      Alert.alert('Error', 'Could not update privacy setting. Please try again.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <View style={styles.backBtnCircle}>
            <Ionicons name="chevron-back" size={20} color={T.primary} />
          </View>
        </Pressable>
        <Text style={styles.headerTitle}>Privacy</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionHeader}>Profile</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={T.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Private Profile</Text>
              <Text style={styles.rowSub}>Only your followers can see your profile</Text>
            </View>
            <Switch
              value={isPrivate}
              onValueChange={handleTogglePrivate}
              disabled={loading}
              trackColor={{ false: T.border, true: T.accent }}
              thumbColor="#fff"
            />
          </View>
          {isPrivate && (
            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={14} color={T.muted} />
              <Text style={styles.infoText}>Your current followers can still see your profile.</Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionHeader}>Activity</Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="eye-outline" size={18} color={T.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Share my spots</Text>
              <Text style={styles.rowSub}>Let your followers see your logged spots</Text>
            </View>
            <Switch
              value={showActivity}
              onValueChange={handleToggleActivity}
              disabled={loading}
              trackColor={{ false: T.border, true: T.accent }}
              thumbColor="#fff"
            />
          </View>
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
  backBtn: {},
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
  headerSpacer: { width: 36 },

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

  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  rowIconWrap: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: T.inputBg,
    alignItems: 'center', justifyContent: 'center',
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '500', color: T.primary },
  rowSub: { fontSize: 12, color: T.muted, marginTop: 2 },

  infoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  infoText: { fontSize: 12, color: T.muted, flex: 1 },
});
