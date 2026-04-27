/**
 * Map tab — the home screen.
 *
 * Phase 0: Apple Maps via react-native-maps, user location dot, blank canvas.
 * Phase 1: adds colored RatingPin markers, clustering, filter bar.
 */

import { useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import MapView, { PROVIDER_DEFAULT, Region, Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';

// Default starting region — New York City.
// In Phase 1 this will center on the user's actual location.
const DEFAULT_REGION: Region = {
  latitude: 40.7580,
  longitude: -73.9855,
  latitudeDelta: 0.08,
  longitudeDelta: 0.05,
};

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
      />

      {/* Location button — bottom right, above tab bar */}
      <TouchableOpacity
        style={styles.locationBtn}
        onPress={() => mapRef.current?.animateToRegion(DEFAULT_REGION, 400)}
        activeOpacity={0.8}
      >
        <Text style={styles.locationIcon}>⊕</Text>
      </TouchableOpacity>

      {/* Phase 0 scaffold label — removed in Phase 1 */}
      <View style={styles.scaffoldBadge} pointerEvents="none">
        <Text style={styles.scaffoldText}>Phase 0 — Apple Maps ✓</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  map: {
    flex: 1,
  },
  locationBtn: {
    position: 'absolute',
    bottom: 28,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  locationIcon: {
    fontSize: 22,
    color: Colors.primary ?? '#000',
  },
  scaffoldBadge: {
    position: 'absolute',
    bottom: 88,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  scaffoldText: {
    color: '#fff',
    fontSize: 12,
  },
});
