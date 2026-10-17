import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, Image, ScrollViewInstance, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ICONS, IMAGES } from '../assets/images';
import { Clouds } from '../components/Ambience';
import GlassButton from '../components/GlassButton';
import StageCard from '../components/StageCard';
import { bestScore } from '../game/engine';
import { LEVELS } from '../game/levels';
import { Level } from '../game/types';
import { useSettings } from '../settings';
import { colors, textShadow } from '../theme';

interface Props {
  bestMoves: Record<string, number>;
  onSelect: (level: Level) => void;
  /** Return to the landing screen. */
  onBack: () => void;
}

const GAP = 18;

/** TESTING ONLY: opens every stage regardless of progress. Set back to false before release. */
const UNLOCK_ALL_STAGES = true;

/** The stage list: a snapping carousel where the centred card stands out. */
export default function HomeScreen({ bestMoves, onSelect, onBack }: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const optimal = useMemo(() => Object.fromEntries(LEVELS.map(l => [l.id, bestScore(l)])), []);
  const solved = LEVELS.filter(l => bestMoves[l.id] !== undefined).length;
  /** A stage opens once the one before it has been cleared. */
  const isUnlocked = (i: number) =>
    UNLOCK_ALL_STAGES || i === 0 || bestMoves[LEVELS[i - 1].id] !== undefined;
  // open the carousel on the first stage still to be cleared
  const firstOpen = Math.max(0, LEVELS.findIndex(l => bestMoves[l.id] === undefined));
  const [notice, setNotice] = useState<string | null>(null);

  const float = useRef(new Animated.Value(0)).current;
  const entrance = useRef(LEVELS.map(() => new Animated.Value(0))).current;
  const scrollRef = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    anim.start();
    Animated.stagger(
      90,
      entrance.map(v => Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 9, bounciness: 9 })),
    ).start();
    return () => anim.stop();
  }, [float, entrance]);

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timer = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const padX = Math.max(insets.left, insets.right, 20);
  const cardW = Math.min(W / 5.4, 220);
  const cardH = Math.min(H * 0.62, cardW * 1.5);
  const step = cardW + GAP;
  // side padding lets the first and last cards scroll to the centre
  const sidePad = (W - cardW) / 2;
  const scrollX = useRef(new Animated.Value(firstOpen * step)).current;

  return (
    <View style={styles.root}>
      <Image source={IMAGES.scene} resizeMode="stretch" style={[StyleSheet.absoluteFill, { width: W, height: H }]} />
      <Clouds width={W} height={H} />
      <View style={[StyleSheet.absoluteFill, styles.dim]} />

      <View style={[styles.settings, { top: Math.max(insets.top, 10), right: padX }]}>
        <GlassButton icon={settings.sound ? ICONS.sound : ICONS.soundOff} onPress={settings.toggleSound} accessibilityLabel="Toggle sound" />
        <GlassButton icon={settings.music ? ICONS.music : ICONS.musicOff} onPress={settings.toggleMusic} accessibilityLabel="Toggle music" />
      </View>

      <View style={[styles.back, { top: Math.max(insets.top, 10), left: padX }]}>
        <GlassButton icon={ICONS.back} onPress={onBack} accessibilityLabel="Back" />
      </View>

      <Animated.View
        style={[
          styles.header,
          { marginTop: Math.max(insets.top, 10) },
          { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [-3, 3] }) }] },
        ]}>
        <Text style={[styles.title, { fontSize: Math.min(H * 0.08, 36) }]}>SELECT STAGE</Text>
        <View style={styles.progressChip}>
          <Image source={IMAGES.star} style={styles.progressStar} />
          <Text style={styles.progressText}>
            {solved} / {LEVELS.length} solved
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(solved / LEVELS.length) * 100}%` }]} />
          </View>
        </View>
      </Animated.View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        contentOffset={{ x: firstOpen * step, y: 0 }}
        onLayout={() => scrollRef.current?.scrollTo({ x: firstOpen * step, animated: false })}
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        contentContainerStyle={[styles.carousel, { paddingHorizontal: sidePad, gap: GAP }]}>
        {LEVELS.map((level, i) => {
          // how far this card is from the centre of the screen, in cards
          const inputRange = [-2, -1, 0, 1, 2].map(d => (i + d) * step);
          const focus = (values: number[]) =>
            scrollX.interpolate({ inputRange, outputRange: values, extrapolate: 'clamp' });
          const appear = entrance[i];
          return (
            <Animated.View
              key={level.id}
              style={{
                opacity: Animated.multiply(appear, focus([0.75, 0.92, 1, 0.92, 0.75])),
                transform: [
                  { perspective: 900 },
                  { translateY: Animated.add(appear.interpolate({ inputRange: [0, 1], outputRange: [70, 0] }), focus([16, 8, -10, 8, 16])) },
                  { scale: focus([0.84, 0.93, 1.08, 0.93, 0.84]) },
                  {
                    rotateY: scrollX.interpolate({
                      inputRange,
                      outputRange: ['-28deg', '-14deg', '0deg', '14deg', '28deg'],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              }}>
              <StageCard
                level={level}
                index={i}
                width={cardW}
                height={cardH}
                best={bestMoves[level.id]}
                optimal={optimal[level.id]}
                locked={!isUnlocked(i)}
                onPress={() => onSelect(level)}
                onLockedPress={() => setNotice(`Clear stage ${i} first to unlock this one.`)}
              />
            </Animated.View>
          );
        })}
      </Animated.ScrollView>

      {notice && (
        <View pointerEvents="none" style={[styles.notice, { bottom: Math.max(insets.bottom, 18) }]}>
          <Image source={ICONS.lock} style={styles.noticeIcon} />
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#3a8fe0',
  },
  dim: {
    backgroundColor: 'rgba(8, 24, 52, 0.3)',
  },
  settings: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 8,
    zIndex: 2,
  },
  back: {
    position: 'absolute',
    zIndex: 2,
  },
  header: {
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontWeight: '900',
    letterSpacing: 3,
    textAlign: 'center',
    ...textShadow,
  },
  progressChip: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
  },
  progressStar: {
    width: 18,
    height: 17,
    marginRight: 6,
  },
  progressText: {
    color: '#fff',
    fontWeight: '800',
  },
  progressTrack: {
    width: 60,
    height: 5,
    marginLeft: 10,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.gold,
  },
  notice: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: 'rgba(14, 32, 64, 0.88)',
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
  },
  noticeIcon: {
    width: 16,
    height: 16,
    marginRight: 8,
  },
  noticeText: {
    color: '#fff',
    fontWeight: '800',
  },
  carousel: {
    alignItems: 'center',
    paddingBottom: 10,
  },
});
