/**
 * Auth screen — sign-in entry point.
 *
 * Order per design doc:
 * 1. Apple Sign-In (required for iOS App Store)
 * 2. Google Sign-In
 * 3. Email / password (fallback)
 *
 * Phase 0: all three methods wired up. Error handling + polish in Phase 6.
 */

import { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';

// Required for Google OAuth to work with expo-auth-session.
WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');

  // ── Apple Sign-In ────────────────────────────────────────────────────────────
  async function handleAppleSignIn() {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });
        if (error) throw error;
      }
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple sign-in failed', e.message);
      }
    }
  }

  // ── Google Sign-In ───────────────────────────────────────────────────────────
  async function handleGoogleSignIn() {
    const redirectUrl = AuthSession.makeRedirectUri({ scheme: 'datespot' });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      Alert.alert('Google sign-in failed', error.message);
      return;
    }

    if (data?.url) {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const access_token = url.searchParams.get('access_token');
        const refresh_token = url.searchParams.get('refresh_token');
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        }
      }
    }
  }

  // ── Email / Password ─────────────────────────────────────────────────────────
  async function handleEmailAuth() {
    if (!email || !password) {
      Alert.alert('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const { error } =
        mode === 'sign-in'
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });
      if (error) throw error;
    } catch (e: any) {
      Alert.alert('Sign-in failed', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo / wordmark placeholder */}
        <View style={styles.header}>
          <Text style={styles.logo}>DateSpot</Text>
          <Text style={styles.tagline}>Your date map.</Text>
        </View>

        {/* Apple Sign-In — iOS only */}
        {Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={12}
            style={styles.appleButton}
            onPress={handleAppleSignIn}
          />
        )}

        {/* Google Sign-In */}
        <Pressable style={styles.googleButton} onPress={handleGoogleSignIn}>
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </Pressable>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email / Password */}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={Colors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={Colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
        />

        <Pressable
          style={[styles.emailButton, loading && styles.emailButtonDisabled]}
          onPress={handleEmailAuth}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.emailButtonText}>
              {mode === 'sign-in' ? 'Sign in' : 'Create account'}
            </Text>
          )}
        </Pressable>

        <Pressable
          style={styles.toggleMode}
          onPress={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
        >
          <Text style={styles.toggleModeText}>
            {mode === 'sign-in'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </Text>
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
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  appleButton: {
    height: 52,
    borderRadius: 12,
    marginBottom: 12,
  },
  googleButton: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    marginBottom: 12,
  },
  emailButton: {
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  emailButtonDisabled: {
    opacity: 0.6,
  },
  emailButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleMode: {
    alignItems: 'center',
  },
  toggleModeText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
});
