import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ICONS, IMAGES } from '../assets/images';
import { Clouds } from '../components/Ambience';
import Bouncy from '../components/Bouncy';
import GlassButton from '../components/GlassButton';
import { useSettings } from '../settings';
import { colors, textShadow } from '../theme';

interface Props {
  onPlay: () => void;
}

/** First screen: the game title and a single big PLAY button. */
export default function LandingScreen({ onPlay }: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const settings = useSettings();

  const intro = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(intro, { toValue: 1, useNativeDriver: true, speed: 6, bounciness: 10 }).start();
    const loops = [
      Animated.loop(
        Animated.sequence([
          Animated.timing(float, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(float, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ),
    ];
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [intro, float, pulse]);

  const boatW = Math.min(W * 0.2, 260);
  const riderW = boatW * 0.3;

  return (
    <View style={styles.root}>
      <Image source={IMAGES.scene} resizeMode="stretch" style={[StyleSheet.absoluteFill, { width: W, height: H }]} />
      <Clouds width={W} height={H} />
      <View style={[StyleSheet.absoluteFill, styles.dim]} />

      <View style={[styles.settings, { top: Math.max(insets.top, 10), right: Math.max(insets.right, 20) }]}>
        <GlassButton icon={settings.sound ? ICONS.sound : ICONS.soundOff} onPress={settings.toggleSound} accessibilityLabel="Toggle sound" />
        <GlassButton icon={settings.music ? ICONS.music : ICONS.musicOff} onPress={settings.toggleMusic} accessibilityLabel="Toggle music" />
      </View>

      <Animated.View
        style={[
          styles.center,
          {
            opacity: intro,
            transform: [{ scale: intro.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
          },
        ]}>
        <Animated.View style={{ transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [-5, 5] }) }] }}>
          <Text style={[styles.title, { fontSize: Math.min(H * 0.15, 72) }]}>HELP ME CROSS</Text>
          <Text style={styles.tagline}>River & bridge puzzles</Text>
        </Animated.View>

        {/* a little boat with two passengers, bobbing on the water */}
        <Animated.View
          style={[
            styles.boat,
            {
              width: boatW,
              height: boatW * 0.62,
              transform: [
                { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [3, -3] }) },
                { rotate: float.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] }) },
              ],
            },
          ]}>
          <Image source={IMAGES.boatBack} style={[styles.hull, { width: boatW, height: boatW * 0.36 }]} />
          <View style={[styles.riders, { bottom: boatW * 0.14 }]}>
            <Image source={IMAGES.farmer} style={{ width: riderW, height: riderW * 1.25 }} />
            <Image source={IMAGES.goat} style={{ width: riderW, height: riderW * 1.25 }} />
          </View>
          <Image source={IMAGES.boatFront} style={[styles.hull, { width: boatW, height: boatW * 0.36 }]} />
        </Animated.View>

        <Animated.View style={{ transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>
          <Bouncy onPress={onPlay} style={styles.play} accessibilityRole="button" accessibilityLabel="Play">
            <Image source={ICONS.play} style={styles.playIcon} />
            <Text style={styles.playText}>PLAY</Text>
          </Bouncy>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#3a8fe0',
  },
  dim: {
    backgroundColor: 'rgba(8, 24, 52, 0.2)',
  },
  settings: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 8,
    zIndex: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
    ...textShadow,
  },
  tagline: {
    color: colors.gold,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 3,
    textAlign: 'center',
    marginTop: 2,
    ...textShadow,
  },
  boat: {
    marginVertical: 6,
  },
  hull: {
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  riders: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  play: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 44,
    paddingVertical: 14,
    borderRadius: 34,
    backgroundColor: colors.primary,
    borderBottomWidth: 6,
    borderBottomColor: colors.primaryDark,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  playIcon: {
    width: 26,
    height: 26,
    marginRight: 12,
  },
  playText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 4,
  },
});
