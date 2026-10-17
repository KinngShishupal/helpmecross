import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { IMAGES } from '../assets/images';
import { Bank, Character, Setting } from '../game/types';
import CharacterSprite from './CharacterSprite';

interface Props {
  width: number;
  /** Seats in the boat; passengers are drawn smaller in bigger boats. */
  capacity: number;
  /** 'bridge' draws a torch-carrying group on foot instead of a boat. */
  setting: Setting;
  /** Which bank the vehicle is at; on the bridge the torch waits at that end. */
  side: Bank;
  occupants: Character[];
  /** True while crossing: oars swing on the river, feet step on the bridge. */
  rowing: boolean;
  disabled: boolean;
  onPressOccupant: (id: string) => void;
  /** Occupant currently hopping out: keeps its seat but is invisible. */
  hiddenId?: string;
  /** Occupant that just hopped in, so it should not pop in again. */
  landedId?: string | null;
}

/** Passenger width as a fraction of the boat width. */
export const occupantRatio = (capacity: number) => (capacity >= 3 ? 0.25 : 0.31);
export const SEAT_GAP = 4;
export const boatHeight = (width: number) => width * (130 / 360);
/** Bottom of the passenger row, measured up from the bottom of the vehicle. */
export const seatBottom = (width: number, setting: Setting) => (setting === 'bridge' ? 0 : boatHeight(width) * 0.4);
export const boatContainerHeight = (width: number) => boatHeight(width) + width * 0.36;

/** The rowing boat (or, on a bridge, the walkers with their torch). */
export default function Boat({ width, capacity, setting, side, occupants, rowing, disabled, onPressOccupant, hiddenId, landedId }: Props) {
  const onBridge = setting === 'bridge';
  const hullH = boatHeight(width);
  const height = boatContainerHeight(width);
  const occupantW = width * occupantRatio(capacity);
  const oarH = hullH * 1.35;
  const oarW = oarH * (60 / 242);

  const bob = useRef(new Animated.Value(0)).current;
  const stroke = useRef(new Animated.Value(0)).current;
  const flicker = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [bob]);

  useEffect(() => {
    if (!onBridge) {
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, { toValue: 1, duration: 140, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0.4, duration: 110, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0.8, duration: 160, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0.2, duration: 130, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [onBridge, flicker]);

  useEffect(() => {
    if (!rowing) {
      Animated.timing(stroke, { toValue: 0, duration: 250, useNativeDriver: true }).start();
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(stroke, { toValue: 1, duration: 190, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(stroke, { toValue: -1, duration: 190, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [rowing, stroke]);

  const oar = (side: 'left' | 'right') => {
    const base = side === 'left' ? 34 : -34;
    const dir = side === 'left' ? 1 : -1;
    return (
      <Animated.Image
        source={IMAGES.oar}
        style={{
          position: 'absolute',
          width: oarW,
          height: oarH,
          left: (side === 'left' ? width * 0.12 : width * 0.88) - oarW / 2,
          top: height - hullH * 1.05,
          transformOrigin: 'top',
          transform: [
            {
              rotate: stroke.interpolate({
                inputRange: [-1, 1],
                outputRange: [`${base - 14 * dir}deg`, `${base + 14 * dir}deg`],
              }),
            },
          ],
        }}
      />
    );
  };

  const passengers = (
    <Animated.View
      style={[
        styles.occupants,
        { bottom: seatBottom(width, setting), gap: SEAT_GAP },
        // on the bridge, walkers bounce with each step while crossing
        onBridge && { transform: [{ translateY: stroke.interpolate({ inputRange: [-1, 0, 1], outputRange: [0, 0, -4] }) }] },
      ]}>
      {occupants.map(c => (
        <View key={c.id} style={c.id === hiddenId ? styles.hidden : undefined}>
          <CharacterSprite
            character={c}
            width={occupantW}
            inBoat
            hideRowBadge={onBridge}
            instant={c.id === landedId}
            disabled={disabled}
            onPress={() => onPressOccupant(c.id)}
          />
        </View>
      ))}
    </Animated.View>
  );

  if (onBridge) {
    const torchH = occupantW * 1.05;
    const glowSize = width * 1.5;
    return (
      <View style={{ width, height }}>
        <Animated.Image
          source={IMAGES.glow}
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: glowSize,
            height: glowSize,
            left: (width - glowSize) / 2,
            top: height - glowSize * 0.62,
            opacity: flicker.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }),
            transform: [{ scale: flicker.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] }) }],
          }}
        />
        {passengers}
        <Animated.Image
          source={IMAGES.torch}
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: torchH * (60 / 164),
            height: torchH,
            // held at the end nearest the bank the walkers are leaving from
            ...(side === 'start' ? { left: width * 0.04 } : { right: width * 0.04 }),
            bottom: occupantW * 0.25,
            transform: [{ rotate: stroke.interpolate({ inputRange: [-1, 1], outputRange: ['-6deg', '6deg'] }) }],
          }}
        />
      </View>
    );
  }

  return (
    <Animated.View
      style={{
        width,
        height,
        transform: [
          { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [-2, 3] }) },
          { rotate: bob.interpolate({ inputRange: [0, 1], outputRange: ['-1.2deg', '1.2deg'] }) },
        ],
      }}>
      <Animated.View
        style={[
          styles.wake,
          {
            width: width * 1.1,
            height: hullH * 0.35,
            left: -width * 0.05,
            top: height - hullH * 0.28,
            opacity: stroke.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.5, 0.1, 0.5] }),
          },
        ]}
      />
      <Image source={IMAGES.boatBack} style={[styles.layer, { width, height: hullH }]} />
      {oar('left')}
      {oar('right')}
      {passengers}
      <Image source={IMAGES.boatFront} style={[styles.layer, { width, height: hullH }]} pointerEvents="none" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  occupants: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  hidden: {
    opacity: 0,
  },
  wake: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#ffffff',
  },
});
