import * as Location from 'expo-location';

// Last-known device location, cached in-memory so screens can read it
// synchronously without each one re-prompting / re-fetching.
let _last: { lat: number; lng: number } | null = null;

export function getCachedLocation(): { lat: number; lng: number } | null {
  return _last;
}

// Returns the device's current location, or null if permission isn't granted.
// Pass request=true to prompt for permission if it hasn't been decided yet
// (expo no-ops the prompt if the user already allowed or denied).
export async function ensureLocation(request = false): Promise<{ lat: number; lng: number } | null> {
  try {
    let status = (await Location.getForegroundPermissionsAsync()).status;
    if (status !== 'granted' && request) {
      status = (await Location.requestForegroundPermissionsAsync()).status;
    }
    if (status !== 'granted') return _last;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    _last = { lat: loc.coords.latitude, lng: loc.coords.longitude };
    return _last;
  } catch {
    return _last;
  }
}
