import { ratingColor, type Triage } from './visits';

export type { Triage } from './visits';

const TIER_BANDS: Record<Triage, { min: number; max: number }> = {
  great: { min: 7.0, max: 10.0 },
  okay:  { min: 4.0, max: 6.7  },
  bad:   { min: 1.0, max: 3.2  },
};

/**
 * The locked ring color for a triage tier: the band-top rating's canonical
 * color (great → green, okay → amber, bad → red). Held constant for the whole
 * This-or-That flow so the live ring never crosses color mid-decision.
 */
export function tierColor(triage: Triage): string {
  return ratingColor(TIER_BANDS[triage].max);
}

/**
 * Provisional score for a spot being ranked, as if it were inserted at
 * `insertAt` (0-based from the top/best) into a tier pool of `poolSize`
 * already-ranked spots. Pure mirror of recomputeRatings' band interpolation
 * (every spot its own rank, no ties) so the live ring during This-or-That reads
 * the same value that will eventually be saved.
 */
export function provisionalRating(insertAt: number, poolSize: number, triage: Triage): number {
  const { min, max } = TIER_BANDS[triage];
  const ng = poolSize + 1;
  const clamped = Math.min(Math.max(insertAt, 0), ng - 1);
  const gi = ng - 1 - clamped; // recomputeRatings orders worst → best
  let rating: number;
  if (ng === 1) {
    rating = max;
  } else if (ng <= 10) {
    const step = (max - min) * 10 / (9 * ng);
    rating = Math.max(min, max - (ng - 1 - gi) * step);
  } else {
    const pct = gi / (ng - 1);
    rating = min + pct * (max - min);
  }
  return Math.round(rating * 10) / 10;
}

export interface ComparisonState<T extends { rank_order: number; id: string }> {
  lo: number;
  hi: number;
  mid: number;
  count: number;
  sorted: T[];
}

export type ComparisonResult = 'better' | 'worse';

const MAX_COMPARISONS = 7;

export function startComparison<T extends { rank_order: number; id: string }>(
  existing: T[],
  filterFn: (v: T) => boolean
): ComparisonState<T> | null {
  const pool = existing.filter(filterFn);
  if (pool.length === 0) return null;

  const sorted = [...pool].sort((a, b) => b.rank_order - a.rank_order);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  return { lo: 0, hi: n, mid, count: 0, sorted };
}

export function advance<T extends { rank_order: number; id: string }>(
  state: ComparisonState<T>,
  result: ComparisonResult
): ComparisonState<T> | null {
  const { lo, hi, mid, count, sorted } = state;
  const nextCount = count + 1;

  let nextLo = lo;
  let nextHi = hi;

  if (result === 'better') {
    nextHi = mid;
  } else {
    nextLo = mid + 1;
  }

  const nextMid = Math.floor((nextLo + nextHi) / 2);
  const done = nextLo >= nextHi || nextCount >= MAX_COMPARISONS;

  if (done) return null;

  return { lo: nextLo, hi: nextHi, mid: nextMid, count: nextCount, sorted };
}

export function resolveRankOrder<T extends { rank_order: number; id: string }>(
  state: ComparisonState<T> | null,
  existing: T[]
): number {
  if (existing.length === 0) return 1000;

  if (state === null) {
    const sorted = [...existing].sort((a, b) => b.rank_order - a.rank_order);
    return sorted[0].rank_order + 1;
  }

  return rankOrderAt(state.sorted, state.lo);
}

export function resolveAtMid<T extends { rank_order: number; id: string }>(
  state: ComparisonState<T>,
  _existing: T[]
): number {
  // Tie with the current comparison target — recomputeRatings groups identical
  // rank_orders together so they always receive the same rating.
  return state.sorted[state.mid].rank_order;
}

function rankOrderAt<T extends { rank_order: number }>(sorted: T[], insertAt: number): number {
  if (insertAt === 0) return sorted[0].rank_order + 1000;
  if (insertAt >= sorted.length) return sorted[sorted.length - 1].rank_order - 1000;
  const above = sorted[insertAt - 1].rank_order;
  const below = sorted[insertAt].rank_order;
  return (above + below) / 2;
}

export function currentComparison<T extends { rank_order: number; id: string }>(
  state: ComparisonState<T>
): T {
  return state.sorted[state.mid];
}
