// Tracks prev/cur tab index for directional slide animations.
// Written synchronously on tab press (before navigation), read in useFocusEffect.
export const tabNav = {
  prevIndex: 0,
  curIndex: 0,
};
