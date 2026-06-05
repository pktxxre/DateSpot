export const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY ?? '';

// MapTiler base styles, cleanest → most detailed. Swap MAP_STYLE below to change
// the map background. All are valid for our key.
//   dataviz-light    – minimal light gray, designed as a backdrop for data/pins (cleanest)
//   basic-v2         – clean & simple, keeps useful roads/labels
//   bright-v2        – clean but brighter/more colorful
//   streets-v2-light – lighter version of the original streets style
//   backdrop         – ultra-minimal neutral
//   pastel           – soft muted colors
//   toner-v2         – high-contrast black & white
//   streets-v2       – the original (most detailed)
//   streets-v2-pastel – full streets detail + place labels, soft muted tones
const MAP_STYLE = 'streets-v2-pastel';

export const MAP_STYLE_URL = `https://api.maptiler.com/maps/${MAP_STYLE}/style.json?key=${MAPTILER_KEY}`;

// Forward geocoding (text → places). types=poi,address is essential: without it
// MapTiler buries businesses under fuzzy street-name matches (e.g. "Canlis" the
// restaurant loses to "Canis Drive"). proximity ranks the user's city first;
// country=us blocks international noise.
export function geocodeSearchUrl(query: string, lng: number, lat: number): string {
  return `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json`
    + `?key=${MAPTILER_KEY}&country=us&types=poi,address&limit=8&proximity=${lng},${lat}`;
}

// Reverse geocoding (coordinate → address).
export function reverseGeocodeUrl(lng: number, lat: number): string {
  return `https://api.maptiler.com/geocoding/${lng},${lat}.json?key=${MAPTILER_KEY}&limit=1`;
}

// MapLibre uses zoom levels (0-22). The rest of the codebase still works in
// react-native-maps' Region shape (latitudeDelta). These helpers bridge the two.
//
// Web Mercator: at zoom z, the world is 2^z tiles of 360° longitude wide, so
// the visible longitude span ≈ 360 / 2^z. latitudeDelta is close enough to
// longitudeDelta near our use cases (cities) to use the same formula.
export function latitudeDeltaToZoom(latitudeDelta: number): number {
  return Math.log2(360 / latitudeDelta);
}

export function zoomToLatitudeDelta(zoom: number): number {
  return 360 / Math.pow(2, zoom);
}

// MapLibre's LngLatBounds = [west, south, east, north] (flat). Converts to the
// react-native-maps Region shape so existing latitudeDelta-based logic keeps working.
export function boundsToRegion(
  bounds: [number, number, number, number],
): { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } {
  const [west, south, east, north] = bounds;
  return {
    latitude: (north + south) / 2,
    longitude: (west + east) / 2,
    latitudeDelta: Math.abs(north - south),
    longitudeDelta: Math.abs(east - west),
  };
}
