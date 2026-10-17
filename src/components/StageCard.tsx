import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ICONS, IMAGES } from '../assets/images';
import { audio } from '../audio';
import { isBridge } from '../game/engine';
import { Level } from '../game/types';
import { colors, DIFFICULTY_COLORS, starsFor } from '../theme';
import Bouncy from './Bouncy';
import { Stars } from './Celebration';

interface Props {
  level: Level;
  index: number;
  width: number;
  height: number;
  /** The player's best score, if they have solved this stage. */
  best?: number;
  /** Best possible score (crossings, or minutes on timed stages). */
  optimal: number;
  /** Locked until the previous stage is cleared. */
  locked: boolean;
  onPress: () => void;
  /** Tapped while locked. */
  onLockedPress: () => void;
}

const DIFFICULTY_STEPS = { Easy: 1, Medium: 2, Hard: 3, Expert: 4 } as const;

/** A stage in the stage list: an illustrated scene with the cast, plus its key facts. */
export default function StageCard({
  level,
  index,
  width,
  height,
  best,
  optimal,
  locked,
  onPress,
  onLockedPress,
}: Props) {
  const night = isBridge(level);
  const solved = best !== undefined;
  const accent = DIFFICULTY_COLORS[level.difficulty];
  const artH = height * 0.6;
  const bob = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  const press = () => {
    if (!locked) {
      onPress();
      return;
    }
    audio.play('sfx_error', 0.7);
    onLockedPress();
    Animated.sequence(
      [10, -10, 7, -7, 3, 0].map(v =>
        Animated.timing(shake, {
          toValue: v,
          duration: 50,
          useNativeDriver: true,
        }),
      ),
    ).start();
  };

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 1300 + (index % 4) * 150,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 1300 + (index % 4) * 150,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [bob, index]);

  const chips: { icon: ImageSourcePropType; label: string; tall?: boolean }[] =
    [
      {
        icon: night ? IMAGES.torch : ICONS.paddle,
        label: `${level.boatCapacity} at once`,
        tall: night,
      },
      { icon: ICONS.people, label: String(level.characters.length) },
    ];
  if (level.timeLimit !== undefined) {
    chips.push({ icon: ICONS.clock, label: `${level.timeLimit} min` });
  }

  return (
    <Animated.View style={{ transform: [{ translateX: shake }] }}>
      <Bouncy
        onPress={press}
        clickSound={!locked}
        style={[
          styles.card,
          { width, height, borderColor: solved ? colors.gold : '#ffffff' },
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: locked }}
        accessibilityLabel={`Stage ${index + 1}: ${level.title}, ${
          level.difficulty
        }${solved ? ', solved' : locked ? ', locked' : ''}`}
      >
        <View style={[styles.art, { height: artH }]}>
          <Image
            source={night ? IMAGES.cardNight : IMAGES.cardDay}
            style={[styles.backdrop, { width, height: artH }]}
            resizeMode="cover"
          />
          <View style={styles.artShade} />

          <View
            style={[
              styles.number,
              {
                backgroundColor: solved
                  ? colors.gold
                  : locked
                  ? '#6b7785'
                  : accent,
              },
            ]}
          >
            {solved ? (
              <Image source={ICONS.check} style={styles.check} />
            ) : (
              <Text style={styles.numberText}>{index + 1}</Text>
            )}
          </View>
          <View style={styles.kind}>
            <Text style={styles.kindText}>
              {night ? 'NIGHT BRIDGE' : 'RIVER'}
            </Text>
          </View>

          <View style={styles.cast}>
            {level.cover.map((img, k) => {
              const big = k === 1;
              const w = width * (big ? 0.36 : 0.28);
              return (
                <Animated.Image
                  key={k}
                  source={img}
                  style={{
                    width: w,
                    height: w * 1.25,
                    marginHorizontal: -width * 0.025,
                    zIndex: big ? 2 : 1,
                    transform: [
                      {
                        translateY: bob.interpolate({
                          inputRange: [0, 1],
                          // neighbours bob out of step with the middle character
                          outputRange: k % 2 ? [0, -5] : [-4, 0],
                        }),
                      },
                    ],
                  }}
                />
              );
            })}
          </View>

          {locked && (
            <View style={styles.lockVeil}>
              <View style={styles.lockBadge}>
                <Image source={ICONS.lock} style={styles.lockIcon} />
              </View>
            </View>
          )}
        </View>

        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
            {level.title}
          </Text>
          <View style={styles.chips}>
            {chips.map(chip => (
              <View key={chip.label} style={styles.chip}>
                <Image
                  source={chip.icon}
                  style={
                    chip.tall
                      ? styles.chipTorch
                      : [styles.chipIcon, { tintColor: '#51606f' }]
                  }
                />
                <Text style={styles.chipText}>{chip.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.footer}>
            <View style={styles.meter}>
              {[1, 2, 3, 4].map(step => (
                <View
                  key={step}
                  style={[
                    styles.meterStep,
                    {
                      backgroundColor:
                        step <= DIFFICULTY_STEPS[level.difficulty]
                          ? accent
                          : '#e2e8f0',
                    },
                  ]}
                />
              ))}
              <Text style={[styles.meterLabel, { color: accent }]}>
                {level.difficulty.toUpperCase()}
              </Text>
            </View>
            {solved ? (
              <Stars
                count={starsFor(best, optimal)}
                size={15}
                animated={false}
              />
            ) : locked ? (
              <View style={[styles.playPill, styles.lockedPill]}>
                <Image source={ICONS.lock} style={styles.playIcon} />
                <Text style={styles.playText}>LOCKED</Text>
              </View>
            ) : (
              <View style={styles.playPill}>
                <Image source={ICONS.play} style={styles.playIcon} />
                <Text style={styles.playText}>PLAY</Text>
              </View>
            )}
          </View>
        </View>
      </Bouncy>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 26,
    borderWidth: 3,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#0a1c3d',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  art: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'hidden',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  artShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  number: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  numberText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  check: {
    width: 16,
    height: 16,
  },
  kind: {
    position: 'absolute',
    top: 11,
    right: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 9,
    backgroundColor: 'rgba(10, 24, 52, 0.55)',
    zIndex: 3,
  },
  kindText: {
    color: '#ffffff',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cast: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  body: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 9,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#eef2f7',
  },
  chipIcon: {
    width: 11,
    height: 11,
    marginRight: 3,
  },
  chipTorch: {
    width: 5,
    height: 13,
    marginRight: 4,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#51606f',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  meterStep: {
    width: 10,
    height: 5,
    borderRadius: 3,
  },
  lockVeil: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockIcon: {
    width: 28,
    height: 28,
  },
  lockedPill: {
    backgroundColor: '#8a96a3',
  },
  playPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 9,
    backgroundColor: colors.primary,
  },
  playIcon: {
    width: 8,
    height: 8,
    marginRight: 3,
  },
  playText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  meterLabel: {
    marginLeft: 4,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
});
