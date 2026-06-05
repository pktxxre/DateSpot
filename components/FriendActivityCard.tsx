import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, Pressable, Animated as RNAnimated } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { Avatar } from '@/components/Avatar';
import { FriendActivityItem } from '@/lib/friends';
import { ratingColor, friendlyDate } from '@/lib/visits';
import { notifyActivity, removeNotifyActivity } from '@/lib/notifications';
import { insertFutureSpot, deleteFutureSpotsByVenueName, getAllFutureSpots } from '@/lib/future';
import { isActivityLiked, likeActivity, unlikeActivity } from '@/lib/friendLikes';
import { scheduleOpenLogWithLocation } from '@/app/(tabs)/map';

const PRIMARY  = '#4B3621';
const MUTED    = '#8B7762';
const PLACEHOLDER_CLR = '#B0A090';
const BORDER   = '#EDE8E0';
const NOTE_CLR = '#A0927E';

const LOG_CLR  = '#E76F51';
const SAVE_CLR = '#5856d6';
const LIKE_CLR = '#E8637A';

const ACTIVITY_LABEL: Record<string, string> = {
  food: 'Food', bars: 'Drinks', cafes: 'Cafes',
  outdoors: 'Outdoors', indoors: 'Indoors', view: 'Views',
  entertainment: 'Entertainment', shopping: 'Shopping', other: 'Other',
};

function FloatingHeart({ onDone }: { onDone: () => void }) {
  const translateY = useRef(new RNAnimated.Value(0)).current;
  const opacity    = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    RNAnimated.parallel([
      RNAnimated.timing(translateY, { toValue: -28, duration: 500, useNativeDriver: true }),
      RNAnimated.sequence([
        RNAnimated.delay(180),
        RNAnimated.timing(opacity, { toValue: 0, duration: 370, useNativeDriver: true }),
      ]),
    ]).start(({ finished }) => { if (finished) onDone(); });
  }, []);

  return (
    <RNAnimated.View
      pointerEvents="none"
      style={{ position: 'absolute', top: 6, left: 6, transform: [{ translateY }], opacity }}
    >
      <Ionicons name="heart" size={18} color={LIKE_CLR} />
    </RNAnimated.View>
  );
}

