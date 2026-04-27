import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { supabase, supabaseConfigError } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

// Keep the splash screen visible until we've checked auth state.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (supabaseConfigError) {
      SplashScreen.hideAsync();
      return;
    }
    // Check existing session on mount.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthChecked(true);
      SplashScreen.hideAsync();
    });

    // Listen for auth state changes (sign-in, sign-out, token refresh).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (supabaseConfigError) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 12, color: '#b00020' }}>
          Configuration error
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 20, color: '#222' }}>
          {supabaseConfigError}
        </Text>
      </View>
    );
  }

  if (!authChecked) {
    // Still checking auth — keep splash visible.
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }}>
          {session ? (
            <Stack.Screen name="(tabs)" />
          ) : (
            <Stack.Screen name="auth" />
          )}
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
