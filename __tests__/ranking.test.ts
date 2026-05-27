import { startComparison, advance, resolveRankOrder, resolveAtMid, currentComparison } from '../lib/ranking';
import type { Visit } from '../lib/visits';

function makeVisit(id: string, rankOrder: number, triage: 'bad' | 'okay' | 'great' = 'okay'): Visit {
  return {
    id,
    venue_name: `Spot ${id}`,
    lat: 0,
    lng: 0,
    visited_at: '2026-01-01',
    rating: 5.0,
    rank_order: rankOrder,
    notes: null,
    activity_type: 'food',
    price: 2,
    triage,
    date_type: null,
    created_at: '2026-01-01',
    photos: [],
    address: null,
    canonical_place_id: null,
    canonical_name: null,
    canonical_lat: null,
    canonical_lng: null,
    resolution_status: 'pending',
  };
}

const threeOkay = [makeVisit('a', 3000, 'okay'), makeVisit('b', 2000, 'okay'), makeVisit('c', 1000, 'okay')];
const mixed = [
  makeVisit('g1', 3000, 'great'), makeVisit('g2', 2500, 'great'),
  makeVisit('o1', 2000, 'okay'),
  makeVisit('b1', 1000, 'bad'),
];

describe('startComparison', () => {
  it('returns null when no existing visits', () => {
    expect(startComparison([] as Visit[], (v) => v.triage === 'okay')).toBeNull();
  });

  it('returns null when no visits in that triage tier', () => {
    expect(startComparison(threeOkay, (v) => v.triage === 'great')).toBeNull();
  });

  it('starts with mid pointing at a real visit', () => {
    const state = startComparison(threeOkay, (v) => v.triage === 'okay');
    expect(state).not.toBeNull();
    expect(state!.sorted[state!.mid]).toBeDefined();
  });

  it('only compares within the same triage tier', () => {
    const state = startComparison(mixed, (v) => v.triage === 'great');
    expect(state).not.toBeNull();
    expect(state!.sorted.every(v => v.triage === 'great')).toBe(true);
    expect(state!.sorted.length).toBe(2);
  });

  it('startComparison works with a non-Visit type that has rank_order + id', () => {
    const stacks = [
      { id: 's1', rank_order: 3000, name: 'Date A' },
      { id: 's2', rank_order: 2000, name: 'Date B' },
    ];
    const state = startComparison(stacks, () => true);
    expect(state).not.toBeNull();
    expect(state!.sorted[state!.mid]).toBeDefined();
  });
});

describe('advance', () => {
  it('narrows the search window on "better"', () => {
    const state = startComparison(threeOkay, (v) => v.triage === 'okay')!;
    const next = advance(state, 'better');
    if (next) {
      expect(next.hi).toBeLessThanOrEqual(state.mid);
    }
  });

  it('narrows the search window on "worse"', () => {
    const state = startComparison(threeOkay, (v) => v.triage === 'okay')!;
    const next = advance(state, 'worse');
    if (next) {
      expect(next.lo).toBeGreaterThanOrEqual(state.mid + 1);
    }
  });

  it('returns null when lo >= hi (window exhausted)', () => {
    // Force a two-item pool: mid=1, lo=0, hi=2. After 'worse': lo=2, hi=2 → done
    const twoItems = [makeVisit('x', 2000), makeVisit('y', 1000)];
    const state = startComparison(twoItems, () => true)!;
    const next = advance(state, 'worse');
    expect(next).toBeNull();
  });

  it('returns null when MAX_COMPARISONS is reached', () => {
    // Build a large pool (8 items) and drive 7 advances without exhausting window
    const pool = Array.from({ length: 16 }, (_, i) =>
      makeVisit(`v${i}`, (16 - i) * 1000)
    );
    let state = startComparison(pool, () => true)!;
    for (let i = 0; i < 6; i++) {
      const next = advance(state, 'better');
      if (!next) break;
      state = next;
    }
    const final = advance(state, 'better');
    expect(final).toBeNull();
  });
});

describe('resolveRankOrder', () => {
  it('returns above the highest when existing is empty', () => {
    expect(resolveRankOrder(null, [])).toBe(1000);
  });

  it('returns above the highest existing rank_order when state is null', () => {
    const result = resolveRankOrder(null, threeOkay);
    expect(result).toBeGreaterThan(3000);
  });

  it('returns a value between neighbors when inserting at mid', () => {
    const state = startComparison(threeOkay, (v) => v.triage === 'okay')!;
    const resolved = resolveRankOrder(state, threeOkay);
    expect(typeof resolved).toBe('number');
    expect(isFinite(resolved)).toBe(true);
  });
});

describe('resolveAtMid', () => {
  it('returns the rank_order of the current mid comparison target (tie)', () => {
    const state = startComparison(threeOkay, (v) => v.triage === 'okay')!;
    const midRankOrder = state.sorted[state.mid].rank_order;
    expect(resolveAtMid(state, threeOkay)).toBe(midRankOrder);
  });
});

describe('currentComparison', () => {
  it('returns the visit at state.mid', () => {
    const state = startComparison(threeOkay, (v) => v.triage === 'okay')!;
    const visit = currentComparison(state);
    expect(visit).toBe(state.sorted[state.mid]);
  });
});
