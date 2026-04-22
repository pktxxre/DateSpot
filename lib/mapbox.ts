import Mapbox from '@rnmapbox/maps';

const mapboxToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

if (!mapboxToken) {
  console.warn(
    'EXPO_PUBLIC_MAPBOX_TOKEN is not set. Map will not render. Copy .env.example to .env.'
  );
}

// Initialize Mapbox with the public access token.
// The secret MAPBOX_DOWNLOADS_TOKEN is only needed at build time (SDK install).
export function initMapbox() {
  Mapbox.setAccessToken(mapboxToken ?? '');
}
