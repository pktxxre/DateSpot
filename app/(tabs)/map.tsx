import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  StyleSheet, View, Text, Pressable, TextInput, Alert, ScrollView, Image, LayoutAnimation,
  Modal, KeyboardAvoidingView, Platform, Animated, ActivityIndicator, Easing,
} from 'react-native';
import {
  Map as MapLibreMap,
  Camera,
  Marker,
  type CameraRef,
  type MapRef,
} from '@maplibre/maplibre-react-native';
import { MAP_STYLE_URL, latitudeDeltaToZoom, boundsToRegion, geocodeSearchUrl, reverseGeocodeUrl } from '@/lib/mapStyle';

// Region kept as a local type alias so the rest of the file (zoom tiers, label
// thresholds, search viewbox) can continue to think in latitudeDelta. We populate
// it from MapLibre's visibleBounds in onRegionDidChange.
type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type MapPressEvent = { nativeEvent: { lngLat: [number, number] } };
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// Direct callbacks allow immediate response when map tab is already focused.
let _openLogCallback: (() => void) | null = null;
let _openFutureCallback: (() => void) | null = null;
let _openLogWithLocationCallback: ((name: string, lat: number, lng: number, activityType?: string | null, occasionType?: string | null) => void) | null = null;
let _selectVisitCallback: ((visitId: string) => void) | null = null;
let _selectSeedSpotCallback: ((spotId: string) => void) | null = null;
let _pendingOpenLog = false;
let _pendingOpenFuture = false;
let _pendingOpenLogWithLocation: { name: string; lat: number; lng: number; activityType?: string | null; occasionType?: string | null } | null = null;
let _pendingSelectVisit: string | null = null;
let _pendingSelectSeedSpot: string | null = null;
let _skipNextResumePrompt = false;

export function scheduleOpenLog() {
  if (_openLogCallback) { _openLogCallback(); }
  else { _pendingOpenLog = true; }
}
export function scheduleOpenFutureDate() {
  if (_openFutureCallback) { _openFutureCallback(); }
  else { _pendingOpenFuture = true; }
}
export function scheduleOpenLogWithLocation(name: string, lat: number, lng: number, activityType?: string | null, occasionType?: string | null) {
  if (_openLogWithLocationCallback) { _openLogWithLocationCallback(name, lat, lng, activityType, occasionType); }
  else { _pendingOpenLogWithLocation = { name, lat, lng, activityType, occasionType }; }
}
export function scheduleSelectVisit(visitId: string) {
  if (_selectVisitCallback) { _selectVisitCallback(visitId); }
  else { _pendingSelectVisit = visitId; }
}
export function scheduleSelectSeedSpot(spotId: string) {
  if (_selectSeedSpotCallback) { _selectSeedSpotCallback(spotId); }
  else { _pendingSelectSeedSpot = spotId; }
}
import * as Crypto from 'expo-crypto';
import {
  getAllVisits, insertVisit, ratingColor, formatRating, friendlyDate, Visit,
  ActivityType, OccasionType, Price, ACTIVITY_TYPES, OCCASION_TYPES, PRICE_LABELS,
} from '@/lib/visits';
import {
  startComparison, advance, resolveRankOrder, resolveAtMid,
  currentComparison, ComparisonState,
} from '@/lib/ranking';
import type { Triage } from '@/lib/visits';
import { saveDraft, loadDraft, clearDraft } from '@/lib/draft';
import { getAllFutureSpots, insertFutureSpot, deleteFutureSpot, FutureSpot } from '@/lib/future';
import { getProfile, saveProfile } from '@/lib/profile';
import { getSeedSpotsRaw, SeedSpot } from '@/lib/seeds';
import { T } from '@/lib/theme';
import { TabSlideWrapper } from '@/components/TabSlideWrapper';
import { scheduleNewStack } from '@/lib/stackCreation';

// Raw feature from the MapTiler Geocoding API (GeoJSON FeatureCollection).
interface GeocodeFeature {
  id: string;
  text?: string;        // primary label (POI name, street, or place name)
  place_name?: string;  // full "Name, 123 St, City, State ZIP, Country"
  center?: [number, number]; // [lng, lat]
}

// Normalized result the search UI consumes.
interface SearchResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

const STREET_ABBREV: [RegExp, string][] = [
  [/\bAvenue\b/g, 'Ave'], [/\bBoulevard\b/g, 'Blvd'], [/\bDrive\b/g, 'Dr'],
  [/\bStreet\b/g, 'St'], [/\bRoad\b/g, 'Rd'], [/\bLane\b/g, 'Ln'],
  [/\bCourt\b/g, 'Ct'], [/\bPlace\b/g, 'Pl'], [/\bCircle\b/g, 'Cir'],
  [/\bHighway\b/g, 'Hwy'], [/\bNortheast\b/g, 'NE'], [/\bNorthwest\b/g, 'NW'],
  [/\bSoutheast\b/g, 'SE'], [/\bSouthwest\b/g, 'SW'],
  [/\bNorth\b/g, 'N'], [/\bSouth\b/g, 'S'], [/\bEast\b/g, 'E'], [/\bWest\b/g, 'W'],
];
function abbreviateStreet(s: string): string {
  let r = s;
  for (const [pat, abbr] of STREET_ABBREV) r = r.replace(pat, abbr);
  return r;
}

const STATE_ABBREV: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
};

// MapTiler place_name is "Name, 123 Main St, City, State ZIP, Country". Reshape it
// so cleanAddress() (written for Nominatim) can parse it: drop the country and
// split a trailing "State ZIP" into separate comma parts.
function normalizePlaceName(placeName: string): string {
  const parts = placeName.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length && /^(United States|USA|US)$/i.test(parts[parts.length - 1])) {
    parts.pop();
  }
  return parts
    .map(p => p.replace(/^(.+?)\s+(\d{5})(-\d{4})?$/, '$1, $2'))
    .join(', ');
}

// Clean address string from a MapTiler feature, or the primary label as fallback.
function featureAddress(feat: GeocodeFeature): string {
  const cleaned = feat.place_name ? cleanAddress(normalizePlaceName(feat.place_name)) : '';
  return cleaned || feat.text || '';
}

const STATE_CODES = new Set(Object.values(STATE_ABBREV));

export function cleanAddress(addr: string): string {
  const parts = addr.split(/[\n,]/).map(p => p.trim()).filter(Boolean);

  // Find state abbreviation (handles "WA", "WA 98109", or full "Washington")
  let stateIdx = -1, stateAbbr = '', zip = '';
  for (let i = 0; i < parts.length; i++) {
    const m = parts[i].match(/^([A-Z]{2})(\s+\d{5})?$/);
    if (m && STATE_CODES.has(m[1])) {
      stateIdx = i; stateAbbr = m[1];
      if (m[2]) zip = m[2].trim();
      break;
    }
    const abbr = STATE_ABBREV[parts[i]];
    if (abbr) { stateIdx = i; stateAbbr = abbr; break; }
  }

  // Find zip if not already extracted
  if (!zip) {
    for (let i = Math.max(0, stateIdx); i < parts.length; i++) {
      const m = parts[i].match(/\b(\d{5})\b/);
      if (m) { zip = m[1]; break; }
    }
  }

  // City: last non-county item before state
  let city = '';
  const searchTo = stateIdx >= 0 ? stateIdx - 1 : parts.length - 1;
  for (let i = searchTo; i >= 0; i--) {
    if (!/County$/i.test(parts[i]) && !/^\d{5}/.test(parts[i])) {
      city = parts[i]; break;
    }
  }

  // Street: find a pure number (house num) + next part as street name,
  // or a "number words" combined part
  let street = '';
  for (let i = 0; i < parts.length && i <= searchTo; i++) {
    if (/^\d+$/.test(parts[i]) && i + 1 < parts.length) {
      street = `${parts[i]} ${abbreviateStreet(parts[i + 1])}`;
      break;
    }
    if (/^\d+\s+\S/.test(parts[i])) {
      street = abbreviateStreet(parts[i]);
      break;
    }
  }

  if (!street) return addr; // couldn't parse — return original unchanged

  const cityState = [city, stateAbbr].filter(Boolean).join(', ');
  const tail = zip ? `${cityState} ${zip}` : cityState;
  return [street, tail].filter(Boolean).join(', ');
}


// Set to true before pushing to a detail screen so useFocusEffect skips the filter reset
let _mapNavigatedToDetail = false;

const LABEL_NEIGHBOR_THRESHOLD = 0.008; // ~800m in degrees
const LABEL_ZOOM_THRESHOLD = 0.012; // show pin labels when latitudeDelta is below this

const SEATTLE_REGION: Region = {
  latitude: 47.6062,
  longitude: -122.3321,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const CITY_REGIONS: Record<string, Region> = {
  'Seattle, WA': SEATTLE_REGION,
};

type Step = 'mode-select' | 'location' | 'details' | 'triage' | 'compare' | 'done' | 'future-pin' | 'future-name' | 'future-details';
type MapFilter = 'been' | 'want' | 'spots';

const SEED_VENUE_TYPES = [
  { value: 'food',          label: 'Food' },
  { value: 'bars',          label: 'Bars' },
  { value: 'cafes',         label: 'Cafes' },
  { value: 'outdoors',      label: 'Outdoors' },
  { value: 'indoors',       label: 'Indoors' },
  { value: 'view',          label: 'Scenic' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'shopping',      label: 'Shopping' },
  { value: 'other',         label: 'Other' },
];

const PRICE_FILTER_OPTIONS = [
  { value: 1, label: '$' },
  { value: 2, label: '$$' },
  { value: 3, label: '$$$' },
  { value: 0, label: 'Free' },
];

interface DraftVisit {
  lat: number;
  lng: number;
  venue_name: string;
  visited_at: string;
  notes: string;
  activity_type: ActivityType;
  occasion_type: OccasionType;
  occasion_label: string;
  price: Price;
  photos: string[];
  isPinOnly: boolean;
  address: string;
}

function flyToRegion(
  ref: { current: CameraRef | null },
  r: Region,
  duration: number = 0,
) {
  if (!ref.current) return;
  const opts = {
    center: [r.longitude, r.latitude] as [number, number],
    zoom: latitudeDeltaToZoom(r.latitudeDelta),
  };
  if (duration === 0) ref.current.jumpTo(opts);
  else ref.current.easeTo({ ...opts, duration });
}

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(reverseGeocodeUrl(lng, lat));
    const data = await res.json();
    const feat: GeocodeFeature | undefined = data.features?.[0];
    if (!feat) return null;
    return featureAddress(feat) || null;
  } catch {
    return null;
  }
}

// Assign each pin's name label to the left or right of its badge to reduce
// overlap. Labels collide when pins sit at a similar latitude (same vertical
// band) on the same side, so we walk pins top-to-bottom and flip the side
// whenever a pin is vertically close to the previously placed one. Isolated
// pins default to the right.
function assignLabelSides(
  items: { id: string; lat: number; lng: number }[],
): Map<string, 'left' | 'right'> {
  const sorted = [...items].sort((a, b) => b.lat - a.lat || a.lng - b.lng);
  const sides = new Map<string, 'left' | 'right'>();
  let prevLat: number | null = null;
  let prevSide: 'left' | 'right' = 'right';
  for (const it of sorted) {
    let side: 'left' | 'right' = 'right';
    if (prevLat !== null && Math.abs(it.lat - prevLat) < LABEL_NEIGHBOR_THRESHOLD) {
      side = prevSide === 'right' ? 'left' : 'right';
    }
    sides.set(it.id, side);
    prevLat = it.lat;
    prevSide = side;
  }
  return sides;
}

// Pin name label: caps at 2 lines, wraps on whole words (RN never splits a word
// unless it alone exceeds the line), ellipsizes the overflow, and stays
// vertically centered on the badge.
function PinLabel({ name, side, bold }: { name: string; side: 'left' | 'right'; bold?: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={[styles.pinLabelWrap, side === 'right' ? styles.pinLabelWrapRight : styles.pinLabelWrapLeft]}
    >
      <Text
        numberOfLines={2}
        ellipsizeMode="tail"
        style={[styles.pinLabel, { textAlign: side === 'right' ? 'left' : 'right' }, bold && { fontWeight: '900' }]}
      >{name}</Text>
    </View>
  );
}

