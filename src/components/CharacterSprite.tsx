import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ICONS } from '../assets/images';
import { Character } from '../game/types';
import { colors } from '../theme';

interface Props {
  character: Character;
  width: number;
  onPress: () => void;
  disabled?: boolean;
  /** Pulsing glow, used to point out hinted characters. */
  highlighted?: boolean;
  /** Hide the name label and ground shadow (used inside the boat). */
  inBoat?: boolean;
  /** Skip the pop-in (the character just hopped here). */
  instant?: boolean;
  /** Hide the gold paddle badge (bridge levels have no rowing). */
  hideRowBadge?: boolean;
}

/** An illustrated character that idles, pops in when it appears and can glow. */
export default function CharacterSprite({ character, width, onPress, disabled, highlighted, inBoat, instant, hideRowBadge }: Props) {
  const height = width * 1.25;
  const tagSize = Math.max(17, width * 0.28);
  const appear = useRef(new Animated.Value(instant ? 1 : 0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(appear, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 14 }).start();
    const idle = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1100 + Math.random() * 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1100 + Math.random() * 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    idle.start();
    return () => idle.stop();
  }, [appear, breathe]);

  useEffect(() => {
    if (!highlighted) {
      glow.setValue(0);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [highlighted, glow]);

  const scaleY = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${character.name}${character.canRow ? ', can row' : ''}`}
      style={{ width, height: height + (inBoat ? 0 : 16), alignItems: 'center' }}>
      <Animated.View
        style={{
          opacity: appear,
          transform: [
            { translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) },
            { scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
          ],
        }}>
        {!inBoat && (
          <Animated.View
            style={[
              styles.glow,
              { width: width * 0.95, height: width * 0.32, left: width * 0.025, top: height - width * 0.2, opacity: glow },
            ]}
          />
        )}
        {!inBoat && (
          <View style={[styles.shadow, { width: width * 0.62, height: width * 0.16, left: width * 0.19, top: height - width * 0.11 }]} />
        )}
        <Animated.View style={{ transform: [{ translateY: height * 0.5 }, { scaleY }, { translateY: -height * 0.5 }] }}>
          <Image source={character.image} style={{ width, height }} resizeMode="contain" />
        </Animated.View>
        {character.canRow && !hideRowBadge && (
          <View style={[styles.badge, styles.rowBadge, { width: width * 0.3, height: width * 0.3, borderRadius: width * 0.15 }]}>
            <Image source={ICONS.paddle} style={{ width: width * 0.19, height: width * 0.19 }} />
          </View>
        )}
        {character.tag && (
          <View
            style={[
              styles.badge,
              styles.tagBadge,
              { backgroundColor: character.tag.color, width: tagSize, height: tagSize, borderRadius: tagSize / 2 },
            ]}>
            <Text style={[styles.tagText, { fontSize: Math.max(8, tagSize * 0.5) }]}>{character.tag.label}</Text>
          </View>
        )}
        {!inBoat && (
          <View style={[styles.labelWrap, { left: -width * 0.4, right: -width * 0.4 }]}>
            <View style={styles.label}>
              <Text style={[styles.labelText, { fontSize: Math.max(9, Math.min(12, width * 0.18)) }]} numberOfLines={1}>
                {character.name}
              </Text>
            </View>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    position: 'absolute',
    borderRadius: 100,
    backgroundColor: 'rgba(0, 30, 0, 0.28)',
  },
  glow: {
    position: 'absolute',
    borderRadius: 100,
    backgroundColor: '#fff36b',
    shadowColor: '#fff36b',
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 0,
  },
  badge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  rowBadge: {
    top: 0,
    left: 0,
    backgroundColor: colors.gold,
  },
  tagBadge: {
    top: 0,
    right: 0,
  },
  tagText: {
    color: '#fff',
    fontWeight: '900',
  },
  labelWrap: {
    position: 'absolute',
    bottom: -14,
    alignItems: 'center',
  },
  label: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(14, 32, 64, 0.6)',
  },
  labelText: {
    color: '#fff',
    fontWeight: '800',
  },
});
