import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

let _VideoView: any = null;
let _useVideoPlayer: any = null;
try {
  const m = require('expo-video');
  _VideoView = m.VideoView;
  _useVideoPlayer = m.useVideoPlayer;
} catch {}

const WORD = 'DateSpot';
const CHAR_DELAY = 1500 / WORD.length; // ~187ms per letter

function IntroVideo({ next }: { next: string }) {
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const textFade = useRef(new Animated.Value(0)).current;
  const [typedText, setTypedText] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const player = _useVideoPlayer(require('@/assets/intro.mp4'), (p: any) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });

  // Fade black overlay out after 1 second to reveal video
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }, 1000);
    return () => clearTimeout(t);
  }, []);

  // Poll for duration, then schedule typing; navigate on end
  useEffect(() => {
    let scheduled = false;

    function startTyping() {
      Animated.timing(textFade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      let i = 0;
      typingIntervalRef.current = setInterval(() => {
        i++;
        setTypedText(WORD.slice(0, i));
        if (i >= WORD.length) {
          clearInterval(typingIntervalRef.current!);
          typingIntervalRef.current = null;
        }
      }, CHAR_DELAY);
    }

    pollRef.current = setInterval(() => {
      if (player.duration > 0 && !scheduled) {
        scheduled = true;
        clearInterval(pollRef.current!);
        pollRef.current = null;
        const delay = Math.max(0, (player.duration - 2) * 1000);
        typingTimerRef.current = setTimeout(startTyping, delay);
      }
    }, 50);

    const endSub = player.addListener('playToEnd', () => {
      router.replace(next as any);
    });

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
      endSub.remove();
    };
  }, [player, next]);

  return (
    <>
      <_VideoView
        player={player}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
        nativeControls={false}
      />
      {/* Black overlay fades out to reveal video — never wrap VideoView in Animated.View */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000', opacity: overlayOpacity }]}
        pointerEvents="none"
      />
      {typedText.length > 0 && (
        <Animated.View style={[styles.textContainer, { opacity: textFade }]}>
          <Text style={styles.brandText}>{typedText}</Text>
        </Animated.View>
      )}
    </>
  );
}

class VideoErrorBoundary extends React.Component<{ children: React.ReactNode; next: string }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() { router.replace(this.props.next as any); }
  render() { return this.state.hasError ? null : this.props.children; }
}

export default function IntroScreen() {
  const { next = '/(tabs)' } = useLocalSearchParams<{ next: string }>();

  if (!_VideoView || !_useVideoPlayer) {
    router.replace(next as any);
    return null;
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <VideoErrorBoundary next={next}>
        <IntroVideo next={next} />
      </VideoErrorBoundary>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  textContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandText: {
    fontFamily: 'Fraunces-Light',
    fontSize: 42,
    color: '#fff',
    letterSpacing: 2,
  },
});
