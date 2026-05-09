import { Visit, Triage } from './visits';

export { Triage };

export interface ComparisonState {
  lo: number;
  hi: number;
  mid: number;
  count: number;
  sorted: Visit[];
}

export type ComparisonResult = 'better' | 'worse';

const MAX_COMPARISONS = 7;

export function startComparison(
  existing: Visit[],
  triage: Triage
): ComparisonState | null {
  const pool = existing.filter((v) => v.triage === triage);
  if (pool.length === 0) return null;

  const sorted = [...pool].sort((a, b) => b.rank_order - a.rank_order);
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  return { lo: 0, hi: n, mid, count: 0, sorted };
}

export function advance(
  state: ComparisonState,
  result: ComparisonResult
): ComparisonState | null {
  const { lo, hi, mid, count, sorted } = state;
  const nextCount = count + 1;

  let nextLo = lo;
  let nextHi = hi;

  if (result === 'better') {
    nextHi = mid; // new spot belongs above mid
  } else {
    nextLo = mid + 1; // new spot belongs below mid
  }

  const nextMid = Math.floor((nextLo + nextHi) / 2);
  const done = nextLo >= nextHi || nextCount >= MAX_COMPARISONS;

  if (done) return null;

  return { lo: nextLo, hi: nextHi, mid: nextMid, count: nextCount, sorted };
}

// Resolve rank_order at the natural end of comparison (uses state.lo as insertion point).
// Uses state.sorted so category-filtered sessions stay consistent.
export function resolveRankOrder(state: ComparisonState | null, existing: Visit[]): number {
  if (existing.length === 0) return 1000;

  if (state === null) {
    const sorted = [...existing].sort((a, b) => b.rank_order - a.rank_order);
    return sorted[0].rank_order + 1;
  }

  const { sorted, lo } = state;
  return rankOrderAt(sorted, lo);
}

// Resolve rank_order at the current mid — used by the "Too hard" button.
export function resolveAtMid(state: ComparisonState, existing: Visit[]): number {
  return rankOrderAt(state.sorted, state.mid);
}

function rankOrderAt(sorted: Visit[], insertAt: number): number {
  if (insertAt === 0) return sorted[0].rank_order + 1000;
  if (insertAt >= sorted.length) return sorted[sorted.length - 1].rank_order - 1000;
  const above = sorted[insertAt - 1].rank_order;
  const below = sorted[insertAt].rank_order;
  return (above + below) / 2;
}

export function currentComparison(state: ComparisonState): Visit {
  return state.sorted[state.mid];
}
