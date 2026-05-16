import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const TOP_SPOTS_MIN_THRESHOLD = 50;
const MAX_DISTANCE_M = 500;
const MIN_NAME_SIMILARITY = 0.6;
const NOMINATIM_TIMEOUT_MS = 5000;

// Haversine distance in metres between two lat/lng points
function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Jaro similarity — handles short venue name typos better than Levenshtein
function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  if (matchWindow < 0) return 0;

  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);
  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

// Encode lat/lng into a geohash of the given precision (base32)
function geohash(lat: number, lng: number, precision = 6): string {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let minLat = -90, maxLat = 90, minLng = -180, maxLng = 180;
  let hash = '';
  let bits = 0, bitsTotal = 0, hashValue = 0;
  let isLng = true;

  while (hash.length < precision) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) { hashValue = (hashValue << 1) | 1; minLng = mid; }
      else { hashValue = hashValue << 1; maxLng = mid; }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) { hashValue = (hashValue << 1) | 1; minLat = mid; }
      else { hashValue = hashValue << 1; maxLat = mid; }
    }
    isLng = !isLng;
    bits++;
    bitsTotal++;
    if (bits === 5) {
      hash += BASE32[hashValue];
      bits = 0;
      hashValue = 0;
    }
  }
  return hash;
}

// Composite canonical_place_id — vendor-neutral, survives Nominatim API changes
async function makeCanonicalId(venueName: string, lat: number, lng: number): Promise<string> {
  const input = `${normalizeName(venueName)}:${geohash(lat, lng, 6)}`;
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
}

async function nominatimSearch(
  venueName: string,
  lat: number,
  lng: number
): Promise<NominatimResult[]> {
  const params = new URLSearchParams({
    q: venueName,
    format: 'json',
    addressdetails: '0',
    limit: '5',
    viewbox: `${lng - 0.05},${lat + 0.05},${lng + 0.05},${lat - 0.05}`,
    bounded: '1',
  });
  const url = `https://nominatim.openstreetmap.org/search?${params}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Required by Nominatim ToS: identify the application
        'User-Agent': 'DateSpot/1.0 (atloexo@gmail.com)',
      },
    });
    if (!res.ok) return [];
    return await res.json() as NominatimResult[];
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405 });
  }

  let body: { venue_name: string; lat: number; lng: number; city: string; activity_type: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ status: 'failed', reason: 'bad_request' }), { status: 400 });
  }

  const { venue_name, lat, lng, city, activity_type } = body;
  if (!venue_name || lat == null || lng == null) {
    return new Response(JSON.stringify({ status: 'failed', reason: 'missing_fields' }), { status: 400 });
  }

  // Query Nominatim
  let results: NominatimResult[] = [];
  try {
    results = await nominatimSearch(venue_name, lat, lng);
  } catch {
    return new Response(JSON.stringify({ status: 'failed', reason: 'nominatim_error' }), { status: 200 });
  }

  if (results.length === 0) {
    return new Response(JSON.stringify({ status: 'failed', reason: 'no_results' }), { status: 200 });
  }

  // Find best match by similarity + distance
  let bestResult: NominatimResult | null = null;
  let bestSimilarity = 0;
  let bestDistance = Infinity;

  for (const r of results) {
    const resultName = r.name ?? r.display_name.split(',')[0];
    const similarity = jaroSimilarity(normalizeName(venue_name), normalizeName(resultName));
    const distance = haversineMetres(lat, lng, parseFloat(r.lat), parseFloat(r.lon));

    if (similarity > bestSimilarity || (similarity === bestSimilarity && distance < bestDistance)) {
      bestSimilarity = similarity;
      bestDistance = distance;
      bestResult = r;
    }
  }

  if (!bestResult || bestSimilarity < MIN_NAME_SIMILARITY) {
    return new Response(JSON.stringify({ status: 'failed', reason: 'low_similarity' }), { status: 200 });
  }
  if (bestDistance > MAX_DISTANCE_M) {
    return new Response(JSON.stringify({ status: 'failed', reason: 'too_far' }), { status: 200 });
  }

  const canonicalLat = parseFloat(bestResult.lat);
  const canonicalLng = parseFloat(bestResult.lon);
  const canonicalName = bestResult.name ?? bestResult.display_name.split(',')[0];
  const canonicalPlaceId = await makeCanonicalId(canonicalName, canonicalLat, canonicalLng);

  // Upsert into top_spots using service role (client cannot write directly)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { error: upsertError } = await supabase.rpc('upsert_top_spot', {
    p_canonical_place_id: canonicalPlaceId,
    p_canonical_name: canonicalName,
    p_canonical_lat: canonicalLat,
    p_canonical_lng: canonicalLng,
    p_osm_place_id: String(bestResult.place_id),
    p_city: city || null,
    p_activity_type: activity_type || null,
  });

  if (upsertError) {
    // Still return resolved — the canonical data is valid even if the upsert failed
    console.error('top_spots upsert failed:', upsertError.message);
  }

  return new Response(
    JSON.stringify({
      status: 'resolved',
      canonical_place_id: canonicalPlaceId,
      canonical_name: canonicalName,
      canonical_lat: canonicalLat,
      canonical_lng: canonicalLng,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
