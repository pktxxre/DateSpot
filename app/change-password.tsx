import { useState } from 'react';
import {
  StyleSheet, View, Text, TextInput, Pressable,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { T } from '@/lib/theme';

function PwReq({ met, label }: { met: boolean; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Ionicons
        name={met ? 'checkmark-circle' : 'ellipse-outline'}
        size={14}
        color={met ? '#34c759' : T.placeholder}
      />
      <Text style={{ fontSize: 12, color: met ? T.muted : T.placeholder }}>{label}</Text>
    </View>
  );
}

export default function ChangePasswordScreen() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const pwValid =
    newPassword.length >= 8 &&
    /[A-Z]/.test(newPassword) &&
    /[0-9]/.test(newPassword) &&
    /[^a-zA-Z0-9]/.test(newPassword);

  const sameAsCurrentError =
    newPassword.length > 0 && currentPassword.length > 0 && newPassword === currentPassword;

  const canSubmit =
    currentPassword.length > 0 && pwValid && newPassword === confirmPassword && !sameAsCurrentError;

  async function handleChangePassword() {
    if (!supabase) {
      Alert.alert('Error', 'App is not configured.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Passwords do not match', 'New password and confirmation must match.');
      return;
    }

    setLoading(true);

    // Re-authenticate with current password first
    const { data: userData } = await supabase.auth.getUser();
    const email = userData?.user?.email;
    if (!email) {
      setLoading(false);
      Alert.alert('Error', 'Could not retrieve account email. Please log out and try again.');
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (signInError) {
      setLoading(false);
      Alert.alert('Incorrect Password', 'Your current password is incorrect.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    Alert.alert('Password Updated', 'Your password has been changed successfully.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
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
          <Text style={styles.headerTitle}>Change Password</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.sectionHeader}>Security</Text>
          <View style={styles.card}>
            {/* Current password */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>CURRENT PASSWORD</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor={T.placeholder}
                  secureTextEntry={!showCurrent}
                  autoComplete="password"
                />
                <Pressable onPress={() => setShowCurrent(v => !v)} hitSlop={8} style={styles.eyeBtn}>
                  <Ionicons name={showCurrent ? 'eye-off-outline' : 'eye-outline'} size={20} color={T.muted} />
                </Pressable>
              </View>
            </View>

            <View style={styles.divider} />

            {/* New password */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
              <View style={{ position: 'relative' }}>
                <View style={[styles.inputRow, sameAsCurrentError && styles.inputRowError]}>
                  <TextInput
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter new password"
                    placeholderTextColor={T.placeholder}
                    secureTextEntry={!showNew}
                    autoComplete="new-password"
                  />
                  <Pressable onPress={() => setShowNew(v => !v)} hitSlop={8} style={styles.eyeBtn}>
                    <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={20} color={T.muted} />
                  </Pressable>
                </View>
                {sameAsCurrentError && (
                  <Text style={styles.samePasswordError}>Must differ from current password</Text>
                )}
              </View>
              {newPassword.length > 0 && (
                <View style={styles.pwReqs}>
                  <PwReq met={newPassword.length >= 8} label="8+ characters" />
                  <PwReq met={/[A-Z]/.test(newPassword)} label="Uppercase letter" />
                  <PwReq met={/[0-9]/.test(newPassword)} label="Number" />
                  <PwReq met={/[^a-zA-Z0-9]/.test(newPassword)} label="Symbol (!@#$…)" />
                </View>
              )}
            </View>

            <View style={styles.divider} />

            {/* Confirm new password */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>CONFIRM NEW PASSWORD</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter new password"
                  placeholderTextColor={T.placeholder}
                  secureTextEntry={!showConfirm}
                  autoComplete="new-password"
                />
                <Pressable onPress={() => setShowConfirm(v => !v)} hitSlop={8} style={styles.eyeBtn}>
                  <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={T.muted} />
                </Pressable>
              </View>
              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <Text style={styles.matchError}>Passwords do not match</Text>
              )}
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.submitBtn,
              (!canSubmit || loading) && styles.submitBtnDisabled,
              pressed && canSubmit && { opacity: 0.85 },
            ]}
            onPress={handleChangePassword}
            disabled={!canSubmit || loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.submitBtnText}>Update Password</Text>
            }
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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

  scrollContent: { paddingBottom: 20 },

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

  fieldWrap: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: T.muted,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.inputBg, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  input: { flex: 1, fontSize: 16, color: T.primary },
  eyeBtn: { paddingLeft: 8 },
  pwReqs: { gap: 4, paddingTop: 4 },
  matchError: { fontSize: 12, color: T.danger, marginTop: 2 },
  inputRowError: { borderWidth: 1.5, borderColor: T.danger },
  samePasswordError: { position: 'absolute', bottom: -17, right: 0, fontSize: 12, color: T.danger },

  divider: { height: 1, backgroundColor: T.border, marginLeft: 16 },

  submitBtn: {
    backgroundColor: T.accent, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    marginHorizontal: 16, marginTop: 24,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
});
