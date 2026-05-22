import { ratingColor, formatRating } from '../lib/visits';

describe('ratingColor', () => {
  it('returns green for ratings >= 6.8', () => {
    expect(ratingColor(6.8)).toBe('#34c759');
    expect(ratingColor(8.5)).toBe('#34c759');
    expect(ratingColor(10.0)).toBe('#34c759');
  });

  it('returns orange for ratings >= 3.3 and < 6.8', () => {
    expect(ratingColor(3.3)).toBe('#ff9500');
    expect(ratingColor(5.5)).toBe('#ff9500');
    expect(ratingColor(6.7)).toBe('#ff9500');
  });

  it('returns red for ratings below 3.3', () => {
    expect(ratingColor(0.1)).toBe('#ff3b30');
    expect(ratingColor(2.0)).toBe('#ff3b30');
    expect(ratingColor(3.2)).toBe('#ff3b30');
  });
});

describe('formatRating', () => {
  it('formats to one decimal place', () => {
    expect(formatRating(7)).toBe('7.0');
    expect(formatRating(8.55)).toBe('8.6');
    expect(formatRating(0.1)).toBe('0.1');
  });
});
