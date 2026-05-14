import { supabase } from './supabase';
import { ActivityType, Price } from './visits';

export type SeedSpot = {
  id: string;
  user_id: string;
  venue_name: string;
  lat: number;
  lng: number;
  activity_type: ActivityType;
  price: Price;
  rating: number;
  rank_order: number;
  notes: string | null;
  triage: string;
  is_seed: boolean;
  visited_at: string;
  created_at: string;
};

export async function getSeedSpots(): Promise<SeedSpot[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('visits')
    .select('*')
    .eq('is_seed', true)
    .order('rank_order', { ascending: false });
  if (error) {
    console.error('getSeedSpots error:', error.message);
    return [];
  }
  return (data ?? []) as SeedSpot[];
}

export async function getSeedSpotById(id: string): Promise<SeedSpot | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('visits')
    .select('*')
    .eq('id', id)
    .eq('is_seed', true)
    .single();
  if (error) return null;
  return data as SeedSpot;
}
