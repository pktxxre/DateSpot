/**
 * DateSpot color system
 *
 * Rating colors follow the design doc:
 *   Red   (#ef4444): ratings 1–3
 *   Amber (#f59e0b): ratings 4–6
 *   Green (#22c55e): ratings 7–10
 *
 * 5 is the baseline ("Solid — would go back") and is visually marked in the rating UI.
 */

export const Colors = {
  // Brand
  primary: '#1a1a2e',
  background: '#ffffff',
  surface: '#f8f8f8',
  border: '#e5e5e5',
  textPrimary: '#111111',
  textSecondary: '#666666',
  textMuted: '#999999',

  // Rating tiers (used for pin colors on map)
  ratingRed: '#ef4444',     // 1–3  Never again → mixed
  ratingAmber: '#f59e0b',   // 4–6  Mixed → solid
  ratingGreen: '#22c55e',   // 7–10 Good → exceptional

  // Tab bar
  tabActive: '#1a1a2e',
  tabInactive: '#999999',

  // Status / feedback
  error: '#ef4444',
  warning: '#f59e0b',
  success: '#22c55e',
};

/**
 * Returns the pin color for a given rating (1–10).
 */
export function ratingColor(rating: number): string {
  if (rating <= 3) return Colors.ratingRed;
  if (rating <= 6) return Colors.ratingAmber;
  return Colors.ratingGreen;
}
