import { Visit } from './visits';

export interface ComparisonState {
  lo: number;        // index into sorted array (inclusive)
  hi: number;        // index into sorted array (exclusive)
  mid: number;       // current comparison index
  count: number;     // comparisons made so far
  sorted: Visit[];   // existing visits sorted by rank_order desc
}

export type ComparisonResult = 'better' | 'worse';

const MAX_COMPARISONS = 7;

// Start a new comparison session for a new visit being inserted.
// Returns null if there are no existing visits (no comparisons needed).
export function startComparison(existing: Visit[]): ComparisonState | null {
  if (existing.length === 0) return null;

  const sorted = [...existing].sort((a, b) => b.rank_order - a.rank_order);
  const lo = 0;
  const hi = sorted.length;
  const mid = Math.floor((lo + hi) / 2);

  return { lo, hi, mid, count: 0, sorted };
}

// Advance the comparison state based on whether the new visit is
// better or worse than the visit at state.mid.
// Returns the updated state, or null if comparison is complete.
export function advance(
  state: ComparisonState,
  result: ComparisonResult
): ComparisonState | null {
  const { lo, hi, mid, count, sorted } = state;
  const nextCount = count + 1;

  let nextLo = lo;
  let nextHi = hi;

  if (result === 'better') {
    // New visit is better than sorted[mid], so it belongs in the upper half
    nextHi = mid;
  } else {
    // New visit is worse than sorted[mid], so it belongs in the lower half
    nextLo = mid + 1;
  }

  const nextMid = Math.floor((nextLo + nextHi) / 2);
  const done = nextLo >= nextHi || nextCount >= MAX_COMPARISONS;

  if (done) return null;

  return { lo: nextLo, hi: nextHi, mid: nextMid, count: nextCount, sorted };
}

// Compute the final rank_order for the new visit, given the final state.
// Uses fractional indexing: place the new visit between its neighbors.
export function resolveRankOrder(state: ComparisonState | null, existing: Visit[]): number {
  if (existing.length === 0) return 1000;

  const sorted = [...existing].sort((a, b) => b.rank_order - a.rank_order);

  if (state === null) {
    // No comparisons happened — shouldn't occur with existing visits, but be safe
    return sorted[0].rank_order + 1;
  }

  const insertAt = state.lo; // insert before this index in sorted desc array

  if (insertAt === 0) {
    // Better than everything — place above the best
    return sorted[0].rank_order + 1000;
  }

  if (insertAt >= sorted.length) {
    // Worse than everything — place below the worst
    return sorted[sorted.length - 1].rank_order - 1000;
  }

  // Between two existing visits
  const above = sorted[insertAt - 1].rank_order;
  const below = sorted[insertAt].rank_order;
  return (above + below) / 2;
}

// The visit to show for the current comparison step
export function currentComparison(state: ComparisonState): Visit {
  return state.sorted[state.mid];
}
