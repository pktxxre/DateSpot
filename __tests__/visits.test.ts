import { ratingColor, formatRating, friendlyDate } from '../lib/visits';

describe('ratingColor', () => {
  it('returns deep green for ratings >= 8.5', () => {
    expect(ratingColor(8.5)).toBe('#2F8F5B');
    expect(ratingColor(10.0)).toBe('#2F8F5B');
  });

  it('returns soft green for ratings >= 6.8 and < 8.5', () => {
    expect(ratingColor(6.8)).toBe('#5FA86B');
    expect(ratingColor(8.4)).toBe('#5FA86B');
  });

  it('returns amber for ratings >= 3.3 and < 6.8', () => {
    expect(ratingColor(3.3)).toBe('#D99A2B');
    expect(ratingColor(5.5)).toBe('#D99A2B');
    expect(ratingColor(6.7)).toBe('#D99A2B');
  });

  it('returns red for ratings below 3.3', () => {
    expect(ratingColor(0.1)).toBe('#C75146');
    expect(ratingColor(2.0)).toBe('#C75146');
    expect(ratingColor(3.2)).toBe('#C75146');
  });
});

describe('formatRating', () => {
  it('formats to one decimal place', () => {
    expect(formatRating(7)).toBe('7.0');
    expect(formatRating(8.55)).toBe('8.6');
    expect(formatRating(0.1)).toBe('0.1');
  });
});

describe('friendlyDate', () => {
  const today = new Date();
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  it('returns Today for today\'s date', () => {
    expect(friendlyDate(fmt(today))).toBe('Today');
  });

  it('returns Yesterday for yesterday\'s date', () => {
    const d = new Date(today); d.setDate(d.getDate() - 1);
    expect(friendlyDate(fmt(d))).toBe('Yesterday');
  });

  it('returns weekday name for dates within the past week', () => {
    const d = new Date(today); d.setDate(d.getDate() - 3);
    const expected = d.toLocaleDateString('en-US', { weekday: 'long' });
    expect(friendlyDate(fmt(d))).toBe(expected);
  });

  it('returns month/day for dates 7+ days ago', () => {
    const d = new Date(today); d.setDate(d.getDate() - 10);
    const expected = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    expect(friendlyDate(fmt(d))).toBe(expected);
  });

  it('returns empty string for empty input', () => {
    expect(friendlyDate('')).toBe('');
  });

  it('returns raw string for non-date input', () => {
    expect(friendlyDate('not-a-date')).toBe('not-a-date');
  });
});
