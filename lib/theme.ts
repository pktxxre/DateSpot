export const Fonts = {
  serif: 'Fraunces-Regular',
  sans: undefined as string | undefined,
  mono: 'IBMPlexMono-Regular',
} as const;

export const T = {
  // Surfaces
  bg: '#FBF8F3',        // warm paper — never stark white behind content
  card: '#FFFFFF',
  inputBg: '#F3EDE4',   // sunken wells
  segBg: '#EDE5D9',     // segmented control track

  // Text
  ink: '#2B2118',       // near-black espresso — headlines
  primary: '#4B3621',   // body
  muted: '#8B7762',
  placeholder: '#B3A48F',

  // Brand actions
  accent: '#E76F51',
  accentDeep: '#C4502F',
  accentTint: '#FCEFE9',
  danger: '#C0392B',
  dangerBg: '#FDE8E8',

  // Score scale
  scoreGreat: '#2F8F5B',
  scoreGreatBg: '#E9F4EE',
  scoreGood: '#5FA86B',
  scoreMid: '#D99A2B',
  scoreLow: '#C75146',

  // Structure
  border: '#ECE4D8',
  borderStrong: '#E2D8C9',
} as const;
