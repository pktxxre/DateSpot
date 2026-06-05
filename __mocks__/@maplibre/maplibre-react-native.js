// Manual mock so importing map.tsx in tests doesn't load maplibre's native
// TurboModules (unavailable in the Node/Jest environment). Components are stubs;
// tests that touch map logic exercise pure helpers, not the native renderer.
const stub = (name) => {
  const C = () => null;
  C.displayName = name;
  return C;
};

module.exports = {
  Map: stub('MapLibreMap'),
  Camera: stub('Camera'),
  Marker: stub('Marker'),
  UserLocation: stub('UserLocation'),
};
