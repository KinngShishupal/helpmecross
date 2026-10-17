import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { IMAGES } from '../assets/images';

const loop = (value: Animated.Value, duration: number, delay = 0) =>
  Animated.loop(
    Animated.timing(value, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.linear,
      useNativeDriver: true,
    }),
  );

/** Clouds drifting slowly across the sky. */
export function Clouds({ width, height }: { width: number; height: number }) {
  const clouds = useRef(
    [
      { y: 0.03, size: 0.16, duration: 70000, offset: 0.1 },
      { y: 0.12, size: 0.11, duration: 95000, offset: 0.55 },
      { y: 0.06, size: 0.08, duration: 120000, offset: 0.8 },
    ].map(c => ({ ...c, value: new Animated.Value(0) })),
  ).current;

  useEffect(() => {
    const anims = clouds.map(c => {
      // start part-way across so the sky is not empty at launch
      c.value.setValue(c.offset);
      const first = Animated.timing(c.value, {
        toValue: 1,
        duration: c.duration * (1 - c.offset),
        easing: Easing.linear,
        useNativeDriver: true,
      });
      return Animated.sequence([
        first,
        Animated.timing(c.value, { toValue: 0, duration: 0, useNativeDriver: true }),
        loop(c.value, c.duration),
      ]);
    });
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, [clouds]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {clouds.map((c, i) => {
        const w = width * c.size;
        return (
          <Animated.Image
            key={i}
            source={IMAGES.cloud}
            style={{
              position: 'absolute',
              top: height * c.y,
              width: w,
              height: w * 0.45,
              opacity: 0.92,
              transform: [
                {
                  translateX: c.value.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-w, width],
                  }),
                },
              ],
            }}
          />
        );
      })}
    </View>
  );
}

/** Flowing ripples on the river, scrolling towards the viewer. */
export function RiverRipples({ left, top, width, height }: { left: number; top: number; width: number; height: number }) {
  const tile = 220;
  const flow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = loop(flow, 9000);
    anim.start();
    return () => anim.stop();
  }, [flow]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left, top, width, height, overflow: 'hidden' }}>
      <Animated.View
        style={{
          width,
          height: height + tile,
          transform: [{ translateY: flow.interpolate({ inputRange: [0, 1], outputRange: [-tile, 0] }) }],
        }}>
        <Image
          source={IMAGES.ripples}
          resizeMode="repeat"
          style={{ width, height: height + tile, opacity: 0.75 }}
        />
      </Animated.View>
    </View>
  );
}
