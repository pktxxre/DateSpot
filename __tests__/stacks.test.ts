import { stackTier } from '../lib/stacks';
import type { TierKey } from '../lib/stacks';

describe('stackTier', () => {
  it('returns explicit tier when set', () => {
    expect(stackTier({ tier: 'S', rating: 1.0 })).toBe('S');
    expect(stackTier({ tier: 'F', rating: 9.5 })).toBe('F');
  });

  it('derives tier from rating when tier is null', () => {
    expect(stackTier({ tier: null, rating: 9.0 })).toBe('S');
    expect(stackTier({ tier: null, rating: 7.0 })).toBe('A');
    expect(stackTier({ tier: null, rating: 5.5 })).toBe('B');
    expect(stackTier({ tier: null, rating: 4.0 })).toBe('C');
    expect(stackTier({ tier: null, rating: 1.0 })).toBe('F');
  });

  it('derives tier from rating when tier is undefined', () => {
    expect(stackTier({ rating: 8.0 })).toBe('S');
    expect(stackTier({ rating: 6.5 })).toBe('A');
    expect(stackTier({ rating: 5.0 })).toBe('B');
    expect(stackTier({ rating: 3.5 })).toBe('C');
    expect(stackTier({ rating: 0.0 })).toBe('F');
  });
});
