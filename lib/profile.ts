import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncProfileToCloud } from './sync';

const EMOTICONS = [
  ':D', ':P', 'd:', ':)', ':>', ':3', ':O', ':o', '>:)', 'xD',
  'o.o', 'O.o', 'o.O', '^.^', '^^', '^_^', '._.', ':v', 'v:',
  '=D', 'd=', '=P', '=)', '=3', '=O', ':]', '[:', '=]', '[=',
  'o_o', 'O_o', 'o_O', 'C:', 'C=', '0.0', '0_0', ':0', '=0',
];

function randomEmoticon(): string {
  return EMOTICONS[Math.floor(Math.random() * EMOTICONS.length)];
}

export interface UserProfile {
  username: string;       // display name e.g. "Alex Berry"
  handle: string;         // @ handle e.g. "alexberry"
  bio: string;
  profilePhotoUri: string | null;
  avatarEmoticon: string;
  email: string;
  phone: string;
  city: string;
  cityLat: number | null;
  cityLng: number | null;
}

const KEY = 'datespot:profile';
const LAST_USER_KEY = 'datespot:last_user_id';

const DEFAULT: UserProfile = {
  username: 'You',
  handle: '',
  bio: '',
  profilePhotoUri: null,
  avatarEmoticon: '',
  email: '',
  phone: '',
  city: '',
  cityLat: null,
  cityLng: null,
};

export async function getProfile(): Promise<UserProfile> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return DEFAULT;
  return { ...DEFAULT, ...JSON.parse(raw) };
}

export async function saveProfile(updates: Partial<UserProfile>): Promise<void> {
  const current = await getProfile();
  const merged = { ...current, ...updates };
  if (!merged.avatarEmoticon) {
    merged.avatarEmoticon = randomEmoticon();
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(merged));
  syncProfileToCloud(merged);
}

export async function clearProfile(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

export async function getLastUserId(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_USER_KEY);
}

export async function setLastUserId(id: string): Promise<void> {
  await AsyncStorage.setItem(LAST_USER_KEY, id);
}

export async function clearLastUserId(): Promise<void> {
  await AsyncStorage.removeItem(LAST_USER_KEY);
}
