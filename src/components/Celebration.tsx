import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { IMAGES } from '../assets/images';

const COLORS = ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#e040fb', '#ff9100'];

/** Falling confetti, played once when it mounts. */
export function Confetti({ width, height }: { width: number; height: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        x: Math.random() * width,
        drift: (Math.random() - 0.5) * 160,
        size: 7 + Math.random() * 8,
        color: COLORS[i % COLORS.length],
        delay: Math.random() * 700,
        duration: 2200 + Math.random() * 1600,
        spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 720),
        progress: new Animated.Value(0),
      })),
    [width],
  );

  useEffect(() => {
    const anims = pieces.map(p =>
      Animated.timing(p.progress, {
        toValue: 1,
        duration: p.duration,
        delay: p.delay,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    );
    Animated.parallel(anims).start();
  }, [pieces]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.x,
            top: -20,
            width: p.size,
            height: p.size * 0.5,
            borderRadius: 2,
            backgroundColor: p.color,
            transform: [
              { translateY: p.progress.interpolate({ inputRange: [0, 1], outputRange: [0, height + 40] }) },
              { translateX: p.progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
              { rotate: p.progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

/** Row of 1-3 stars that pop in one after another. */
export function Stars({ count, size, animated = true }: { count: number; size: number; animated?: boolean }) {
  const values = useRef([0, 1, 2].map(() => new Animated.Value(animated ? 0 : 1))).current;

  useEffect(() => {
    if (!animated) {
      return;
    }
    Animated.stagger(
      220,
      values.map(v => Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 16 })),
    ).start();
  }, [animated, values]);

  return (
    <View style={styles.stars}>
      {values.map((v, i) => (
        <Animated.Image
          key={i}
          source={i < count ? IMAGES.star : IMAGES.starEmpty}
          style={{
            width: size,
            height: size * 0.96,
            marginHorizontal: size * 0.06,
            marginTop: i === 1 ? 0 : size * 0.18,
            transform: [{ scale: v }],
          }}
        />
      ))}
    </View>
  );
}

/** Spinning glow behind a hero image (trophy, warning splash). */
export function HeroImage({ source, size }: { source: typeof IMAGES.trophy; size: number }) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 8, bounciness: 14 }).start();
  }, [pop]);
  return (
    <Animated.View style={{ alignSelf: 'center', transform: [{ scale: pop }] }}>
      <Image source={source} style={{ width: size, height: size }} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
