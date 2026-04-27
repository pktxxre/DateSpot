/**
 * Profile tab — placeholder for Phase 5.
 *
 * In Phase 5 this becomes: display name, avatar, username, share toggle,
 * settings, and delete account.
 */

import { StyleSheet, View, Text, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  async function handleSignOut() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => supabase.auth.signOut(),
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Profile</Text>

        {user && (
          <View style={styles.userCard}>
            <Text style={styles.email}>{user.email}</Text>
            <Text style={styles.uid}>ID: {user.id.slice(0, 8)}…</Text>
          </View>
        )}

        <Text style={styles.placeholder}>
          Full profile UI (name, avatar, username, share map toggle, settings)
          ships in Phase 5.
        </Text>

        <Pressable style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 24,
    marginTop: 8,
  },
  userCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  email: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  uid: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  placeholder: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 32,
  },
  signOutButton: {
    borderWidth: 1,
    borderColor: Colors.error,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 'auto',
  },
  signOutText: {
    color: Colors.error,
    fontWeight: '600',
    fontSize: 15,
  },
});
