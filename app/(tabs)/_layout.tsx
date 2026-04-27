import { Tabs } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopColor: Colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          tabBarIcon: ({ color }) => (
            // Map/location icon placeholder — replace with expo/vector-icons or custom SVG
            <MapIcon color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log',
          tabBarIcon: ({ color }) => <PlusIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <PersonIcon color={color} />,
        }}
      />
    </Tabs>
  );
}

// Minimal inline icon components — replace with @expo/vector-icons in Phase 1.
function MapIcon({ color }: { color: string }) {
  const { View } = require('react-native');
  return <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: color }} />;
}
function PlusIcon({ color }: { color: string }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 24, color, lineHeight: 24 }}>+</Text>;
}
function PersonIcon({ color }: { color: string }) {
  const { View } = require('react-native');
  return <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: color }} />;
}
