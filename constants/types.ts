/**
 * Core TypeScript types matching the DateSpot data model.
 * These mirror the Supabase schema in PLAN.md.
 */

export type SpotType = 'scenic' | 'activity' | 'food' | 'event' | 'other';
export type CostTier = 'free' | '$' | '$$' | '$$$';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  username?: string;         // nullable until first share action
  profile_public: boolean;
  created_at: string;
}

export interface Place {
  id: string;
  user_id: string;
  lat: number;
  lng: number;
  title: string;
  type: SpotType;
  cost: CostTier;
  external_place_id?: string; // Mapbox Place ID, for future V2 dedup
  created_at: string;
}

export interface Visit {
  id: string;
  user_id: string;
  place_id: string;
  rating: number;             // 1–10, CHECK in DB
  with_person?: string;       // private, never shown publicly
  date_time: string;
  duration_minutes?: number;
  notes?: string;             // max 1500 chars, CHECK in DB
  photos: string[];           // Supabase Storage paths, NOT signed URLs
  created_at: string;
  // Joined fields (not in DB, populated by queries)
  place?: Place;
}

export interface Pin {
  id: string;
  user_id: string;
  place_id: string;
  created_at: string;
  // Joined fields
  place?: Place;
}

/** Minimal shape used for map pin rendering */
export interface MapPin {
  id: string;           // visit.id or pin.id
  place_id: string;
  lat: number;
  lng: number;
  rating?: number;      // undefined for wishlist pins (no visit yet)
  type: SpotType;
  title: string;
  isWishlist: boolean;
}

/** The 1–10 rating anchor table */
export const RATING_ANCHORS: Record<string, string> = {
  '1–2': 'Never again',
  '3': 'Not worth it',
  '4': 'Mixed / probably wouldn\'t go back',
  '5': 'Solid — would go back ✓',  // The baseline
  '6': 'Good, would recommend to some',
  '7–8': 'Very good / strong date spot',
  '9–10': 'Exceptional — bring everyone here',
};

/** Duration picker options (in minutes) */
export const DURATION_OPTIONS = [
  { label: '30m',  minutes: 30 },
  { label: '1hr',  minutes: 60 },
  { label: '1.5hr', minutes: 90 },
  { label: '2hr',  minutes: 120 },
  { label: '2.5hr', minutes: 150 },
  { label: '3hr',  minutes: 180 },
  { label: '3hr+', minutes: 181 },  // sentinel for "more than 3 hours"
];
