import { Stack, router, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Image, AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '@supabase/supabase-js';
import { initDb, clearUserData } from '@/lib/db';
import { recomputeRatings } from '@/lib/visits';
import { supabase } from '@/lib/supabase';
import { getProfile, clearProfile, getLastUserId, setLastUserId, clearLastUserId } from '@/lib/profile';
import { restoreFromCloud, flushUnsynced } from '@/lib/sync';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
    'DMSans': require('../assets/fonts/DMSans.ttf'),
    'Fraunces-Light': require('../assets/fonts/Fraunces-Light.ttf'),
    'Fraunces-Regular': require('../assets/fonts/Fraunces-Regular.ttf'),
    'Fraunces-Variable': require('../assets/fonts/Fraunces-Variable.ttf'),
    'IBMPlexMono-Regular': require('../assets/fonts/IBMPlexMono-Regular.ttf'),
  });
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  useEffect(() => {
    initDb()
      .then(() => { recomputeRatings(); setDbReady(true); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    // Handle auth deep links (e.g. email confirmation: datespot://...)
    async function handleUrl(url: string) {
      const { error } = await supabase!.auth.exchangeCodeForSession(url);
      if (error) console.warn('exchangeCodeForSession error:', error.message);
    }
    Linking.getInitialURL().then(url => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthChecked(true);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (_event === 'SIGNED_OUT') {
        await clearUserData();
        await clearProfile();
        await clearLastUserId();
        router.replace('/auth');
      } else if (_event === 'SIGNED_IN' && session) {
        // If a different user signed in, wipe the previous user's local data
        const lastUserId = await getLastUserId();
        if (lastUserId && lastUserId !== session.user.id) {
          await clearUserData();
          await clearProfile();
        }
        await setLastUserId(session.user.id);
        await restoreFromCloud(session.user.id);

        // auth/index.tsx manages its own navigation through the signup flow,
        // so don't interrupt it mid-step when SIGNED_IN fires from signUp().
        if (pathnameRef.current.startsWith('/auth')) return;
        const profile = await getProfile();
        if (!profile.username || profile.username === 'You') {
          router.replace('/onboarding');
        } else {
          router.replace('/(tabs)');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Flush any visits that were logged while offline — on launch and every time
  // the app comes back to the foreground (covers regaining service).
  useEffect(() => {
    if (!session || !dbReady) return; // wait for initDb (and its migrations) to finish
    flushUnsynced();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') flushUnsynced();
    });
    return () => sub.remove();
  }, [session, dbReady]);

  const ready = dbReady && fontsLoaded && authChecked;

  // Hide the native splash once the JS splash screen has laid out. The JS screen
  // shows the same splash image, so the native→JS handoff is seamless (no blank
  // gap, no jump from full art to bare text).
  const hideNativeSplash = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Still loading DB / fonts / auth → show the branded splash image, matching
  // the native splash exactly.
  if (!ready) {
    return (
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#FAF7F2' }} onLayout={hideNativeSplash}>
        <Image
          source={require('../assets/images/splash.png')}
          style={{ flex: 1, width: '100%', height: '100%' }}
          resizeMode="contain"
        />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={hideNativeSplash}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* Auth screens stay reachable even after signUp() sets the session,
            so the multi-step signup flow on /auth/index isn't ejected mid-way. */}
        <Stack.Screen name="auth/index" />
        <Stack.Screen name="auth/signup" />
        <Stack.Screen name="auth/login" />

        {/* Everything else requires a session. When logged out these screens are
            removed, so a cold start at "/" falls back to auth/index first — it
            renders FIRST with no redirect and no transition. */}
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="walkthrough" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="edit-profile" />
          <Stack.Screen name="account-details" />
          <Stack.Screen name="change-password" />
          <Stack.Screen name="privacy-settings" />
          <Stack.Screen name="inbox" />
          <Stack.Screen name="follow-list" />
          <Stack.Screen name="user-spots" />
          <Stack.Screen name="my-spots" />
          <Stack.Screen name="my-future" />
          <Stack.Screen name="my-date-nights" />
          <Stack.Screen name="spots" />
          <Stack.Screen name="spot/[id]" />
          <Stack.Screen name="future/[id]" />
          <Stack.Screen name="stack/[id]" />
          <Stack.Screen name="tier/[tier]" />
          <Stack.Screen name="user/[id]" />
        </Stack.Protected>
      </Stack>
    </GestureHandlerRootView>
  );
}
