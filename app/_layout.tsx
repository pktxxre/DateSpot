import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { initDb } from '@/lib/db';
import { recomputeRatings } from '@/lib/visits';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [fontsLoaded] = useFonts({ ...Ionicons.font });

  useEffect(() => {
    initDb()
      .then(() => { recomputeRatings(); setDbReady(true); })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (dbReady && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [dbReady, fontsLoaded]);

  if (!dbReady || !fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
        <Stack.Screen name="spot/[id]" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
