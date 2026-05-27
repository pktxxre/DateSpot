import { cleanAddress } from '../app/(tabs)/map';

describe('cleanAddress', () => {
  it('formats a newline-separated Nominatim address', () => {
    expect(cleanAddress('1234 Broadway\nSeattle, WA 98109')).toBe('1234 Broadway, Seattle, WA 98109');
  });

  it('abbreviates street type in the output', () => {
    expect(cleanAddress('500 Pike Street\nSeattle, WA 98101')).toBe('500 Pike St, Seattle, WA 98101');
  });

  it('handles full state name by converting to abbreviation', () => {
    const result = cleanAddress('200 Park Avenue\nNew York, New York 10001');
    expect(result).toContain('NY');
  });

  it('returns original string when no parseable street found', () => {
    const unparseable = 'Pike Place Market, Seattle';
    expect(cleanAddress(unparseable)).toBe(unparseable);
  });

  it('skips County parts when finding city', () => {
    const result = cleanAddress('100 Main St, King County, Seattle, WA 98101');
    expect(result).toContain('Seattle');
    expect(result).not.toContain('County');
  });
});