export function FriendActivityCard({ item, isLast, alreadyVisited, linkToDetail }: {
  item: FriendActivityItem;
  isLast: boolean;
  alreadyVisited: boolean;
  linkToDetail?: boolean;
}) {
  const actLabel = ACTIVITY_LABEL[item.activityType] ?? item.activityType;

  function openDetail() {
    router.push(`/spot/${item.visitId}` as any);
  }
  const showRating = item.rating > 0;
  const rColor = showRating ? ratingColor(item.rating) : null;

  const [liked, setLiked] = useState(() => isActivityLiked(item.visitId));
  const [saved, setSaved] = useState(() => {
    const key = item.venueName.toLowerCase().trim();
    return getAllFutureSpots().some(f => f.venue_name.toLowerCase().trim() === key);
  });
  const [toast, setToast] = useState<string | null>(null);
  const [floatingHearts, setFloatingHearts] = useState<number[]>([]);
  const heartIdRef = useRef(0);

  // Serialize notification writes so rapid taps resolve in order — the final
  // DB state always matches the final UI state (no duplicates, and no orphan
  // notification left behind if the user ends on "not saved" / "not liked").
  const saveOpChain = useRef<Promise<unknown>>(Promise.resolve());
  const likeOpChain = useRef<Promise<unknown>>(Promise.resolve());
  function runSerial(chain: { current: Promise<unknown> }, fn: () => Promise<void>) {
    chain.current = chain.current.then(fn, fn);
  }

  const heartScale = useRef(new RNAnimated.Value(1)).current;
  const saveScale  = useRef(new RNAnimated.Value(1)).current;
  const toastOpacity = useRef(new RNAnimated.Value(0)).current;

  function pop(anim: RNAnimated.Value, peak = 1.4) {
    RNAnimated.sequence([
      RNAnimated.timing(anim, { toValue: peak, duration: 120, useNativeDriver: true }),
      RNAnimated.spring(anim, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  }

  function showToast(msg: string) {
    setToast(msg);
    toastOpacity.setValue(0);
    RNAnimated.sequence([
      RNAnimated.timing(toastOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      RNAnimated.delay(700),
      RNAnimated.timing(toastOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }

  function handleLog() {
    scheduleOpenLogWithLocation(item.venueName, item.lat, item.lng);
    notifyActivity(item.friend.id, 'log', item.visitId);
    router.navigate('/(tabs)/map');
  }

  function handleSave() {
    pop(saveScale, 1.2);
    if (saved) {
      deleteFutureSpotsByVenueName(item.venueName);
      setSaved(false);
      runSerial(saveOpChain, () => removeNotifyActivity(item.friend.id, 'save', item.visitId));
    } else {
      insertFutureSpot({
        id: Crypto.randomUUID(),
        venue_name: item.venueName,
        lat: item.lat,
        lng: item.lng,
        activity_type: item.activityType,
        occasion_type: item.occasionType,
        created_at: new Date().toISOString(),
      });
      setSaved(true);
      showToast('Saved');
      runSerial(saveOpChain, () => notifyActivity(item.friend.id, 'save', item.visitId));
    }
  }

  function handleLike() {
    pop(heartScale);
    const next = !liked;
    setLiked(next);
    if (next) {
      likeActivity(item.visitId);
      const id = ++heartIdRef.current;
      setFloatingHearts(h => [...h, id]);
      runSerial(likeOpChain, () => notifyActivity(item.friend.id, 'like', item.visitId));
    } else {
      unlikeActivity(item.visitId);
      runSerial(likeOpChain, () => removeNotifyActivity(item.friend.id, 'like', item.visitId));
    }
  }

  return (
    <View style={[s.activityRow, !isLast && s.activityRowBorder, { overflow: 'hidden' }]}>
      <Pressable onPress={linkToDetail ? openDetail : undefined} disabled={!linkToDetail}>
      {/* Top: avatar + meta + rating pill */}
      <View style={s.cardTop}>
        <Pressable onPress={() => router.push(`/user/${item.friend.id}` as any)} hitSlop={6}>
          <Avatar
            id={item.friend.id}
            name={item.friend.username}
            photoUri={item.friend.profilePhotoUri}
            emoticon={item.friend.avatarEmoticon}
            size={48}
          />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.cardSentence} numberOfLines={1}>
            <Text style={s.cardWho} suppressHighlighting onPress={() => router.push(`/user/${item.friend.id}` as any)}>{item.friend.username}</Text>
            <Text style={s.cardVerb}>{' logged '}</Text>
            <Text style={s.cardSpot}>{item.venueName}</Text>
          </Text>
          <View style={s.metaRow}>
            <Text style={s.metaCat}>{actLabel}</Text>
          </View>
        </View>
        {showRating && rColor && (
          <View style={[s.ratingPill, { borderColor: rColor }]}>
            <Text style={[s.ratingPillText, { color: rColor }]}>{item.rating === 10 ? '10' : item.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>

      {/* Note — always reserve space so all cards are uniform height */}
      <Text style={s.noteText} numberOfLines={2}>
        {item.notes ? `"${item.notes}"` : ''}
      </Text>
      </Pressable>

      {/* Action row */}
      <View style={s.actionRow}>
        {/* Like + date posted — left side */}
        <View style={s.actionLeft}>
          <View>
            <Pressable
              style={[
                s.actionCircleBtn,
                liked && { backgroundColor: `${LIKE_CLR}18`, borderColor: LIKE_CLR },
              ]}
              onPress={handleLike}
            >
              <RNAnimated.View style={{ transform: [{ scale: heartScale }] }}>
                <Ionicons name={liked ? 'heart' : 'heart-outline'} size={14} color={liked ? LIKE_CLR : MUTED} />
              </RNAnimated.View>
            </Pressable>
            {floatingHearts.map(id => (
              <FloatingHeart key={id} onDone={() => setFloatingHearts(h => h.filter(x => x !== id))} />
            ))}
          </View>
          <Text style={s.dateText}>{friendlyDate(item.visitedAt)}</Text>
        </View>

        {/* Log + Save — pinned to far right */}
        <View style={s.actionRight}>
          {toast && (
            <RNAnimated.Text
              pointerEvents="none"
              style={[s.microToast, { opacity: toastOpacity, position: 'absolute', bottom: 34, right: 0 }]}
            >
              {toast}
            </RNAnimated.Text>
          )}
          <Pressable
            style={[s.actionCircleBtn, {
              backgroundColor: alreadyVisited ? '#34c75918' : `${LOG_CLR}18`,
              borderColor: alreadyVisited ? '#34c759' : LOG_CLR,
            }]}
            onPress={alreadyVisited ? undefined : handleLog}
            disabled={alreadyVisited}
          >
            <Ionicons name={alreadyVisited ? 'checkmark' : 'add'} size={16} color={alreadyVisited ? '#34c759' : LOG_CLR} />
          </Pressable>

          <Pressable
            style={[s.actionCircleBtn, {
              backgroundColor: saved ? SAVE_CLR : `${SAVE_CLR}18`,
              borderColor: SAVE_CLR,
            }]}
            onPress={handleSave}
          >
            <RNAnimated.View style={{ transform: [{ scale: saveScale }] }}>
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={14} color={saved ? '#fff' : SAVE_CLR} />
            </RNAnimated.View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  activityRow: { paddingVertical: 10 },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: BORDER },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardSentence: { fontSize: 13, lineHeight: 18, color: PRIMARY },
  cardWho:  { fontWeight: '600' },
  cardVerb: { color: MUTED, fontWeight: '400' },
  cardSpot: { fontWeight: '600' },
  cardTime: { fontSize: 11, color: PLACEHOLDER_CLR },
  metaRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  metaCat:  { fontSize: 11, color: MUTED },
  ratingPill: {
    borderWidth: 1.5, borderRadius: 999,
    paddingHorizontal: 9, paddingVertical: 3,
    minWidth: 42, alignItems: 'center',
    backgroundColor: 'transparent',
  },
  ratingPillText: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  noteText: {
    fontSize: 12, fontStyle: 'italic', color: NOTE_CLR,
    lineHeight: 16, marginTop: 5, minHeight: 22,
  },
  actionRow: { flexDirection: 'row', marginTop: 12, alignItems: 'flex-start', justifyContent: 'space-between' },
  actionLeft: { alignItems: 'flex-start' },
  dateText: { fontSize: 11, color: MUTED, marginTop: 6 },
  actionRight: { flexDirection: 'row', gap: 8 },
  actionCircleBtn: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  microToast: { fontSize: 11, fontWeight: '600', color: SAVE_CLR },
});