export default function MapScreen() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [futureSpots, setFutureSpots] = useState<FutureSpot[]>([]);
  const [seedSpots, setSeedSpots] = useState<SeedSpot[]>([]);
  const [mapFilter, setMapFilter] = useState<MapFilter>('been');
  const [mapCategoryFilters, setMapCategoryFilters] = useState<string[]>([]);
  const [mapPriceFilters, setMapPriceFilters] = useState<number[]>([]);
  const [showMapFilter, setShowMapFilter] = useState(false);
  const [selectedSeedSpot, setSelectedSeedSpot] = useState<SeedSpot | null>(null);
  const [region, setRegion] = useState<Region>(SEATTLE_REGION);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [selectedFuture, setSelectedFuture] = useState<FutureSpot | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [draft, setDraft] = useState<Partial<DraftVisit>>({});
  const [droppingPin, setDroppingPin] = useState(false);
  const [cmpState, setCmpState] = useState<ComparisonState<Visit> | null>(null);
  const [currentTriage, setCurrentTriage] = useState<Triage>('okay');
  const [geocodeSuggestion, setGeocodeSuggestion] = useState<string | null>(null);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const sheetRef = useRef<BottomSheet>(null);
  const mapRef = useRef<MapRef>(null);
  const cameraRef = useRef<CameraRef>(null);
  const toModalRef = useRef(false);
  const lastPinPressAt = useRef(0);
  const lastSavedLatLng = useRef<{ lat: number; lng: number } | null>(null);
  const [animatingVisitId, setAnimatingVisitId] = useState<string | null>(null);
  const [animatingFutureId, setAnimatingFutureId] = useState<string | null>(null);
  // Scale of the freshly-saved pin. Starts at 0 (invisible), springs to 1.18 then settles at 1.
  // Applied directly to the Marker's child view so the animation happens AT the pin's true
  // lat/lng — no overlay coordinate math, no drift. Shared between been-to and want-to-go
  // since only one save flow is active at a time.
  const sproutAnim = useRef(new Animated.Value(1)).current;
  const stepAnim = useRef(new Animated.Value(0)).current;

  const selectedVisitRef = useRef<Visit | null>(null);
  const selectedFutureRef = useRef<FutureSpot | null>(null);
  const mapFilterTabLayouts = useRef<Record<string, { x: number; width: number }>>({});
  const mapFilterTextWidths = useRef<Record<string, number>>({});
  const mapFilterIndicatorX = useRef(new Animated.Value(0)).current;
  const [mapFilterIndicatorWidth, setMapFilterIndicatorWidth] = useState(0);

  useEffect(() => {
    _openLogCallback = () => {
      setSelectedVisit(null);
      setStep('mode-select');
      sheetRef.current?.snapToIndex(1);
    };
    _openFutureCallback = () => {
      setSelectedVisit(null);
      setMapFilter('want');
      setStep('future-pin');
      sheetRef.current?.snapToIndex(1);
    };
    _openLogWithLocationCallback = (name: string, lat: number, lng: number, activityType?: string | null, occasionType?: string | null) => {
      _skipNextResumePrompt = true;
      setSelectedVisit(null);
      setDraft({ venue_name: name, lat, lng, ...(activityType ? { activity_type: activityType as ActivityType } : {}), ...(occasionType ? { occasion_type: occasionType as OccasionType } : {}) });
      reverseGeocode(lat, lng).then(addr => {
        if (addr) setDraft(d => ({ ...d, address: d.address || addr }));
      });
      zoomToSpot(lat, lng);
      toModalRef.current = true;
      setStep('details');
    };
    _selectVisitCallback = (visitId: string) => {
      _skipNextResumePrompt = true;
      const visit = getAllVisits().find(v => v.id === visitId);
      if (!visit) return;
      setMapFilter('been');
      setSelectedVisit(visit);
      setTimeout(() => {
        flyToRegion(cameraRef,{ latitude: visit.lat, longitude: visit.lng, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 400);
      }, 300);
    };
    _selectSeedSpotCallback = (spotId: string) => {
      _skipNextResumePrompt = true;
      getSeedSpotsRaw().then(spots => {
        const spot = spots.find(s => s.id === spotId);
        if (!spot) return;
        setSeedSpots(spots);
        setMapFilter('spots');
        setSelectedSeedSpot(spot);
        setTimeout(() => {
          flyToRegion(cameraRef,{ latitude: spot.lat, longitude: spot.lng, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 400);
        }, 300);
      });
    };
    return () => {
      _openLogCallback = null;
      _openFutureCallback = null;
      _openLogWithLocationCallback = null;
      _selectVisitCallback = null;
      _selectSeedSpotCallback = null;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      const fromDetail = _mapNavigatedToDetail;
      _mapNavigatedToDetail = false;
      // Only reset the filter when entering from another tab, not returning from a card or using View Map
      if (!fromDetail && !_pendingSelectVisit && !_pendingSelectSeedSpot) setMapFilter('been');
      const freshVisits = getAllVisits();
      setVisits(freshVisits);
      const freshFuture = getAllFutureSpots();
      setFutureSpots(freshFuture);
      getSeedSpotsRaw().then(setSeedSpots);
      // Clear the bottom panel if the selected visit/future spot was deleted while away.
      const cur = selectedVisitRef.current;
      if (cur && !freshVisits.find(v => v.id === cur.id)) {
        setSelectedVisit(null);
      }
      const curFuture = selectedFutureRef.current;
      if (curFuture && !freshFuture.find(s => s.id === curFuture.id)) {
        setSelectedFuture(null);
      }
      if (_pendingOpenLog) {
        _pendingOpenLog = false;
        setSelectedVisit(null);
        setStep('mode-select');
        sheetRef.current?.snapToIndex(1);
      }
      if (_pendingOpenFuture) {
        _pendingOpenFuture = false;
        setSelectedVisit(null);
        setMapFilter('want');
        setStep('future-pin');
        sheetRef.current?.snapToIndex(1);
      }
      if (_pendingOpenLogWithLocation) {
        const { name, lat, lng, activityType, occasionType } = _pendingOpenLogWithLocation;
        _pendingOpenLogWithLocation = null;
        _skipNextResumePrompt = true;
        setSelectedVisit(null);
        setDraft({ venue_name: name, lat, lng, ...(activityType ? { activity_type: activityType as ActivityType } : {}), ...(occasionType ? { occasion_type: occasionType as OccasionType } : {}) });
        reverseGeocode(lat, lng).then(addr => {
          if (addr) setDraft(d => ({ ...d, address: d.address || addr }));
        });
        zoomToSpot(lat, lng, 200);
        toModalRef.current = true;
        setStep('details');
        sheetRef.current?.close();
        return;
      }
      if (_pendingSelectVisit) {
        const visitId = _pendingSelectVisit;
        _pendingSelectVisit = null;
        _skipNextResumePrompt = true;
        const allVisits = getAllVisits();
        const visit = allVisits.find(v => v.id === visitId);
        if (visit) {
          setVisits(allVisits);
          setMapFilter('been');
          setSelectedVisit(visit);
          setTimeout(() => {
            flyToRegion(cameraRef,{ latitude: visit.lat, longitude: visit.lng, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 400);
          }, 400);
        }
        return;
      }
      if (_pendingSelectSeedSpot) {
        const spotId = _pendingSelectSeedSpot;
        _pendingSelectSeedSpot = null;
        _skipNextResumePrompt = true;
        getSeedSpotsRaw().then(spots => {
          const spot = spots.find(s => s.id === spotId);
          if (!spot) return;
          setSeedSpots(spots);
          setMapFilter('spots');
          setSelectedSeedSpot(spot);
          setTimeout(() => {
            flyToRegion(cameraRef,{ latitude: spot.lat, longitude: spot.lng, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 400);
          }, 400);
        });
        return;
      }
      if (_skipNextResumePrompt) {
        _skipNextResumePrompt = false;
        return;
      }
      loadDraft().then((saved) => {
        if (saved && saved.step !== 'done') {
          Alert.alert(
            'Resume logging?',
            `You were logging "${saved.venue_name || 'a spot'}" — continue?`,
            [
              { text: 'Start fresh', style: 'destructive', onPress: () => clearDraft() },
              {
                text: 'Resume', onPress: () => {
                  setDraft({
                    lat: saved.lat,
                    lng: saved.lng,
                    venue_name: saved.venue_name,
                    visited_at: saved.visited_at,
                    notes: saved.notes,
                  });
                  if (saved.lat && saved.lng) zoomToSpot(saved.lat, saved.lng, 200);
                  const resumeStep: Step = saved.step === 'compare' || saved.step === 'triage'
                    ? 'details'
                    : saved.step as Step;
                  setStep(resumeStep);
                  sheetRef.current?.snapToIndex(1);
                }
              },
            ]
          );
        }
      });

      return () => {
        // When leaving to another tab (not pushing a card), instantly reset the map
        // position so it's already at the city view when the user returns.
        if (!_mapNavigatedToDetail && cityRegionRef.current) {
          flyToRegion(cameraRef,cityRegionRef.current, 0);
        }
      };
    }, [])
  );

  useEffect(() => {
    selectedVisitRef.current = selectedVisit;
  }, [selectedVisit]);

  useEffect(() => {
    selectedFutureRef.current = selectedFuture;
  }, [selectedFuture]);

  useEffect(() => {
    if (step === null || step === 'mode-select' || step === 'location' || step === 'future-pin' || step === 'future-name' || step === 'future-details') return;
    saveDraft({ ...draft, step, savedAt: new Date().toISOString() });
  }, [step, draft]);

  useEffect(() => {
    const tabLayout = mapFilterTabLayouts.current[mapFilter];
    const textW = mapFilterTextWidths.current[mapFilter];
    if (!tabLayout || !textW) return;
    const indX = tabLayout.x + (tabLayout.width - textW) / 2;
    setMapFilterIndicatorWidth(textW);
    Animated.spring(mapFilterIndicatorX, { toValue: indX, useNativeDriver: true, damping: 22, stiffness: 280 }).start();
  }, [mapFilter]);

  const [cityRegion, setCityRegion] = useState<Region | null>(null);
  const cityRegionRef = useRef<Region | null>(null);
  useEffect(() => {
    getProfile().then(async profile => {
      let r: Region | undefined;
      if (profile.cityLat != null && profile.cityLng != null) {
        r = { latitude: profile.cityLat, longitude: profile.cityLng, latitudeDelta: 0.08, longitudeDelta: 0.08 };
      } else {
        r = CITY_REGIONS[profile.city];
      }
      // Fall back to device GPS if city isn't recognized
      if (!r) {
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            r = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 };
            // Persist coords so we don't GPS-fetch every open
            await saveProfile({ cityLat: loc.coords.latitude, cityLng: loc.coords.longitude });
          }
        } catch {}
      }
      if (r) { setRegion(r); setCityRegion(r); cityRegionRef.current = r; }
    });
  }, []);

  // Animate to city region whenever it resolves (handles race with onMapReady)
  useEffect(() => {
    if (cityRegion) flyToRegion(cameraRef,cityRegion, 0);
  }, [cityRegion]);

  function openLog() {
    setSelectedVisit(null);
    setStep('mode-select');
    sheetRef.current?.snapToIndex(1);
  }

  function resetFlow() {
    setStep(null);
    setDraft({});
    setDroppingPin(false);
    setCmpState(null);
    setCurrentTriage('okay');
    setGeocodeSuggestion(null);
    setGeocodeLoading(false);
    clearDraft();
    const saved = lastSavedLatLng.current;
    if (saved) {
      lastSavedLatLng.current = null;
      setTimeout(() => {
        flyToRegion(cameraRef,
          { latitude: saved.lat, longitude: saved.lng, latitudeDelta: 0.005, longitudeDelta: 0.005 },
          500
        );
      }, 150);
    }
  }

  function triggerStepTransition(newStep: Step, dir: 'forward' | 'back' = 'forward') {
    const startX = dir === 'forward' ? 340 : -340;
    stepAnim.stopAnimation();
    stepAnim.setValue(startX);
    setStep(newStep);
    requestAnimationFrame(() => {
      Animated.spring(stepAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 220,
        friction: 22,
      }).start();
    });
  }

  function handleFutureDropPin() {
    setDroppingPin(true);
    sheetRef.current?.snapToIndex(0);
  }


  function saveFutureSpot() {
    if (!draft.lat || !draft.lng || !draft.venue_name?.trim()) return;
    const { lat, lng } = draft;
    const newId = Crypto.randomUUID();
    insertFutureSpot({
      id: newId,
      venue_name: draft.venue_name.trim(),
      lat,
      lng,
      address: draft.address || null,
      notes: draft.notes?.trim() || undefined,
      activity_type: draft.activity_type ?? null,
      occasion_type: draft.occasion_type ?? null,
      created_at: new Date().toISOString(),
    });
    setFutureSpots(getAllFutureSpots());
    setMapFilter('want');
    setStep(null);
    setDraft({});
    sheetRef.current?.close();
    // Mirror the been-to flow: hide the new pin (scale 0), zoom the map to it, then spring
    // it in. The spring runs in parallel with the sheet/modal dismissal so the pin grows
    // into existence as the chrome clears — no empty-map gap.
    sproutAnim.setValue(0);
    setAnimatingFutureId(newId);
    setTimeout(() => {
      flyToRegion(cameraRef,
        { latitude: lat, longitude: lng, latitudeDelta: 0.005, longitudeDelta: 0.005 },
        500
      );
    }, 150);
    Animated.sequence([
      Animated.spring(sproutAnim, { toValue: 1.18, useNativeDriver: false, tension: 220, friction: 7 }),
      Animated.spring(sproutAnim, { toValue: 1.0, useNativeDriver: false, tension: 140, friction: 9 }),
    ]).start(() => {
      requestAnimationFrame(() => setAnimatingFutureId(null));
    });
  }

  async function handleUseLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { latitude, longitude } = loc.coords;
    setDraft((d) => ({ ...d, lat: latitude, lng: longitude }));
    zoomToSpot(latitude, longitude);
    setGeocodeSuggestion(null);
    setGeocodeLoading(true);
    reverseGeocode(latitude, longitude).then(name => {
      setGeocodeSuggestion(name);
      if (name) setDraft(d => ({ ...d, address: d.address || name }));
      setGeocodeLoading(false);
    });
    toModalRef.current = true;
    setStep('details');
    sheetRef.current?.close();
  }

  function zoomToSpot(lat: number, lng: number, delay = 0) {
    const go = () => flyToRegion(cameraRef,
      { latitude: lat, longitude: lng, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 400
    );
    delay > 0 ? setTimeout(go, delay) : go();
  }

  function handleSearchSelect(name: string, lat: number, lng: number, address?: string) {
    setDraft(d => ({ ...d, venue_name: name, lat, lng, address: address ?? '' }));
    zoomToSpot(lat, lng);
    toModalRef.current = true;
    setStep('details');
    sheetRef.current?.close();
  }

  function handleFutureSearchSelect(name: string, lat: number, lng: number, address?: string) {
    setDraft(d => ({ ...d, venue_name: name, lat, lng, address: address ?? '' }));
    zoomToSpot(lat, lng);
    toModalRef.current = true;
    triggerStepTransition('future-details');
    sheetRef.current?.close();
  }

  function handleDropPin() {
    setDroppingPin(true);
    sheetRef.current?.snapToIndex(0);
  }

  function handleMapPress(e: MapPressEvent) {
    if (Date.now() - lastPinPressAt.current < 300) return;
    if (!droppingPin) {
      setSelectedVisit(null);
      setSelectedFuture(null);
      setSelectedSeedSpot(null);
      return;
    }
    const [longitude, latitude] = e.nativeEvent.lngLat;
    setDraft((d) => ({ ...d, lat: latitude, lng: longitude }));
    zoomToSpot(latitude, longitude);
    setDroppingPin(false);
    setGeocodeSuggestion(null);
    setGeocodeLoading(true);
    reverseGeocode(latitude, longitude).then(name => {
      setGeocodeSuggestion(name);
      if (name) setDraft(d => ({ ...d, address: d.address || name }));
      setGeocodeLoading(false);
    });
    if (step === 'future-pin' || mapFilter === 'want') {
      toModalRef.current = true;
      triggerStepTransition('future-details');
      sheetRef.current?.close();
    } else {
      setDraft((d) => ({ ...d, isPinOnly: true }));
      toModalRef.current = true;
      setStep('details');
      sheetRef.current?.close();
    }
  }

  function handleDetailsDone() {
    if (!draft.venue_name?.trim()) {
      Alert.alert('Name required', 'What was this place called?');
      return;
    }
    if (!draft.activity_type) return;
    if (!draft.occasion_type) return;
    if (draft.occasion_type === 'other' && !draft.occasion_label?.trim()) return;
    if (draft.visited_at) {
      const iso = draft.visited_at.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (iso) {
        const picked = new Date(+iso[1], +iso[2] - 1, +iso[3]);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (picked > today) {
          Alert.alert('Future date', 'The date can\'t be in the future.');
          return;
        }
      }
    }
    triggerStepTransition('triage');
  }

  function handleTriage(triage: Triage) {
    setCurrentTriage(triage);
    const existing = getAllVisits();
    const occasion = draft.occasion_type || 'romantic';
    const initial = startComparison(existing, (v) => v.triage === triage && v.occasion_type === occasion);
    setCmpState(initial);
    triggerStepTransition('compare'); // always go to step 4; NoCompareStep handles the null case
  }

  function handleCompare(result: 'better' | 'worse') {
    if (!cmpState) return;
    const next = advance(cmpState, result);
    if (next === null) {
      const existing = getAllVisits();
      const finalLo = result === 'better' ? cmpState.lo : cmpState.mid + 1;
      const rank_order = resolveRankOrder({ ...cmpState, lo: finalLo }, existing);
      saveVisitWithTriage(rank_order, currentTriage);
    } else {
      setCmpState(next);
    }
  }

  function handleTooHard() {
    if (!cmpState) return;
    const existing = getAllVisits();
    const rank_order = resolveAtMid(cmpState, existing);
    saveVisitWithTriage(rank_order, currentTriage);
  }

  function saveVisitWithTriage(rank_order: number, triage: Triage) {
    if (!draft.lat || !draft.lng || !draft.venue_name) return;
    const newId = Crypto.randomUUID();
    insertVisit({
      id: newId,
      venue_name: draft.venue_name.trim(),
      lat: draft.lat,
      lng: draft.lng,
      address: draft.address || undefined,
      visited_at: draft.visited_at || new Date().toISOString(),
      rank_order,
      notes: draft.notes || undefined,
      activity_type: draft.activity_type || 'other',
      occasion_type: draft.occasion_type || 'romantic',
      occasion_label: draft.occasion_label || undefined,
      price: draft.price ?? null,
      triage,
      photos: draft.photos || [],
    }, undefined, draft.isPinOnly === true);
    setVisits(getAllVisits());
    // Zoom to the spot NOW, while the modal is still showing, so the map is already
    // centered by the time the user taps "Done" and the animation fires.
    zoomToSpot(draft.lat, draft.lng);
    lastSavedLatLng.current = { lat: draft.lat, lng: draft.lng };
    setMapFilter('been');
    setMapCategoryFilters([]);
    setMapPriceFilters([]);
    // Hide the new pin until its grow-in animation fires after the modal fades.
    sproutAnim.setValue(0);
    setAnimatingVisitId(newId);
    triggerStepTransition('done');
  }

  function saveVisit(rank_order: number) {
    saveVisitWithTriage(rank_order, currentTriage);
  }

  function handleDoneClose() {
    const pendingId = animatingVisitId;
    const savedLatLng = lastSavedLatLng.current;
    lastSavedLatLng.current = null;
    resetFlow();
    if (!pendingId) {
      // No visit logged — just ensure the map shows the right location if we have it.
      if (savedLatLng) {
        setTimeout(() => {
          flyToRegion(cameraRef,
            { latitude: savedLatLng.lat, longitude: savedLatLng.lng, latitudeDelta: 0.005, longitudeDelta: 0.005 },
            500
          );
        }, 150);
      }
      return;
    }
    // Map was zoomed to the spot inside saveVisitWithTriage. Kick off the marker's scale
    // animation IMMEDIATELY — it runs in parallel with the modal fade-out (~300ms), so the
    // pin is already mid-grow by the time the modal becomes transparent. No empty-map gap.
    // useNativeDriver:false + tracksViewChanges:true (on the marker) lets the native marker
    // re-snapshot each frame so the JS-driven scale renders correctly.
    sproutAnim.setValue(0);
    Animated.sequence([
      Animated.spring(sproutAnim, { toValue: 1.18, useNativeDriver: false, tension: 220, friction: 7 }),
      Animated.spring(sproutAnim, { toValue: 1.0, useNativeDriver: false, tension: 140, friction: 9 }),
    ]).start(() => {
      // Hold tracksViewChanges:true for one extra frame so the final scale=1.0 snapshot is
      // captured before we flip it off — guards against any stale snapshot at the boundary.
      requestAnimationFrame(() => setAnimatingVisitId(null));
    });
  }

  function handlePinPress(visit: Visit) {
    if (step !== null) return;
    lastPinPressAt.current = Date.now();
    setSelectedVisit((prev) => (prev?.id === visit.id ? null : visit));
  }

  const activeMapFilterCount = mapCategoryFilters.length + mapPriceFilters.length;

  const displayedSeedSpots = seedSpots
    .filter(s => mapCategoryFilters.length === 0 || mapCategoryFilters.includes(s.activity_type ?? ''))
    .filter(s => mapPriceFilters.length === 0 || mapPriceFilters.includes(s.price))
    .slice(0, activeMapFilterCount === 0 ? 100 : undefined);

  type ClusterItem =
    | { kind: 'spot'; spot: SeedSpot }
    | { kind: 'cluster'; lat: number; lng: number; count: number; key: string };

  // Quantize latitudeDelta into fixed zoom tiers so the grid never shifts while panning.
  // Cell sizes are fixed constants — not derived from the live delta.
  const zoomTier = region.latitudeDelta < 0.04 ? 'dissolved'
    : region.latitudeDelta < 0.12 ? 'close'
    : region.latitudeDelta < 0.35 ? 'mid'
    : 'far';

  const CELL_SIZES: Record<string, number> = { close: 0.018, mid: 0.05, far: 0.12 };

  const clusteredItems = useMemo<ClusterItem[]>(() => {
    if (zoomTier === 'dissolved') {
      return [...displayedSeedSpots]
        .sort((a, b) => a.rank_order - b.rank_order)
        .map(spot => ({ kind: 'spot' as const, spot }));
    }
    const cellSize = CELL_SIZES[zoomTier];
    const cells = new Map<string, SeedSpot[]>();
    for (const spot of displayedSeedSpots) {
      const row = Math.floor(spot.lat / cellSize);
      const col = Math.floor(spot.lng / cellSize);
      const key = `${row},${col}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key)!.push(spot);
    }
    const result: ClusterItem[] = [];
    for (const [key, group] of cells) {
      if (group.length >= 10) {
        const lat = group.reduce((s, g) => s + g.lat, 0) / group.length;
        const lng = group.reduce((s, g) => s + g.lng, 0) / group.length;
        result.push({ kind: 'cluster', lat, lng, count: group.length, key });
      } else {
        [...group]
          .sort((a, b) => a.rank_order - b.rank_order)
          .forEach(spot => result.push({ kind: 'spot', spot }));
      }
    }
    return result;
  }, [displayedSeedSpots, zoomTier]);


  const seedLabelSides = useMemo<Map<string, 'left' | 'right'>>(() => {
    if (mapFilter !== 'spots') return new Map();
    const spots = clusteredItems
      .filter(item => item.kind === 'spot')
      .map(item => (item as { kind: 'spot'; spot: SeedSpot }).spot);
    return assignLabelSides(spots);
  }, [clusteredItems, mapFilter]);

  const beenLabelSides = useMemo<Map<string, 'left' | 'right'>>(() => {
    if (mapFilter !== 'been') return new Map();
    return assignLabelSides(visits);
  }, [visits, mapFilter]);

  const wantLabelSides = useMemo<Map<string, 'left' | 'right'>>(() => {
    if (mapFilter !== 'want') return new Map();
    return assignLabelSides(futureSpots);
  }, [futureSpots, mapFilter]);

  const snapPoints = ['12%', '68%', '95%'];

  return (
    <TabSlideWrapper myIndex={3}>
    <View style={styles.container}>
      <MapLibreMap
        ref={mapRef}
        style={styles.map}
        mapStyle={MAP_STYLE_URL}
        logo={false}
        attribution={true}
        compass={false}
        onPress={handleMapPress as any}
        onRegionDidChange={(e: any) => {
          const b = e?.nativeEvent?.bounds;
          if (b) setRegion(boundsToRegion(b));
        }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{
            center: [SEATTLE_REGION.longitude, SEATTLE_REGION.latitude],
            zoom: latitudeDeltaToZoom(SEATTLE_REGION.latitudeDelta),
          }}
        />
        {mapFilter === 'been' && (() => {
          const filteredVisits = visits
            .filter(v => mapCategoryFilters.length === 0 || mapCategoryFilters.includes(v.activity_type))
            .filter(v => mapPriceFilters.length === 0 || mapPriceFilters.includes(v.price));
          const top3ids = new Set(
            [...filteredVisits].sort((a, b) => b.rating - a.rating).slice(0, 3).map(v => v.id)
          );
          return filteredVisits.map((v) => {
            const isSelected = selectedVisit?.id === v.id;
            const isTop3 = top3ids.has(v.id);
            const isAnimating = animatingVisitId === v.id;
            const color = ratingColor(v.rating);
            const showLabel = region.latitudeDelta < LABEL_ZOOM_THRESHOLD;
            const labelSide = beenLabelSides.get(v.id) ?? 'right';
            const inner = (
              <View pointerEvents="none" style={{ overflow: 'visible' }}>
                <View style={[styles.pinBadge, { borderColor: color }, isSelected && { backgroundColor: color }]}>
                  <Text style={[styles.pinScore, { color: isSelected ? '#fff' : color }, isTop3 && { fontWeight: '900' }]}>{formatRating(v.rating)}</Text>
                </View>
                {showLabel && <PinLabel name={v.venue_name} side={labelSide} bold={isTop3} />}
              </View>
            );
            return (
              <Marker
                key={v.id}
                id={v.id}
                lngLat={[v.lng, v.lat]}
                style={{ zIndex: isAnimating || isSelected ? 100000 : Math.round(v.rating * 100) }}
                onPress={() => handlePinPress(v)}
                anchor="center"
              >
                <Animated.View style={{ transform: [{ scale: isAnimating ? sproutAnim : 1 }] }}>
                  {inner}
                </Animated.View>
              </Marker>
            );
          });
        })()}
        {mapFilter === 'want' && (() => {
          const filtered = futureSpots
            .filter(s => mapCategoryFilters.length === 0 || mapCategoryFilters.includes(s.activity_type ?? ''));
          return filtered.map((s) => {
          const showLabel = region.latitudeDelta < LABEL_ZOOM_THRESHOLD;
          const labelSide = wantLabelSides.get(s.id) ?? 'right';
          const isSelected = selectedFuture?.id === s.id;
          const isAnimating = animatingFutureId === s.id;
          const inner = (
            <View pointerEvents="none" style={{ overflow: 'visible' }}>
              <View style={[styles.futurePinBadge, isSelected && styles.futurePinBadgeSelected]}>
                <Ionicons name={isSelected ? 'bookmark' : 'bookmark-outline'} size={11} color={isSelected ? '#fff' : '#5856d6'} />
              </View>
              {showLabel && <PinLabel name={s.venue_name} side={labelSide} />}
            </View>
          );
          return (
            <Marker
              key={s.id}
              id={s.id}
              lngLat={[s.lng, s.lat]}
              style={{ zIndex: isAnimating || isSelected ? 100000 : 1 }}
              anchor="center"
              onPress={() => {
                if (step === null) {
                  lastPinPressAt.current = Date.now();
                  setSelectedFuture((p) => p?.id === s.id ? null : s);
                }
              }}
            >
              <Animated.View style={{ transform: [{ scale: isAnimating ? sproutAnim : 1 }] }}>
                {inner}
              </Animated.View>
            </Marker>
          );
        });
        })()}
        {mapFilter === 'spots' && (() => {
          return clusteredItems.map((item) => {
            if (item.kind === 'cluster') {
              return (
                <Marker
                  key={item.key}
                  id={item.key}
                  lngLat={[item.lng, item.lat]}
                  style={{ zIndex: 0 }}
                >
                  <View style={styles.clusterBadge} pointerEvents="none">
                    <Text style={styles.clusterText}>{item.count}</Text>
                  </View>
                </Marker>
              );
            }
            const s = item.spot;
            const isSelected = selectedSeedSpot?.id === s.id;
            const pinColor = ratingColor(s.rating);
            const showLabel = region.latitudeDelta < LABEL_ZOOM_THRESHOLD;
            const labelSide = seedLabelSides.get(s.id) ?? 'right';
            return (
              <Marker
                key={s.id}
                id={s.id}
                lngLat={[s.lng, s.lat]}
                style={{ zIndex: isSelected ? 100000 : Math.round(s.rating * 100) }}
                onPress={() => {
                  if (step === null) {
                    lastPinPressAt.current = Date.now();
                    setSelectedSeedSpot(p => p?.id === s.id ? null : s);
                  }
                }}
                anchor="center"
              >
                <View pointerEvents="none" style={{ overflow: 'visible' }}>
                  <View style={[styles.seedPinBadge, { borderColor: pinColor }, isSelected && { backgroundColor: pinColor }]}>
                    <Text style={[styles.seedPinScore, { color: isSelected ? '#fff' : pinColor }]}>{formatRating(s.rating)}</Text>
                  </View>
                  {showLabel && <PinLabel name={s.venue_name} side={labelSide} />}
                </View>
              </Marker>
            );
          });
        })()}
      </MapLibreMap>

      {/* Filter toggle */}
      {step === null && (
        <View style={styles.filterRow} pointerEvents="box-none">
          <View pointerEvents="auto" style={styles.filterTabBar}>
            {([
              { label: 'Been To', value: 'been' },
              { label: 'Want to Go', value: 'want' },
              { label: 'Top Spots', value: 'spots' },
            ] as const).map(opt => (
              <Pressable
                key={opt.value}
                style={styles.filterTab}
                onPress={() => {
                  setMapFilter(opt.value);
                  setSelectedFuture(null);
                  setSelectedVisit(null);
                  setSelectedSeedSpot(null);
                }}
                onLayout={e => {
                  const { x, width } = e.nativeEvent.layout;
                  mapFilterTabLayouts.current[opt.value] = { x, width };
                  const textW = mapFilterTextWidths.current[opt.value];
                  if (opt.value === mapFilter && textW) {
                    const indX = x + (width - textW) / 2;
                    mapFilterIndicatorX.setValue(indX);
                    setMapFilterIndicatorWidth(textW);
                  }
                }}
              >
                <Text
                  style={[styles.filterTabText, mapFilter === opt.value && styles.filterTabTextActive]}
                  onLayout={e => {
                    const textW = e.nativeEvent.layout.width;
                    mapFilterTextWidths.current[opt.value] = textW;
                    const tabLayout = mapFilterTabLayouts.current[opt.value];
                    if (opt.value === mapFilter && tabLayout) {
                      const indX = tabLayout.x + (tabLayout.width - textW) / 2;
                      mapFilterIndicatorX.setValue(indX);
                      setMapFilterIndicatorWidth(textW);
                    }
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
            {mapFilterIndicatorWidth > 0 && (
              <Animated.View style={[styles.filterTabUnderline, { width: mapFilterIndicatorWidth, transform: [{ translateX: mapFilterIndicatorX }] }]} />
            )}
          </View>
          <View pointerEvents="auto" style={styles.filterBtnRow}>
            <View style={[styles.mapFilterBtn, activeMapFilterCount > 0 && styles.mapFilterBtnActive]}>
              <Pressable style={styles.mapFilterBtnMain} onPress={() => setShowMapFilter(true)}>
                <Ionicons name="options-outline" size={14} color={activeMapFilterCount > 0 ? T.accent : T.primary} />
                <Text style={[styles.mapFilterBtnText, activeMapFilterCount > 0 && styles.mapFilterBtnTextActive]}>Filter</Text>
              </Pressable>
              {activeMapFilterCount > 0 && (
                <>
                  <View style={styles.mapFilterBtnDivider} />
                  <Pressable
                    style={styles.mapFilterClearBtn}
                    onPress={() => { setMapCategoryFilters([]); setMapPriceFilters([]); }}
                    hitSlop={6}
                  >
                    <Ionicons name="close" size={14} color={T.accent} />
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </View>
      )}

      {droppingPin && (
        <View style={styles.pinHint} pointerEvents="none">
          <Text style={styles.pinHintText}>Tap the map to drop a pin</Text>
        </View>
      )}

      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={() => {
          if (toModalRef.current) { toModalRef.current = false; return; }
          resetFlow();
        }}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={{ backgroundColor: 'transparent' }}
        keyboardBehavior="interactive"
        keyboardBlursBehavior="restore"
      >
        <BottomSheetView style={styles.sheetContent}>
          {step === 'mode-select' && (
            <ModeSelectStep
              onBeenTo={() => setStep('location')}
              onWantToGo={() => { setMapFilter('want'); setStep('future-pin'); }}
              onCreateStack={() => {
                scheduleNewStack();
                resetFlow();
                sheetRef.current?.close();
                router.push('/(tabs)/lists?tab=been' as any);
              }}
            />
          )}
          {step === 'location' && (
            <LocationStep
              onDropPin={handleDropPin}
              onSelect={handleSearchSelect}
              onBack={() => setStep('mode-select')}
              region={region}
            />
          )}
          {step === 'future-pin' && (
            <FuturePinStep
              onDropPin={handleFutureDropPin}
              onBack={() => { setMapFilter('been'); setStep('mode-select'); }}
              onSelect={handleFutureSearchSelect}
              region={region}
            />
          )}
          {step === 'future-name' && (
            <FutureNameStep
              value={draft.venue_name || ''}
              onChange={(v) => setDraft((d) => ({ ...d, venue_name: v }))}
              onSave={saveFutureSpot}
              onBack={() => { setStep('future-pin'); sheetRef.current?.snapToIndex(1); }}
              suggestion={geocodeSuggestion}
              geocodeLoading={geocodeLoading}
              onDismissSuggestion={() => setGeocodeSuggestion(null)}
            />
          )}
        </BottomSheetView>
      </BottomSheet>

      {/* Modal overlay for steps 2-5 */}
      <Modal
        visible={['details', 'triage', 'compare', 'done', 'future-details'].includes(step ?? '')}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalOverlay}>
            {step === 'future-details' ? (
              <View style={[styles.modalCard, { height: undefined }]}>
                <Animated.View style={{ transform: [{ translateX: stepAnim }] }}>
                  <FutureDetailsStep
                    draft={draft}
                    onChange={(key, val) => setDraft((d) => ({ ...d, [key]: val }))}
                    onSave={saveFutureSpot}
                    onBack={() => { setStep('future-pin'); sheetRef.current?.snapToIndex(1); }}
                    geocodeLoading={geocodeLoading}
                    suggestion={geocodeSuggestion}
                  />
                </Animated.View>
              </View>
            ) : step === 'details' ? (
              <View style={styles.modalCard}>
                <Animated.View style={[{ flex: 1 }, { transform: [{ translateX: stepAnim }] }]}>
                  <DetailsStep
                    draft={draft}
                    onChange={(key, val) => setDraft((d) => ({ ...d, [key]: val }))}
                    onNext={handleDetailsDone}
                    onBack={resetFlow}
                    suggestion={geocodeSuggestion}
                    geocodeLoading={geocodeLoading}
                  />
                </Animated.View>
              </View>
            ) : (
              <View style={styles.modalCardCompact}>
                <Animated.View style={{ transform: [{ translateX: stepAnim }] }}>
                  {step === 'triage' && (
                    <TriageStep onPick={handleTriage} />
                  )}
                  {step === 'compare' && !cmpState && (
                    <NoCompareStep
                      triage={currentTriage}
                      activityLabel={OCCASION_TYPES.find(a => a.value === (draft.occasion_type || 'romantic'))?.label ?? 'Romantic'}
                      onSave={() => saveVisitWithTriage(1000, currentTriage)}
                    />
                  )}
                  {step === 'compare' && cmpState && (
                    <CompareStep
                      newVenueName={draft.venue_name || ''}
                      newVenueAddress={draft.address || ''}
                      newActivityType={draft.activity_type || 'other'}
                      opponent={currentComparison(cmpState)}
                      onBetter={() => handleCompare('better')}
                      onWorse={() => handleCompare('worse')}
                      onTooHard={handleTooHard}
                      onBack={() => triggerStepTransition('triage', 'back')}
                    />
                  )}
                  {step === 'done' && (
                    <DoneStep
                      venueName={draft.venue_name || ''}
                      onAnother={() => { handleDoneClose(); openLog(); }}
                      onClose={handleDoneClose}
                    />
                  )}
                </Animated.View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Banners render last so they sit above the BottomSheet gesture layer */}
      {selectedVisit && step === null && mapFilter === 'been' && (
        <VisitDetail visit={selectedVisit} onClose={() => setSelectedVisit(null)} />
      )}
      {selectedFuture && step === null && mapFilter === 'want' && (
        <FutureDetail
          spot={selectedFuture}
          onClose={() => setSelectedFuture(null)}
          onDelete={() => {
            deleteFutureSpot(selectedFuture.id);
            setFutureSpots(getAllFutureSpots());
            setSelectedFuture(null);
          }}
        />
      )}
      {selectedSeedSpot && step === null && mapFilter === 'spots' && (
        <SeedSpotDetail
          spot={selectedSeedSpot}
          onClose={() => setSelectedSeedSpot(null)}
          onSaved={() => setFutureSpots(getAllFutureSpots())}
        />
      )}
      <MapFilterSheet
        visible={showMapFilter}
        currentCategory={mapCategoryFilters}
        currentPrice={mapPriceFilters}
        onApply={(category, price) => {
          setMapCategoryFilters(category);
          setMapPriceFilters(price);
        }}
        onClose={() => setShowMapFilter(false)}
      />

    </View>
    </TabSlideWrapper>
  );
}

function MapFilterSheet({ visible, currentCategory, currentPrice, onApply, onClose }: {
  visible: boolean;
  currentCategory: string[];
  currentPrice: number[];
  onApply: (category: string[], price: number[]) => void;
  onClose: () => void;
}) {
  const [draftCategory, setDraftCategory] = useState<string[]>(currentCategory);
  const [draftPrice, setDraftPrice] = useState<number[]>(currentPrice);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['category']));

  useEffect(() => {
    if (visible) {
      setDraftCategory(currentCategory);
      setDraftPrice(currentPrice);
    }
  }, [visible]);

  function toggleArr<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  }

  function toggleSection(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={mfs.root} edges={['top', 'bottom']}>
        <View style={mfs.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={T.primary} />
          </Pressable>
          <Text style={mfs.title}>Filter</Text>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView style={mfs.scroll} contentContainerStyle={mfs.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Category accordion */}
          <Pressable style={mfs.accordionHeader} onPress={() => toggleSection('category')}>
            <Ionicons name="restaurant-outline" size={18} color={T.primary} />
            <Text style={mfs.accordionLabel}>Category</Text>
            <View style={[mfs.activeBadge, draftCategory.length === 0 && { opacity: 0 }]}>
              <Text style={mfs.activeBadgeText}>{draftCategory.length}</Text>
            </View>
            <Ionicons name={expanded.has('category') ? 'chevron-up' : 'chevron-down'} size={16} color={T.muted} />
          </Pressable>
          {expanded.has('category') && (
            <View style={mfs.chipGrid}>
              {SEED_VENUE_TYPES.map(a => {
                const sel = draftCategory.includes(a.value);
                return (
                  <Pressable key={a.value} style={[mfs.chip, sel && mfs.chipActive]} onPress={() => setDraftCategory(toggleArr(draftCategory, a.value))}>
                    <Text style={[mfs.chipText, sel && mfs.chipTextActive]}>{a.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={mfs.divider} />

          {/* Price accordion */}
          <Pressable style={mfs.accordionHeader} onPress={() => toggleSection('price')}>
            <Ionicons name="cash-outline" size={18} color={T.primary} />
            <Text style={mfs.accordionLabel}>Price</Text>
            <View style={[mfs.activeBadge, draftPrice.length === 0 && { opacity: 0 }]}>
              <Text style={mfs.activeBadgeText}>{draftPrice.length}</Text>
            </View>
            <Ionicons name={expanded.has('price') ? 'chevron-up' : 'chevron-down'} size={16} color={T.muted} />
          </Pressable>
          {expanded.has('price') && (
            <View style={mfs.chipGrid}>
              {PRICE_FILTER_OPTIONS.map(p => {
                const sel = draftPrice.includes(p.value);
                return (
                  <Pressable key={p.value} style={[mfs.chip, sel && mfs.chipActive]} onPress={() => setDraftPrice(toggleArr(draftPrice, p.value))}>
                    <Text style={[mfs.chipText, sel && mfs.chipTextActive]}>{p.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </ScrollView>

        <View style={mfs.footer}>
          <Pressable onPress={() => { onApply([], []); onClose(); }}>
            <Text style={mfs.clearAll}>Clear all</Text>
          </Pressable>
          <Pressable style={mfs.applyBtn} onPress={() => { onApply(draftCategory, draftPrice); onClose(); }}>
            <Text style={mfs.applyBtnText}>Apply</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function VisitDetail({ visit, onClose }: { visit: Visit; onClose: () => void }) {
  const info = ACTIVITY_TYPES.find((a) => a.value === visit.activity_type);
  const color = ratingColor(visit.rating);
  const dateStr = friendlyDate(visit.visited_at || visit.created_at);
  const preview = visit.notes?.trim().slice(0, 70) ?? null;
  return (
    <Pressable style={styles.visitBanner} onPress={() => { _mapNavigatedToDetail = true; router.push(`/spot/${visit.id}` as any); }}>
      <View style={styles.visitBannerInner}>
        <View style={styles.visitBannerBody}>
          <View style={styles.visitBannerTop}>
            <Text style={styles.visitBannerName} numberOfLines={1}>{visit.venue_name}</Text>
            <View style={[styles.visitBannerPill, { borderColor: color }]}>
              <Text style={[styles.visitBannerPillText, { color }]}>{formatRating(visit.rating)}</Text>
            </View>
          </View>
          <Text style={styles.visitBannerMeta}>
            {[info?.label, visit.price != null ? PRICE_LABELS[visit.price] : null, dateStr].filter(Boolean).join(' · ')}
          </Text>
          {preview ? (
            <Text style={styles.visitBannerPreview} numberOfLines={1}>{preview}</Text>
          ) : null}
        </View>
        <Pressable onPress={(e) => { e.stopPropagation?.(); onClose(); }} hitSlop={12} style={styles.visitBannerClose}>
          <Ionicons name="close" size={18} color={T.muted} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function SeedSpotDetail({ spot, onClose, onSaved }: { spot: SeedSpot; onClose: () => void; onSaved: () => void }) {
  const info = SEED_VENUE_TYPES.find(a => a.value === spot.activity_type);
  const preview = spot.notes?.trim().slice(0, 70) ?? null;
  const [savedFutureId, setSavedFutureId] = useState<string | null>(() => {
    const existing = getAllFutureSpots().find(
      f => f.venue_name === spot.venue_name && Math.abs(f.lat - spot.lat) < 0.001
    );
    return existing?.id ?? null;
  });
  const [alreadyLogged, setAlreadyLogged] = useState(() =>
    getAllVisits().some(v => v.venue_name.toLowerCase().trim() === spot.venue_name.toLowerCase().trim())
  );
  const toastAnimRef = useRef(new Animated.Value(0));
  const toastAnim = toastAnimRef.current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const existing = getAllFutureSpots().find(
      f => f.venue_name === spot.venue_name && Math.abs(f.lat - spot.lat) < 0.001
    );
    setSavedFutureId(existing?.id ?? null);
    setAlreadyLogged(getAllVisits().some(v => v.venue_name.toLowerCase().trim() === spot.venue_name.toLowerCase().trim()));
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastAnim.setValue(0);
  }, [spot.id]);

  function showSavedToast() {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }, 1500);
  }

  function handleLog() {
    scheduleOpenLogWithLocation(spot.venue_name, spot.lat, spot.lng, spot.activity_type);
    onClose();
  }

  function toggleSave() {
    if (savedFutureId) {
      deleteFutureSpot(savedFutureId);
      setSavedFutureId(null);
      onSaved();
    } else {
      const newId = Crypto.randomUUID();
      insertFutureSpot({ id: newId, venue_name: spot.venue_name, lat: spot.lat, lng: spot.lng, address: spot.address ?? null, activity_type: spot.activity_type ?? null, created_at: new Date().toISOString() });
      setSavedFutureId(newId);
      onSaved();
      showSavedToast();
    }
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[styles.savedToast, {
          opacity: toastAnim,
          transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
        }]}
        pointerEvents="none"
      >
        <Ionicons name="bookmark" size={13} color="#5856d6" />
        <Text style={styles.savedToastText}>Saved!</Text>
      </Animated.View>
      <Pressable style={styles.visitBanner} onPress={() => { _mapNavigatedToDetail = true; router.push(`/spot/${spot.id}` as any); }}>
        <View style={styles.visitBannerInner}>
          <View style={styles.visitBannerBody}>
            <View style={styles.visitBannerTop}>
              <Text style={styles.visitBannerName} numberOfLines={1}>{spot.venue_name}</Text>
              <View style={[styles.visitBannerPill, { borderColor: ratingColor(spot.rating) }]}>
                <Text style={[styles.visitBannerPillText, { color: ratingColor(spot.rating) }]}>{formatRating(spot.rating)}</Text>
              </View>
            </View>
            <Text style={styles.visitBannerMeta}>
              {[info?.label ?? 'Other', spot.price != null ? PRICE_LABELS[spot.price as Price] : null].filter(Boolean).join(' · ')}
            </Text>
            {preview ? (
              <Text style={styles.visitBannerPreview} numberOfLines={1}>{preview}</Text>
            ) : null}
          </View>
          <View style={styles.visitBannerActions}>
            <View style={styles.visitBannerActionGroup}>
              <Pressable
                onPress={(e) => { e.stopPropagation?.(); alreadyLogged ? undefined : handleLog(); }}
                hitSlop={8}
                style={[styles.visitBannerActionBtn, alreadyLogged && { backgroundColor: T.accent }]}
                disabled={alreadyLogged}
              >
                <Ionicons name={alreadyLogged ? 'checkmark' : 'add'} size={20} color={alreadyLogged ? '#fff' : T.accent} />
              </Pressable>
              <Pressable onPress={(e) => { e.stopPropagation?.(); toggleSave(); }} hitSlop={8} style={styles.visitBannerActionBtn}>
                <Ionicons name={savedFutureId ? 'bookmark' : 'bookmark-outline'} size={17} color="#5856d6" />
              </Pressable>
            </View>
            <Pressable onPress={(e) => { e.stopPropagation?.(); onClose(); }} hitSlop={12} style={styles.visitBannerClose}>
              <Ionicons name="close" size={18} color={T.muted} />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

function ProgressDots({ currentStep }: { currentStep: number }) {
  return (
    <View style={styles.dotsRow}>
      {[1, 2, 3, 4, 5].map(i => (
        <View
          key={i}
          style={[
            styles.dot,
            i === currentStep && styles.dotActive,
            i < currentStep && styles.dotDone,
          ]}
        />
      ))}
    </View>
  );
}

function useGeocodeSearch(fallbackRegion: Region) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    // Bias to the home city region (set from profile). Never use device GPS here —
    // GPS can override the user's chosen city when on a simulator or traveling.
    const lat = fallbackRegion.latitude;
    const lng = fallbackRegion.longitude;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(geocodeSearchUrl(query, lng, lat));
        const data = await res.json();
        const features: GeocodeFeature[] = data.features ?? [];
        const mapped: SearchResult[] = features
          .filter(f => f.center)
          .map(f => ({
            id: f.id,
            name: f.text || f.place_name?.split(',')[0] || '',
            address: featureAddress(f),
            lng: f.center![0],
            lat: f.center![1],
          }));
        if (!cancelled) setResults(mapped);
      } catch { if (!cancelled) setResults([]); }
      if (!cancelled) setLoading(false);
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  return { query, setQuery, results, loading };
}

function SearchResultsList({ results, loading, query, onSelect }: {
  results: SearchResult[];
  loading: boolean;
  query: string;
  onSelect: (name: string, lat: number, lng: number, address: string) => void;
}) {
  return (
    <ScrollView style={styles.searchResults} keyboardShouldPersistTaps="handled">
      {loading && (
        <View style={styles.searchLoadingRow}>
          <ActivityIndicator size="small" color="#A0927E" />
          <Text style={[styles.searchMsg, { paddingVertical: 0 }]}>Searching…</Text>
        </View>
      )}
      {!loading && query.length >= 2 && results.length === 0 && (
        <Text style={styles.searchMsg}>No results found nearby</Text>
      )}
      {results.map(r => (
        <Pressable
          key={r.id}
          style={styles.searchResult}
          onPress={() => onSelect(r.name, r.lat, r.lng, r.address)}
        >
          <Ionicons name="location-outline" size={16} color={T.muted} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.searchResultName} numberOfLines={1}>{r.name}</Text>
            {r.address ? <Text style={styles.searchResultAddr} numberOfLines={1}>{r.address}</Text> : null}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function ModeSelectStep({ onBeenTo, onWantToGo, onCreateStack }: {
  onBeenTo: () => void;
  onWantToGo: () => void;
  onCreateStack: () => void;
}) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What are you logging?</Text>
      <Text style={styles.stepSubtitle}>Choose one to get started</Text>
      <View style={{ gap: 12, marginTop: 8 }}>
        <Pressable
          style={({ pressed }) => [styles.modeCard, { opacity: pressed ? 0.85 : 1 }]}
          onPress={onBeenTo}
        >
          <Ionicons name="checkmark-circle" size={28} color={T.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.modeCardTitle}>Been To</Text>
            <Text style={styles.modeCardSub}>Log a place you've visited</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={T.muted} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.modeCard, { opacity: pressed ? 0.85 : 1 }]}
          onPress={onWantToGo}
        >
          <Ionicons name="bookmark" size={28} color="#5856d6" />
          <View style={{ flex: 1 }}>
            <Text style={styles.modeCardTitle}>Want to Go</Text>
            <Text style={styles.modeCardSub}>Save a place for later</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={T.muted} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.modeCard, { opacity: pressed ? 0.85 : 1 }]}
          onPress={onCreateStack}
        >
          <Ionicons name="layers-outline" size={28} color="#FF9F0A" />
          <View style={{ flex: 1 }}>
            <Text style={styles.modeCardTitle}>Create a Stack</Text>
            <Text style={styles.modeCardSub}>Group spots into a date night story</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={T.muted} />
        </Pressable>
      </View>
    </View>
  );
}

function LocationStep({ onDropPin, onSelect, onBack, region }: {
  onDropPin: () => void;
  onSelect: (name: string, lat: number, lng: number, address: string) => void;
  onBack: () => void;
  region: Region;
}) {
  const { query, setQuery, results, loading } = useGeocodeSearch(region);
  return (
    <View style={[styles.stepContainer, { position: 'relative' }]}>
      <Pressable onPress={onBack} style={styles.cardBackBtn}>
        <Text style={styles.cardBackBtnText}>Back</Text>
      </Pressable>
      <ProgressDots currentStep={1} />
      <Text style={styles.stepTitle}>Where did you go?</Text>
      <Text style={styles.stepSubtitle}>Search by name, address, or neighborhood</Text>
      <TextInput
        style={[styles.input, { marginBottom: 4 }]}
        placeholder="Search for a place…"
        placeholderTextColor="#c7c7cc"
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoFocus
      />
      <SearchResultsList results={results} loading={loading} query={query} onSelect={onSelect} />
      <View style={styles.orDivider}>
        <View style={styles.orLine} />
        <Text style={styles.orText}>or</Text>
        <View style={styles.orLine} />
      </View>
      <Pressable onPress={onDropPin} style={styles.pinDropBtn}>
        <Ionicons name="location-outline" size={18} color={T.accent} />
        <Text style={styles.pinDropBtnText}>Drop a pin on the map</Text>
      </Pressable>
    </View>
  );
}

function FutureDetailsStep({ draft, onChange, onSave, onBack, geocodeLoading, suggestion }: {
  draft: Partial<DraftVisit>;
  onChange: (key: string, val: any) => void;
  onSave: () => void;
  onBack: () => void;
  geocodeLoading: boolean;
  suggestion: string | null;
}) {
  const autofilled = useRef(false);
  useEffect(() => {
    if (suggestion && !draft.venue_name && !autofilled.current) {
      autofilled.current = true;
      onChange('venue_name', suggestion);
    }
  }, [suggestion]);

  useEffect(() => {
    if (!draft.occasion_type) onChange('occasion_type', 'romantic');
  }, []);

  const disabled = !draft.venue_name?.trim() || !draft.activity_type || (draft.occasion_type === 'other' && !draft.occasion_label?.trim());

  return (
    <View>
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Save for later</Text>
        <Text style={styles.stepSubtitle}>{geocodeLoading && !draft.venue_name ? 'Looking up location…' : 'Where do you want to go?'}</Text>
        <TextInput
          style={[styles.input, { marginBottom: 16 }]}
          value={draft.venue_name || ''}
          onChangeText={(v) => onChange('venue_name', v)}
          placeholder={geocodeLoading ? 'Looking up the spot…' : 'Name this spot'}
          placeholderTextColor={T.placeholder}
          returnKeyType="done"
        />

        <View style={{ marginBottom: 18 }}>
          <Text style={styles.detailsSectionLabel}>What kind of date? <Text style={{ color: T.accent }}>*</Text></Text>
          <SlidingSegControl
            options={OCCASION_TYPES}
            value={draft.occasion_type || 'romantic'}
            onChange={(v) => { onChange('occasion_type', v); if (v !== 'other') onChange('occasion_label', ''); }}
          />
          {draft.occasion_type === 'other' && (
            <TextInput
              style={[styles.input, { marginTop: 10, marginBottom: 0 }]}
              value={draft.occasion_label || ''}
              onChangeText={(v) => onChange('occasion_label', v)}
              placeholder="Describe the occasion… *"
              placeholderTextColor={T.placeholder}
              returnKeyType="done"
              autoFocus
            />
          )}
        </View>

        <View style={{ marginBottom: 0 }}>
          <Text style={styles.detailsSectionLabel}>Category <Text style={{ color: T.accent }}>*</Text></Text>
          <View style={styles.chipWrap}>
            {ACTIVITY_TYPES.map((a) => {
              const selected = draft.activity_type === a.value;
              return (
                <Pressable
                  key={a.value}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => onChange('activity_type', selected ? null : a.value)}
                >
                  <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{a.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.detailsFooter}>
        <Pressable
          style={[styles.detailsContinueBtn, disabled && { opacity: 0.4 }]}
          onPress={onSave}
          disabled={disabled}
        >
          <Text style={styles.detailsContinueBtnText}>Save</Text>
        </Pressable>
        <Pressable style={{ alignItems: 'center', marginTop: 12 }} onPress={onBack}>
          <Text style={{ fontSize: 13, color: T.muted }}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FuturePinStep({ onDropPin, onBack, onSelect, region }: {
  onDropPin: () => void; onBack: () => void;
  onSelect: (name: string, lat: number, lng: number, address: string) => void;
  region: Region;
}) {
  const { query, setQuery, results, loading } = useGeocodeSearch(region);
  return (
    <View style={[styles.stepContainer, { position: 'relative' }]}>
      <Pressable onPress={onBack} style={styles.cardBackBtn}>
        <Text style={styles.cardBackBtnText}>Back</Text>
      </Pressable>
      <Text style={styles.stepTitle}>Where do you want to go?</Text>
      <Text style={styles.stepSubtitle}>Search by name, address, or neighborhood</Text>
      <TextInput
        style={[styles.input, { marginBottom: 4 }]}
        placeholder="Search for a place…"
        placeholderTextColor="#c7c7cc"
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoFocus
      />
      <SearchResultsList results={results} loading={loading} query={query} onSelect={onSelect} />
      <View style={styles.orDivider}>
        <View style={styles.orLine} />
        <Text style={styles.orText}>or</Text>
        <View style={styles.orLine} />
      </View>
      <Pressable onPress={onDropPin} style={styles.pinDropBtn}>
        <Ionicons name="location-outline" size={18} color={T.accent} />
        <Text style={styles.pinDropBtnText}>Drop a pin on the map</Text>
      </Pressable>
    </View>
  );
}

function FutureNameStep({ value, onChange, onSave, onBack, suggestion, geocodeLoading, onDismissSuggestion }: {
  value: string; onChange: (v: string) => void; onSave: () => void; onBack: () => void;
  suggestion: string | null; geocodeLoading: boolean; onDismissSuggestion: () => void;
}) {
  const showConfirm = !!suggestion && !value;
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>What's it called?</Text>
      {showConfirm ? (
        <View style={styles.suggestionCard}>
          <Text style={styles.suggestionPrompt}>Is this right?</Text>
          <Text style={styles.suggestionName}>{suggestion}</Text>
          <View style={styles.btnRow}>
            <Pressable style={styles.btnSecondary} onPress={onDismissSuggestion}>
              <Text style={styles.btnSecondaryText}>No</Text>
            </Pressable>
            <Pressable style={styles.btnPrimary} onPress={() => { onChange(suggestion); setTimeout(onSave, 0); }}>
              <Text style={styles.btnPrimaryText}>Yes, that's it</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <Text style={styles.stepSubtitle}>
            {geocodeLoading && !value ? 'Looking up the spot…' : 'Give it a name to remember'}
          </Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Lazy Bear"
            placeholderTextColor="#c7c7cc"
            value={value}
            onChangeText={onChange}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={onSave}
          />
          <View style={styles.btnRow}>
            <Pressable style={styles.btnSecondary} onPress={onBack}>
              <Text style={styles.btnSecondaryText}>Back</Text>
            </Pressable>
            <Pressable style={styles.btnPrimary} onPress={onSave}>
              <Text style={styles.btnPrimaryText}>Save</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

function FutureDetail({ spot, onClose, onDelete }: {
  spot: FutureSpot; onClose: () => void; onDelete: () => void;
}) {
  function handleLog() {
    scheduleOpenLogWithLocation(spot.venue_name, spot.lat, spot.lng, spot.activity_type, spot.occasion_type);
    onClose();
  }

  return (
    <Pressable style={styles.visitBanner} onPress={() => { _mapNavigatedToDetail = true; router.push(`/future/${spot.id}` as any); }}>
      <View style={styles.visitBannerInner}>
        <View style={styles.visitBannerBody}>
          <View style={styles.visitBannerTop}>
            <Text style={styles.visitBannerName} numberOfLines={1}>{spot.venue_name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="bookmark" size={12} color="#5856d6" />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#5856d6' }}>Want to go</Text>
            </View>
          </View>
          <Text style={styles.visitBannerMeta}>Added {friendlyDate(spot.created_at)}</Text>
        </View>
        <View style={styles.visitBannerActions}>
          <Pressable onPress={(e) => { e.stopPropagation?.(); handleLog(); }} hitSlop={8} style={styles.visitBannerActionBtn}>
            <Ionicons name="add" size={20} color={T.accent} />
          </Pressable>
          <Pressable onPress={(e) => { e.stopPropagation?.(); onClose(); }} hitSlop={12} style={styles.visitBannerClose}>
            <Ionicons name="close" size={18} color={T.muted} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

function CircleButton({ icon, label, sublabel, onPress, tint }: {
  icon: string; label: string; sublabel: string; onPress: () => void; tint: string;
}) {
  return (
    <Pressable style={styles.circleBtn} onPress={onPress}>
      <View style={[styles.circle, { backgroundColor: tint }]}>
        <Ionicons name={icon as any} size={28} color="#1c1c1e" />
      </View>
      <Text style={styles.circleBtnLabel}>{label}</Text>
      <Text style={styles.circleBtnSub}>{sublabel}</Text>
    </Pressable>
  );
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CAL_DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function CalendarPicker({ value, onChange }: {
  value: string;
  onChange: (date: string) => void;
}) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const parseDate = (s: string) => {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    return null;
  };

  const selectedDate = value ? parseDate(value) : null;
  const initDisplay = selectedDate || today;

  const [displayYear, setDisplayYear] = useState(initDisplay.getFullYear());
  const [displayMonth, setDisplayMonth] = useState(initDisplay.getMonth());

  const isCurrentMonth = displayYear === today.getFullYear() && displayMonth === today.getMonth();

  function prevMonth() {
    if (displayMonth === 0) { setDisplayMonth(11); setDisplayYear(y => y - 1); }
    else { setDisplayMonth(m => m - 1); }
  }

  function nextMonth() {
    if (isCurrentMonth) return;
    if (displayMonth === 11) { setDisplayMonth(0); setDisplayYear(y => y + 1); }
    else { setDisplayMonth(m => m + 1); }
  }

  function selectDay(day: number) {
    const d = new Date(displayYear, displayMonth, day);
    if (d > today) return;
    const mo = String(displayMonth + 1).padStart(2, '0');
    const da = String(day).padStart(2, '0');
    onChange(`${displayYear}-${mo}-${da}`);
  }

  const firstDayOfWeek = new Date(displayYear, displayMonth, 1).getDay();
  const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length < 42) cells.push(null);

  return (
    <View style={styles.calendarContainer}>
      <View style={styles.calendarHeader}>
        <Pressable onPress={prevMonth} hitSlop={12} style={styles.calendarNavBtn}>
          <Ionicons name="chevron-back" size={20} color={T.primary} />
        </Pressable>
        <Text style={styles.calendarMonthTitle}>{MONTHS[displayMonth]} {displayYear}</Text>
        <Pressable onPress={nextMonth} hitSlop={12} style={styles.calendarNavBtn}>
          <Ionicons name="chevron-forward" size={20} color={isCurrentMonth ? T.border : T.primary} />
        </Pressable>
      </View>
      <View style={styles.calendarDayHeaders}>
        {CAL_DAY_HEADERS.map((h, i) => (
          <Text key={i} style={styles.calendarDayHeader}>{h}</Text>
        ))}
      </View>
      <View style={styles.calendarGrid}>
        {cells.map((day, i) => {
          if (!day) return <View key={`e${i}`} style={styles.calendarCell} />;
          const cellDate = new Date(displayYear, displayMonth, day);
          const isFuture = cellDate > today;
          const isSelected = !!(selectedDate &&
            selectedDate.getFullYear() === displayYear &&
            selectedDate.getMonth() === displayMonth &&
            selectedDate.getDate() === day);
          const isTodayCell = today.getFullYear() === displayYear &&
            today.getMonth() === displayMonth &&
            today.getDate() === day;
          return (
            <Pressable
              key={day}
              style={styles.calendarCell}
              onPress={() => !isFuture && selectDay(day)}
              disabled={isFuture}
            >
              <View style={[styles.calendarCellInner, isSelected && styles.calendarCellSelected]}>
                <Text style={[
                  styles.calendarCellText,
                  isFuture && styles.calendarCellTextFuture,
                  isSelected && styles.calendarCellTextSelected,
                ]}>
                  {day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SlidingSegControl({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const n = options.length;
  const [trackWidth, setTrackWidth] = useState(0);
  const animIdx = useRef(new Animated.Value(Math.max(0, options.findIndex(o => o.value === value)))).current;

  useEffect(() => {
    const idx = Math.max(0, options.findIndex(o => o.value === value));
    Animated.timing(animIdx, {
      toValue: idx,
      duration: 260,
      useNativeDriver: true,
      easing: Easing.bezier(0.22, 0.9, 0.3, 1),
    }).start();
  }, [value]);

  const segWidth = trackWidth > 0 ? (trackWidth - 10) / n : 0;
  const translateX = animIdx.interpolate({
    inputRange: options.map((_, i) => i),
    outputRange: options.map((_, i) => i * segWidth),
  });

  return (
    <View
      style={styles.segTrack}
      onLayout={e => {
        const w = e.nativeEvent.layout.width;
        if (w !== trackWidth) setTrackWidth(w);
      }}
    >
      {trackWidth > 0 && (
        <Animated.View style={[styles.segPill, { width: segWidth, transform: [{ translateX }] }]} />
      )}
      {options.map((opt) => (
        <Pressable key={opt.value} onPress={() => onChange(opt.value)} style={styles.segOption}>
          <Text style={[styles.segOptionText, opt.value === value && styles.segOptionTextSelected]}>
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function PickerRow({
  iconName,
  label,
  displayValue,
  open,
  onToggle,
  last,
  children,
}: {
  iconName: string;
  label: string;
  displayValue: string | null;
  open: boolean;
  onToggle: () => void;
  last?: boolean;
  children: React.ReactNode;
}) {
  const anim = useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [open]);

  const maxHeight = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 400] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const chevronRotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });

  return (
    <View style={last ? undefined : styles.pickerRowDivider}>
      <Pressable onPress={onToggle} style={styles.pickerRowHeader}>
        <View style={styles.pickerRowIconSlot}>
          <Ionicons name={iconName as any} size={18} color={open ? T.accent : T.muted} />
        </View>
        <Text style={styles.pickerRowLabel}>{label}</Text>
        {displayValue
          ? <Text style={styles.pickerRowValue}>{displayValue}</Text>
          : <Text style={styles.pickerRowAdd}>Add</Text>
        }
        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <Ionicons name="chevron-forward" size={16} color={T.placeholder} />
        </Animated.View>
      </Pressable>
      <Animated.View style={{ maxHeight, overflow: 'hidden', opacity }}>
        <View style={styles.pickerRowBody}>{children}</View>
      </Animated.View>
    </View>
  );
}

function DetailsStep({ draft, onChange, onNext, onBack, suggestion, geocodeLoading }: {
  draft: Partial<DraftVisit>;
  onChange: (key: string, val: any) => void;
  onNext: () => void;
  onBack: () => void;
  suggestion: string | null;
  geocodeLoading: boolean;
}) {
  const autofilled = useRef(false);
  useEffect(() => {
    if (suggestion && !draft.venue_name && !autofilled.current) {
      autofilled.current = true;
      onChange('venue_name', suggestion);
    }
  }, [suggestion]);

  const todayStr = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }, []);

  const yesterdayStr = useMemo(() => {
    const t = new Date(); t.setDate(t.getDate() - 1);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    if (!draft.visited_at) onChange('visited_at', todayStr);
    if (!draft.occasion_type) onChange('occasion_type', 'romantic');
  }, []);

  const dateValue = draft.visited_at?.match(/^\d{4}-\d{2}-\d{2}/)
    ? draft.visited_at.slice(0, 10)
    : todayStr;

  const dateLabel = dateValue === todayStr ? 'Today' : dateValue === yesterdayStr ? 'Yesterday' : dateValue;

  const isFutureDate = (() => {
    if (!dateValue) return false;
    const picked = new Date(dateValue + 'T00:00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return picked > today;
  })();

  const [openRow, setOpenRow] = useState<'price' | 'date' | 'photos' | 'notes' | null>(null);

  function toggleRow(row: 'price' | 'date' | 'photos' | 'notes') {
    setOpenRow(o => o === row ? null : row);
  }

  const photos: string[] = draft.photos || [];

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.length) return;
    onChange('photos', [...photos, ...result.assets.map((a: any) => a.uri)].slice(0, 5));
  }

  const priceLabel = draft.price !== undefined && draft.price !== null ? PRICE_LABELS[draft.price] : null;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.detailsScroll} contentContainerStyle={[styles.stepContainer, { paddingBottom: 0 }]} keyboardShouldPersistTaps="handled">
        <ProgressDots currentStep={2} />
        <Text style={styles.stepTitle}>Tell me about it</Text>
        <Text style={styles.stepSubtitle}>Step 2 of 5</Text>

        <View style={{ marginBottom: 18 }}>
          <TextInput
            style={[styles.input, { marginBottom: 0, paddingVertical: 8 }]}
            value={draft.venue_name || ''}
            onChangeText={(v) => onChange('venue_name', v)}
            placeholder={geocodeLoading ? 'Looking up the spot…' : 'Name this spot'}
            placeholderTextColor={T.placeholder}
            returnKeyType="done"
          />
        </View>

        <View style={{ marginBottom: 18 }}>
          <Text style={styles.detailsSectionLabel}>What kind of date? <Text style={{ color: T.accent }}>*</Text></Text>
          <SlidingSegControl
            options={OCCASION_TYPES}
            value={draft.occasion_type || 'romantic'}
            onChange={(v) => { onChange('occasion_type', v); if (v !== 'other') onChange('occasion_label', ''); }}
          />
          {draft.occasion_type === 'other' && (
            <TextInput
              style={[styles.input, { marginTop: 10, marginBottom: 0 }]}
              value={draft.occasion_label || ''}
              onChangeText={(v) => onChange('occasion_label', v)}
              placeholder="Describe the occasion… *"
              placeholderTextColor={T.placeholder}
              returnKeyType="done"
              autoFocus
            />
          )}
        </View>

        <View style={{ marginBottom: 18 }}>
          <Text style={styles.detailsSectionLabel}>Category <Text style={{ color: T.accent }}>*</Text></Text>
          <View style={styles.chipWrap}>
            {ACTIVITY_TYPES.map((a) => {
              const selected = draft.activity_type === a.value;
              return (
                <Pressable
                  key={a.value}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => onChange('activity_type', selected ? null : a.value)}
                >
                  <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{a.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.detailsCard}>
          <PickerRow
            iconName="pricetag-outline"
            label="Price"
            displayValue={priceLabel}
            open={openRow === 'price'}
            onToggle={() => toggleRow('price')}
          >
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([0, 1, 2, 3] as Price[]).map((p) => {
                const sel = draft.price === p;
                return (
                  <Pressable
                    key={p}
                    style={[styles.detailsQuickBtn, sel && styles.detailsQuickBtnSelected]}
                    onPress={() => onChange('price', sel ? undefined : p)}
                  >
                    <Text style={[styles.detailsQuickBtnText, sel && styles.detailsQuickBtnTextSelected]}>
                      {PRICE_LABELS[p]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </PickerRow>
          <PickerRow
            iconName="calendar-outline"
            label="Date"
            displayValue={dateLabel}
            open={openRow === 'date'}
            onToggle={() => toggleRow('date')}
            last
          >
            {isFutureDate && (
              <Text style={styles.dateError}>Date can't be in the future</Text>
            )}
            <CalendarPicker value={dateValue} onChange={(date) => {
              onChange('visited_at', date);
              setOpenRow(null);
            }} />
          </PickerRow>
        </View>

        <View style={[styles.detailsCard, { marginBottom: 8 }]}>
          <PickerRow
            iconName="image-outline"
            label="Photos"
            displayValue={photos.length > 0 ? `${photos.length}/5` : null}
            open={openRow === 'photos'}
            onToggle={() => toggleRow('photos')}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {photos.map((uri, i) => (
                <View key={i} style={styles.detailsPhotoThumb}>
                  <Image source={{ uri }} style={{ width: '100%', height: '100%', borderRadius: 13 }} />
                  <Pressable
                    style={styles.photoRemoveBtn}
                    onPress={() => onChange('photos', photos.filter((_, j) => j !== i))}
                    hitSlop={6}
                  >
                    <Text style={styles.photoRemoveBtnText}>−</Text>
                  </Pressable>
                </View>
              ))}
              {photos.length < 5 && (
                <Pressable style={styles.detailsPhotoAdd} onPress={pickPhoto}>
                  <Ionicons name="add" size={20} color={T.muted} />
                  <Text style={styles.detailsPhotoAddLabel}>Add</Text>
                </Pressable>
              )}
            </View>
          </PickerRow>
          <PickerRow
            iconName="document-text-outline"
            label="Notes"
            displayValue={draft.notes?.trim() ? '•' : null}
            open={openRow === 'notes'}
            onToggle={() => toggleRow('notes')}
            last
          >
            <TextInput
              style={[styles.input, styles.inputMultiline, { marginBottom: 0 }]}
              placeholder="What made it memorable?"
              placeholderTextColor={T.placeholder}
              value={draft.notes || ''}
              onChangeText={(v) => onChange('notes', v)}
              multiline
              numberOfLines={3}
            />
          </PickerRow>
        </View>
      </ScrollView>

      <View style={styles.detailsFooter}>
        <Pressable
          style={[styles.detailsContinueBtn, (!draft.activity_type || (draft.occasion_type === 'other' && !draft.occasion_label?.trim())) && { opacity: 0.4 }]}
          onPress={onNext}
          disabled={!draft.activity_type || (draft.occasion_type === 'other' && !draft.occasion_label?.trim())}
        >
          <Text style={styles.detailsContinueBtnText}>Continue</Text>
        </Pressable>
        <Pressable style={{ alignItems: 'center', marginTop: 12 }} onPress={onBack}>
          <Text style={{ fontSize: 13, color: T.muted }}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TriageStep({ onPick }: { onPick: (t: Triage) => void }) {
  return (
    <View style={styles.stepContainer}>
      <ProgressDots currentStep={3} />
      <Text style={styles.stepTitle}>First impression?</Text>
      <Text style={styles.stepSubtitle}>Step 3 of 5 · Narrows your comparisons</Text>
      <View style={styles.triageRow}>
        <Pressable style={[styles.triageBtn, { backgroundColor: '#fff2f2', borderColor: '#ff3b30' }]} onPress={() => onPick('bad')}>
          <Text style={[styles.triageLabel, { color: '#ff3b30' }]}>Bad</Text>
        </Pressable>
        <Pressable style={[styles.triageBtn, { backgroundColor: '#fff8ee', borderColor: '#ff9500' }]} onPress={() => onPick('okay')}>
          <Text style={[styles.triageLabel, { color: '#ff9500' }]}>Okay</Text>
        </Pressable>
        <Pressable style={[styles.triageBtn, { backgroundColor: '#f0fff4', borderColor: '#34c759' }]} onPress={() => onPick('great')}>
          <Text style={[styles.triageLabel, { color: '#34c759' }]}>Great</Text>
        </Pressable>
      </View>
    </View>
  );
}

function NoCompareStep({ triage, activityLabel, onSave }: { triage: Triage; activityLabel: string; onSave: () => void }) {
  const tierLabel = triage === 'great' ? 'great' : triage === 'okay' ? 'okay' : 'bad';
  return (
    <View style={styles.stepContainer}>
      <ProgressDots currentStep={4} />
      <Text style={styles.stepTitle}>First {activityLabel} spot</Text>
      <Text style={styles.stepSubtitle}>
        You don't have other {tierLabel} {activityLabel.toLowerCase()} spots to compare yet. Once you log more, they'll rank against each other here.
      </Text>
      <Pressable style={styles.btnPrimaryCenter} onPress={onSave}>
        <Text style={styles.btnPrimaryText}>Save spot</Text>
      </Pressable>
    </View>
  );
}

const COMPARE_ACTIVITY_COLORS: Record<string, string> = {
  food:          '#B5614A',
  bars:          '#6B6B9E',
  cafes:         '#8B6B45',
  outdoors:      '#5A8066',
  indoors:       '#6B7B8D',
  view:          '#6080A0',
  entertainment: '#4B8080',
  shopping:      '#9E6B80',
  other:         '#8B7762',
};

function CompareStep({ newVenueName, newVenueAddress, newActivityType, opponent, onBetter, onWorse, onTooHard, onBack }: {
  newVenueName: string; newVenueAddress?: string; newActivityType: string; opponent: Visit;
  onBetter: () => void; onWorse: () => void; onTooHard: () => void; onBack: () => void;
}) {
  const thisScaleAnim = useRef(new Animated.Value(1)).current;
  const thatScaleAnim = useRef(new Animated.Value(1)).current;
  const [thisBorder, setThisBorder] = useState(false);
  const [thatBorder, setThatBorder] = useState(false);
  const isAnimating = useRef(false);

  // Unlock clicks only once the new opponent has loaded
  useEffect(() => {
    isAnimating.current = false;
    thisScaleAnim.setValue(1);
    thatScaleAnim.setValue(1);
    setThisBorder(false);
    setThatBorder(false);
  }, [opponent.id]);

  function animateTap(
    anim: Animated.Value,
    setBorder: (v: boolean) => void,
    onDone: () => void,
  ) {
    if (isAnimating.current) return;
    isAnimating.current = true;
    setBorder(true);
    Animated.sequence([
      Animated.timing(anim, { toValue: 1.05, duration: 55, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 1.0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setBorder(false);
      onDone();
    });
  }

  const opponentColor = ratingColor(opponent.rating);
  const thisColor = COMPARE_ACTIVITY_COLORS[newActivityType] ?? '#8B7762';
  const thatColor = COMPARE_ACTIVITY_COLORS[opponent.activity_type] ?? '#8B7762';
  const thisLabel = ACTIVITY_TYPES.find(a => a.value === newActivityType)?.label ?? 'Spot';
  const thatLabel = ACTIVITY_TYPES.find(a => a.value === opponent.activity_type)?.label ?? 'Spot';

  return (
    <View style={styles.stepContainer}>
      <ProgressDots currentStep={4} />
      <Text style={styles.stepTitle}>Which was better?</Text>
      <Text style={styles.stepSubtitle}>Step 4 of 5</Text>
      <Text style={styles.stepHeadspace}>Which would you want to take someone on a date?</Text>
      <View style={styles.compareRow}>
        <Animated.View style={[styles.compareCardWrap, { transform: [{ scale: thisScaleAnim }] }]}>
          <Pressable
            style={[styles.compareCard, { borderColor: thisBorder ? T.accent : T.border }]}
            onPress={() => animateTap(thisScaleAnim, setThisBorder, onBetter)}
          >
            <View style={[styles.compareCardHeader, { backgroundColor: thisColor }]}>
              <Text style={styles.compareCardCategory} numberOfLines={1}>{thisLabel.toUpperCase()}</Text>
              <View style={styles.compareNewPill}>
                <Text style={styles.compareNewPillText}>?</Text>
              </View>
            </View>
            <View style={styles.compareCardBody}>
              <Text style={styles.compareCardName} numberOfLines={2}>{newVenueName}</Text>
              {!!newVenueAddress && (
                <Text style={styles.compareCardAddress} numberOfLines={1}>{newVenueAddress.replace(/\n/g, ', ')}</Text>
              )}
              <Text style={styles.compareCardLabel}>This one</Text>
            </View>
          </Pressable>
        </Animated.View>
        <View style={styles.compareVs}><Text style={styles.compareVsText}>VS</Text></View>
        <Animated.View style={[styles.compareCardWrap, { transform: [{ scale: thatScaleAnim }] }]}>
          <Pressable
            style={[styles.compareCard, { borderColor: thatBorder ? T.accent : T.border }]}
            onPress={() => animateTap(thatScaleAnim, setThatBorder, onWorse)}
          >
            <View style={[styles.compareCardHeader, { backgroundColor: thatColor }]}>
              <Text style={styles.compareCardCategory} numberOfLines={1}>{thatLabel.toUpperCase()}</Text>
              {opponent.rating > 0 && (
                <View style={[styles.compareRatingPill, { borderColor: opponentColor }]}>
                  <Text style={[styles.compareRatingPillText, { color: opponentColor }]}>{formatRating(opponent.rating)}</Text>
                </View>
              )}
            </View>
            <View style={styles.compareCardBody}>
              <Text style={styles.compareCardName} numberOfLines={2}>{opponent.venue_name}</Text>
              {!!opponent.address && (
                <Text style={styles.compareCardAddress} numberOfLines={1}>{opponent.address.replace(/\n/g, ', ')}</Text>
              )}
              <Text style={styles.compareCardLabel}>That one</Text>
            </View>
          </Pressable>
        </Animated.View>
      </View>
      <Pressable style={styles.tooHardBtn} onPress={onTooHard}>
        <Text style={styles.tooHardText}>Too hard to compare</Text>
      </Pressable>
      <Pressable style={styles.btnSecondaryCenter} onPress={onBack}>
        <Text style={styles.btnSecondaryText}>Back to impression</Text>
      </Pressable>
    </View>
  );
}

function DoneStep({ venueName, onAnother, onClose }: {
  venueName: string; onAnother: () => void; onClose: () => void;
}) {
  return (
    <View style={[styles.stepContainer, styles.doneContainer]}>
      <ProgressDots currentStep={5} />
      <Ionicons name="checkmark-circle" size={56} color={T.accent} style={{ marginBottom: 12 }} />
      <Text style={styles.doneTitle}>Logged!</Text>
      <Text style={styles.doneSub}>{venueName} is on your map.</Text>
      <View style={styles.btnRow}>
        <Pressable style={styles.btnSecondary} onPress={onClose}>
          <Text style={styles.btnSecondaryText}>Done</Text>
        </Pressable>
        <Pressable style={styles.btnPrimary} onPress={onAnother}>
          <Text style={styles.btnPrimaryText}>Log another</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  pinBadge: {
    minWidth: 40, height: 26, borderRadius: 13,
    paddingHorizontal: 7,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', borderWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4,
  },
  pinScore: { fontSize: 12, fontWeight: '800' },
  // Wrapper spans the badge height (top:0/bottom:0) and centers the label
  // vertically on the pin. Fixed width gives the name room and sets where it
  // wraps to a second line; without an explicit width an absolutely-positioned
  // Text is constrained to the ~40px badge and truncates almost immediately.
  pinLabelWrap: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: 96,
    justifyContent: 'center',
  },
  // left:'100%' puts the box to the pin's right (text reads away from the pin);
  // right:'100%' puts it to the pin's left, with the text hugging the pin.
  pinLabelWrapRight: { left: '100%', marginLeft: 5, alignItems: 'flex-start' },
  pinLabelWrapLeft: { right: '100%', marginRight: 5, alignItems: 'flex-end' },
  pinLabel: {
    fontSize: 11, fontWeight: '700', color: '#000', lineHeight: 14,
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3,
  },

  futurePinBadge: {
    // Match pinBadge dimensions (minWidth 40, height 26, paddingHorizontal 7) so the venue
    // name label sits at the same distance from the anchor as on been-to pins.
    minWidth: 40, height: 26, borderRadius: 13,
    paddingHorizontal: 7,
    backgroundColor: 'rgba(88,86,214,0.12)',
    borderWidth: 2, borderColor: '#5856d6',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#5856d6', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25, shadowRadius: 3,
  },
  futurePinBadgeSelected: {
    backgroundColor: '#5856d6',
  },

  seedPinBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 4, borderRadius: 13,
    backgroundColor: '#fff', borderWidth: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4,
  },
  seedPinScore: { fontSize: 11, fontWeight: '800' },

  clusterBadge: {
    minWidth: 34, height: 34, borderRadius: 17,
    backgroundColor: '#fff', borderWidth: 2, borderColor: '#000',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4,
  },
  clusterText: { fontSize: 13, fontWeight: '800', color: '#000' },

  filterRow: {
    position: 'absolute', top: 76, left: 0, right: 0,
    paddingHorizontal: 16, gap: 8,
  },
  filterTabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    alignSelf: 'stretch',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  filterTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: T.muted,
  },
  filterTabTextActive: {
    color: T.primary,
  },
  filterTabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2,
    backgroundColor: T.primary,
    borderRadius: 1,
  },
  filterBtnRow: {
    alignSelf: 'flex-start',
  },

  mapFilterBtn: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.2)',
    backgroundColor: '#fff', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6,
  },
  mapFilterBtnActive: { borderColor: T.accent, backgroundColor: T.accentTint },
  mapFilterBtnMain: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6 },
  mapFilterBtnDivider: { width: StyleSheet.hairlineWidth, height: 14, backgroundColor: T.accent },
  mapFilterClearBtn: { paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  mapFilterBtnText: { fontSize: 13, fontWeight: '600', color: T.primary },
  mapFilterBtnTextActive: { color: T.accent },


  pinHint: {
    position: 'absolute', top: 60, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
  },
  pinHintText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  visitBanner: {
    position: 'absolute', bottom: 12, left: 12, right: 12,
    backgroundColor: 'rgba(255,255,255,0.97)', borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
  },
  visitBannerInner: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 8 },
  visitBannerBody: { flex: 1 },
  visitBannerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  visitBannerName: { fontSize: 15, fontWeight: '600', color: T.primary, flex: 1, marginRight: 8 },
  visitBannerMeta: { fontSize: 12, color: T.muted, marginBottom: 3 },
  visitBannerPreview: { fontSize: 12, color: '#A0927E', fontStyle: 'italic', lineHeight: 16 },
  visitBannerPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1.5, backgroundColor: 'transparent' },
  visitBannerPillText: { fontSize: 12, fontWeight: '800' },
  visitBannerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  visitBannerActionGroup: { flexDirection: 'column', alignItems: 'center', gap: 6 },
  visitBannerActionBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: T.inputBg, alignItems: 'center', justifyContent: 'center',
  },
  visitBannerClose: { paddingTop: 1 },
  savedToast: {
    position: 'absolute', bottom: 110, alignSelf: 'center', zIndex: 30,
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(255,255,255,0.97)', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 10,
  },
  savedToastText: { fontSize: 13, fontWeight: '600', color: '#5856d6' },


  searchResults: { maxHeight: 300, marginTop: 4 },
  searchResult: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 11, paddingHorizontal: 2,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border,
  },
  searchResultName: { fontSize: 14, fontWeight: '600', color: T.primary },
  searchResultAddr: { fontSize: 12, color: T.muted, marginTop: 2 },
  searchMsg: { fontSize: 13, color: T.muted, textAlign: 'center', paddingVertical: 16 },


  sheetBg: { backgroundColor: T.bg, borderRadius: 20 },
  sheetContent: { flex: 1 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    backgroundColor: T.bg,
    borderRadius: 24,
    height: '84%',
    overflow: 'hidden',
    opacity: 0.9,
  },
  modalCardCompact: {
    backgroundColor: T.bg,
    borderRadius: 24,
    overflow: 'hidden',
    paddingVertical: 20,
    justifyContent: 'center',
    opacity: 0.9,
  },

  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 20 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: T.border },
  dotActive: { width: 18, borderRadius: 3, backgroundColor: T.accent },
  dotDone: { backgroundColor: '#c9b89e' },

  detailsScroll: { flex: 1 },
  detailsSectionLabel: {
    fontSize: 11.5, fontWeight: '700', letterSpacing: 1,
    textTransform: 'uppercase', color: T.muted, marginBottom: 9,
  },
  detailsCard: {
    backgroundColor: T.card, borderWidth: 1, borderColor: T.border,
    borderRadius: 16, paddingHorizontal: 16, marginBottom: 16,
  },
  pickerRowHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 15, paddingHorizontal: 4,
  },
  pickerRowIconSlot: { width: 22, alignItems: 'center' },
  pickerRowLabel: { flex: 1, fontSize: 16, color: T.primary },
  pickerRowValue: { fontSize: 16, fontWeight: '700', color: T.accent },
  pickerRowAdd: { fontSize: 15, color: T.placeholder },
  pickerRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border },
  pickerRowBody: { paddingHorizontal: 4, paddingBottom: 16 },
  detailsQuickBtn: {
    flex: 1, paddingVertical: 11, paddingHorizontal: 4,
    borderRadius: 11, borderWidth: 1.5, borderColor: T.border,
    backgroundColor: T.inputBg, alignItems: 'center',
  },
  detailsQuickBtnSelected: { backgroundColor: T.accent, borderColor: T.accent },
  detailsQuickBtnText: { fontSize: 15, fontWeight: '600', color: T.muted },
  detailsQuickBtnTextSelected: { fontWeight: '700', color: '#fff' },
  detailsPhotoThumb: { width: 78, height: 78, borderRadius: 13, overflow: 'hidden' },
  detailsPhotoAdd: {
    width: 78, height: 78, borderRadius: 13,
    backgroundColor: T.inputBg, borderWidth: 1.5, borderColor: T.border,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  detailsPhotoAddLabel: { fontSize: 10.5, fontWeight: '600', color: T.muted },
  segTrack: {
    position: 'relative', flexDirection: 'row',
    backgroundColor: T.inputBg, borderWidth: 1, borderColor: T.border,
    borderRadius: 999, padding: 5,
  },
  segPill: {
    position: 'absolute', top: 5, bottom: 5, left: 5,
    backgroundColor: T.accent, borderRadius: 999,
    shadowColor: T.accent, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 3,
  },
  segOption: { flex: 1, paddingVertical: 11, paddingHorizontal: 2, alignItems: 'center', zIndex: 1 },
  segOptionText: { fontSize: 13, fontWeight: '600', color: T.muted },
  segOptionTextSelected: { fontWeight: '700', color: '#fff' },
  detailsFooter: {
    paddingHorizontal: 22, paddingTop: 12, paddingBottom: 26,
    backgroundColor: T.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border,
  },
  detailsContinueBtn: {
    backgroundColor: T.accent, borderRadius: 999, paddingVertical: 16, alignItems: 'center',
  },
  detailsContinueBtnText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  stepContainer: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  stepTitle: { fontSize: 18, fontWeight: '400', color: T.primary, textAlign: 'center', fontFamily: 'Fraunces-Regular', },
  stepSubtitle: { fontSize: 13, color: T.muted, textAlign: 'center', marginTop: 8, marginBottom: 6 },
  stepHeadspace: { fontSize: 12, color: T.placeholder, textAlign: 'center', marginBottom: 24, fontStyle: 'italic' },

  modeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: T.card, borderRadius: 14,
    paddingHorizontal: 18, paddingVertical: 16,
    borderWidth: 1.5, borderColor: T.border,
  },
  modeCardTitle: { fontSize: 15, fontWeight: '700', color: T.primary },
  modeCardSub: { fontSize: 12, color: T.muted, marginTop: 2 },

  cardBackBtn: { position: 'absolute', top: 16, left: 24, zIndex: 1 },
  cardBackBtnText: { fontSize: 13, color: T.muted },
  orDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: T.border },
  orText: { fontSize: 12, color: T.muted, fontWeight: '500' },
  pinDropBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: T.border, borderRadius: 12,
    paddingVertical: 14, backgroundColor: T.card,
  },
  pinDropBtnText: { fontSize: 15, fontWeight: '600', color: T.primary },

  circleRow: { flexDirection: 'row', justifyContent: 'space-between' },
  circleBtn: { alignItems: 'center', flex: 1 },
  circle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  circleBtnLabel: { fontSize: 13, fontWeight: '600', color: T.primary, textAlign: 'center' },
  circleBtnSub: { fontSize: 11, color: T.muted, textAlign: 'center', marginTop: 2 },

  photoScroll: { marginBottom: 12, marginHorizontal: -24 },
  photoScrollContent: { paddingHorizontal: 24, alignItems: 'center' },
  photoThumbWrap: {
    width: 64, height: 64, marginRight: 7,
  },
  photoThumb: {
    width: 64, height: 64, borderRadius: 9, overflow: 'hidden',
  },
  photoThumbImg: { width: '100%', height: '100%', borderRadius: 9 },
  photoRemoveBtn: {
    position: 'absolute', top: -5, right: -5,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#8E8E93',
    alignItems: 'center', justifyContent: 'center',
  },
  photoRemoveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 16, includeFontPadding: false },
  photoAdd: {
    width: 64, height: 64, borderRadius: 9,
    borderWidth: 1.5, borderColor: T.border,
    backgroundColor: T.card,
    alignItems: 'center', justifyContent: 'center', gap: 3,
    marginRight: 7,
  },
  photoAddLabel: { fontSize: 10, color: T.muted, fontWeight: '500' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    backgroundColor: T.card, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1.5, borderColor: T.border,
  },
  chipSelected: { backgroundColor: T.accent, borderColor: T.accent },
  chipLabel: { fontSize: 14, fontWeight: '600', color: T.primary },
  chipLabelSelected: { color: '#fff' },

  priceRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  priceBtn: {
    flex: 1, backgroundColor: T.inputBg, borderRadius: 10,
    paddingVertical: 9, alignItems: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  priceBtnSelected: { backgroundColor: T.accentTint, borderColor: T.accent },
  priceBtnText: { fontSize: 14, fontWeight: '600', color: T.primary },
  priceBtnTextSelected: { color: T.accent },

  input: {
    backgroundColor: T.inputBg, borderRadius: 999,
    paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, color: T.primary, marginBottom: 10,
  },
  inputMultiline: { minHeight: 64, textAlignVertical: 'top', borderRadius: 24 },

  triageRow: { flexDirection: 'row', gap: 12 },
  triageBtn: {
    flex: 1, borderRadius: 16, paddingVertical: 20,
    alignItems: 'center', gap: 8,
    borderWidth: 2,
  },
  triageEmoji: { fontSize: 32 },
  triageLabel: { fontSize: 15, fontWeight: '700' },

  compareRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  compareCardWrap: { flex: 1, aspectRatio: 1 },
  compareCard: { flex: 1, borderRadius: 16, overflow: 'hidden', borderWidth: 2 },
  compareCardNew: { borderColor: T.accent },
  compareCardOld: { borderColor: T.border },
  compareCardHeader: { height: 47, paddingLeft: 8, paddingRight: 8, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  compareCardCategory: { flex: 1, fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.9)', letterSpacing: 0.3 },
  compareNewPill: {
    flexShrink: 0, marginLeft: 4,
    backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)',
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3,
  },
  compareNewPillText: { fontSize: 12, fontWeight: '800', color: 'rgba(255,255,255,0.8)' },
  compareRatingPill: {
    flexShrink: 0, marginLeft: 4,
    backgroundColor: '#fff', borderWidth: 1.5,
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3,
  },
  compareRatingPillText: { fontSize: 12, fontWeight: '800' },
  compareCardBody: { flex: 1, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, backgroundColor: T.bg, justifyContent: 'space-between' },
  compareCardName: { fontSize: 14, fontWeight: '700', color: T.primary, lineHeight: 18 },
  compareCardAddress: { fontSize: 10, color: T.muted, fontWeight: '400', marginTop: 2, lineHeight: 13 },
  compareCardLabel: { fontSize: 11, color: T.muted, fontWeight: '500' },
  compareVs: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: T.bg, borderWidth: 2, borderColor: T.accent,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10, marginHorizontal: -10,
  },
  compareVsText: { fontSize: 11, fontWeight: '700', color: T.accent },

  tooHardBtn: {
    backgroundColor: T.inputBg, borderRadius: 14,
    paddingVertical: 12, alignItems: 'center', marginBottom: 8,
  },
  tooHardText: { fontSize: 14, fontWeight: '600', color: T.muted },

  dateError: { fontSize: 12, color: '#ff3b30', fontWeight: '600', marginTop: -8, marginBottom: 8 },

  calendarContainer: {
    borderRadius: 14, borderWidth: 1.5, borderColor: T.border,
    backgroundColor: T.card, padding: 10, marginBottom: 12,
  },
  calendarHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
  },
  calendarNavBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  calendarMonthTitle: { fontSize: 15, fontWeight: '700', color: T.primary },
  calendarDayHeaders: { flexDirection: 'row', marginBottom: 2 },
  calendarDayHeader: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '600', color: T.muted, paddingBottom: 4 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { width: '14.285714%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  calendarCellInner: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  calendarCellSelected: { backgroundColor: T.accent },
  calendarCellText: { fontSize: 13, fontWeight: '500', color: T.primary },
  calendarCellTextFuture: { color: T.primary, opacity: 0.25 },
  calendarCellTextSelected: { color: '#fff', fontWeight: '700' },

  calendarToggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: T.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    backgroundColor: T.card, marginBottom: 8,
  },
  calendarToggleBtnText: { flex: 1, fontSize: 15, color: T.primary, fontWeight: '500' },

  searchLoadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },

  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btnPrimary: { flex: 1, backgroundColor: 'transparent', borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: T.accent },
  btnPrimaryCenter: { backgroundColor: 'transparent', borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: T.accent, marginTop: 8 },
  btnPrimaryText: { color: T.accent, fontSize: 16, fontWeight: '700' },
  btnSecondary: { flex: 1, backgroundColor: T.inputBg, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnSecondaryCenter: { backgroundColor: T.inputBg, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  btnSecondaryText: { color: T.primary, fontSize: 16, fontWeight: '600' },

  doneContainer: { alignItems: 'center', paddingTop: 16 },
  doneTitle: { fontSize: 24, fontWeight: '800', color: T.primary, marginBottom: 6 },
  doneSub: { fontSize: 15, color: T.muted, marginBottom: 24 },

  suggestionCard: {
    backgroundColor: T.accentTint,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: T.accent,
    padding: 20,
    marginTop: 12,
    marginBottom: 8,
    alignItems: 'center',
    gap: 6,
  },
  suggestionPrompt: { fontSize: 13, color: T.muted, fontWeight: '500' },
  suggestionName: { fontSize: 20, fontWeight: '700', color: T.primary, textAlign: 'center', marginBottom: 8 },

  geocodeHint: { fontSize: 11, color: T.muted, marginTop: -6, marginBottom: 8, marginLeft: 2 },
});

const mfs = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border,
  },
  title: { fontSize: 17, fontWeight: '700', color: T.primary },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  accordionHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, gap: 10,
  },
  accordionLabel: { fontSize: 15, fontWeight: '600', color: T.primary, flex: 1 },
  activeBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center',
  },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingBottom: 16 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: T.border, backgroundColor: T.bg,
  },
  chipActive: { backgroundColor: T.accentTint, borderColor: T.accent },
  chipText: { fontSize: 13, fontWeight: '600', color: T.primary },
  chipTextActive: { color: T.accent },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: T.border, marginTop: 16 },
  footer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border,
  },
  clearAll: { fontSize: 15, color: T.accent, fontWeight: '600' },
  applyBtn: { backgroundColor: T.accent, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  applyBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
