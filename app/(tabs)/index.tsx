/**
 * Map tab — the home screen.
 *
 * Phase 0: blank Mapbox map, verifies the SDK and access token are working.
 * Phase 1: adds colored pins, clustering, filter bar, segmented control.
 */

import { StyleSheet, View, Text } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';

// Default starting view — San Francisco.
// On first launch, expo-location will center the map on the user's position.
const DEFAULT_COORDINATES: [number, number] = [-122.4194, 37.7749];
const DEFAULT_ZOOM = 12;

export default function MapScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.mapContainer}>
        <MapboxGL.MapView
          style={styles.map}
          styleURL={MapboxGL.StyleURL.Street}
          logoEnabled={false}
          attributionEnabled={false}
          compassEnabled
        >
          <MapboxGL.Camera
            zoomLevel={DEFAULT_ZOOM}
            centerCoordinate={DEFAULT_COORDINATES}
            animationMode="none"
          />
        </MapboxGL.MapView>

        {/* Phase 0 scaffold label — removed in Phase 1 */}
        <View style={styles.scaffoldBadge} pointerEvents="none">
          <Text style={styles.scaffoldText}>Phase 0 scaffold — map renders ✓</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  scaffoldBadge: {
    position: 'absolute',
    bottom: 16,
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
