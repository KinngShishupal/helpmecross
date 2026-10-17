import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  Image,
  LayoutAnimation,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AD_UNITS, ADS_PER_HINT, showAdsInARow } from '../ads';
import { ICONS, IMAGES } from '../assets/images';
import { audio } from '../audio';
import { Clouds, RiverRipples } from '../components/Ambience';
import Boat, { boatContainerHeight, occupantRatio, SEAT_GAP, seatBottom } from '../components/Boat';
import Bouncy from '../components/Bouncy';
import { Confetti, HeroImage, Stars } from '../components/Celebration';
import CharacterSprite from '../components/CharacterSprite';
import Dialog, { DialogButton } from '../components/Dialog';
import GlassButton from '../components/GlassButton';
import {
  bestScore,
  cross,
  crossingTime,
  departureError,
  findViolation,
  initialState,
  isBridge,
  isWon,
  pathTime,
  solve,
  timeUp,
  vocab,
} from '../game/engine';
import { Bank, Character, GameState, Level } from '../game/types';
import { useSettings } from '../settings';
import { colors, starsFor } from '../theme';

type Status = 'playing' | 'crossing' | 'lost' | 'won';

/** A position in the game, plus who rowed across to reach it. */
interface Turn {
  state: GameState;
  group: string[];
  /** Minutes used so far (timed levels). */
  elapsed: number;
}

interface Props {
  level: Level;
  onExit: () => void;
  onWin: (levelId: string, moves: number) => void;
  /** Go straight to the next stage (absent on the last stage). */
  onNext?: () => void;
}

const CROSSING_MS = 1400;
const HOP_MS = 440;

/** Top-left corner and width of a character image on screen. */
interface Spot {
  x: number;
  y: number;
  w: number;
}

interface Hop {
  id: string;
  from: Spot;
  to: Spot;
}

export default function GameScreen({ level, onExit, onWin, onNext }: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const settings = useSettings();

  const timed = level.timeLimit !== undefined;
  const bridgeLevel = isBridge(level);
  const words = vocab(level);
  /** Best possible crossings (untimed) or minutes (timed). */
  const optimal = useMemo(() => bestScore(level), [level]);
  const charById = useMemo(
    () => Object.fromEntries(level.characters.map(c => [c.id, c])) as Record<string, Character>,
    [level],
  );

  const [history, setHistory] = useState<Turn[]>(() => [{ state: initialState(level), group: [], elapsed: 0 }]);
  const [boat, setBoat] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>('playing');
  const [failure, setFailure] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [hinted, setHinted] = useState<string[]>([]);
  const [showRules, setShowRules] = useState(true);
  const [hop, setHop] = useState<Hop | null>(null);
  const [landed, setLanded] = useState<string | null>(null);
  /** The hint offer dialog ("watch ads for a hint"). */
  const [hintOffer, setHintOffer] = useState(false);
  /** Which ad is playing (1-based) while a hint is being earned, or 0. */
  const [adNumber, setAdNumber] = useState(0);

  const boatX = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const noticeAnim = useRef(new Animated.Value(0)).current;
  const rowPulse = useRef(new Animated.Value(0)).current;
  const hopAnim = useRef(new Animated.Value(0)).current;

  const state = history[history.length - 1].state;
  const elapsed = history[history.length - 1].elapsed;
  const moves = history.length - 1;
  const busy = status !== 'playing' || hop !== null || adNumber > 0;
  const readyToRow = !busy && departureError(level, boat) === null;

  // ---------------------------------------------------------------- layout --
  const riverL = W * 0.24;
  const riverR = W * 0.76;
  const boatW = Math.min(W * 0.19, 300);
  const boatH = boatContainerHeight(boatW);
  // the boat floats lower in the river; walkers stand on the bridge deck
  const boatTop = (bridgeLevel ? H * 0.712 : H * 0.765) - boatH;
  const boatStartX = riverL + W * 0.006;
  const boatGoalX = riverR - boatW - W * 0.006;

  const n = level.characters.length;
  const cols = n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const zoneTop = H * 0.4;
  const zoneH = H * 0.57;
  const zoneW = W * 0.175;
  const spriteW = Math.min(zoneW / cols - 6, (zoneH / rows - 20) / 1.25, 64);
  const cellW = zoneW / cols;
  const cellH = zoneH / rows;

  const slotPosition = (bank: Bank, index: number) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const zoneLeft = bank === 'start' ? Math.max(insets.left, W * 0.015) : W - Math.max(insets.right, W * 0.015) - zoneW;
    return {
      left: zoneLeft + col * cellW + (cellW - spriteW) / 2,
      top: zoneTop + row * cellH + (cellH - spriteW * 1.25 - 16) / 2,
    };
  };

  const bankSpot = (bank: Bank, index: number): Spot => {
    const pos = slotPosition(bank, index);
    return { x: pos.left, y: pos.top, w: spriteW };
  };

  /** Where passenger `index` of `count` sits in the docked boat. */
  const seatSpot = (index: number, count: number): Spot => {
    const w = boatW * occupantRatio(level.boatCapacity);
    const rowW = count * w + (count - 1) * SEAT_GAP;
    const boatLeft = state.boatSide === 'goal' ? boatGoalX : boatStartX;
    return {
      x: boatLeft + (boatW - rowW) / 2 + index * (w + SEAT_GAP),
      y: boatTop + boatH - seatBottom(boatW, level.setting ?? 'river') - w * 1.25,
      w,
    };
  };

  // ------------------------------------------------------------- effects --
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onExit();
      return true;
    });
    return () => sub.remove();
  }, [onExit]);

  useEffect(() => {
    if (!notice) {
      return;
    }
    noticeAnim.setValue(0);
    Animated.spring(noticeAnim, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 8 }).start();
    const timer = setTimeout(
      () => Animated.timing(noticeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setNotice(null)),
      3800,
    );
    return () => clearTimeout(timer);
  }, [notice, noticeAnim]);

  useEffect(() => {
    if (!readyToRow) {
      rowPulse.setValue(0);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(rowPulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(rowPulse, { toValue: 0, duration: 650, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [readyToRow, rowPulse]);

  // ------------------------------------------------------------- actions --
  const say = (text: string, sound: 'sfx_error' | null = 'sfx_error') => {
    if (sound) {
      audio.play(sound, 0.7);
    }
    setNotice(text);
  };

  const toggleCharacter = (id: string) => {
    if (busy) {
      return;
    }
    setHinted([]);
    const index = level.characters.findIndex(c => c.id === id);
    if (boat.includes(id)) {
      audio.play('sfx_unboard');
      jump(id, seatSpot(boat.indexOf(id), boat.length), bankSpot(state.boatSide, index), () =>
        setBoat(b => b.filter(x => x !== id)),
      );
    } else if (state.positions[id] !== state.boatSide) {
      say(words.wrongSide);
    } else if (boat.length >= level.boatCapacity) {
      say(words.full(level.boatCapacity));
    } else {
      audio.play('sfx_board');
      jump(id, bankSpot(state.boatSide, index), seatSpot(boat.length, boat.length + 1), () => setBoat(b => [...b, id]));
    }
  };

  /** Animates a character hopping between the bank and the boat, then commits the move. */
  const jump = (id: string, from: Spot, to: Spot, commit: () => void) => {
    setHop({ id, from, to });
    hopAnim.setValue(0);
    Animated.timing(hopAnim, { toValue: 1, duration: HOP_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start(() => {
      // let anyone already in the boat glide aside instead of snapping
      LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
      commit();
      setLanded(id);
      setHop(null);
    });
  };

  const go = () => {
    if (busy) {
      return;
    }
    const error = departureError(level, boat);
    if (error) {
      say(error);
      return;
    }
    const group = boat;
    const next = cross(state, group);
    const minutes = crossingTime(level, group);
    const nextElapsed = elapsed + minutes;
    setHinted([]);
    setStatus('crossing');
    audio.play(bridgeLevel ? 'sfx_walk' : 'sfx_row');
    Animated.timing(boatX, {
      toValue: next.boatSide === 'goal' ? 1 : 0,
      // slow walkers visibly take longer
      duration: timed ? Math.min(2400, 800 + minutes * 140) : CROSSING_MS,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      audio.play('sfx_arrive', 0.8);
      // passengers stay in the boat until the player taps them ashore
      setHistory(h => [...h, { state: next, group, elapsed: nextElapsed }]);
      const violation = findViolation(level, next, group) ?? timeUp(level, nextElapsed);
      if (violation) {
        lose(violation);
      } else if (isWon(level, next)) {
        win(timed ? nextElapsed : moves + 1);
      } else {
        setStatus('playing');
      }
    });
  };

  const lose = (message: string) => {
    setFailure(message);
    setStatus('lost');
    audio.play('sfx_lose');
    flash.setValue(1);
    Animated.parallel([
      Animated.timing(flash, { toValue: 0, duration: 700, useNativeDriver: true }),
      Animated.sequence(
        [12, -12, 9, -9, 5, -5, 0].map(v => Animated.timing(shake, { toValue: v, duration: 55, useNativeDriver: true })),
      ),
    ]).start(() => setShowResult(true));
  };

  const win = (score: number) => {
    setStatus('won');
    audio.play('sfx_win');
    onWin(level.id, score);
    setTimeout(() => setShowResult(true), 500);
  };

  const resetTo = (nextHistory: Turn[], nextBoat: string[] = []) => {
    const last = nextHistory[nextHistory.length - 1].state;
    boatX.stopAnimation();
    boatX.setValue(last.boatSide === 'goal' ? 1 : 0);
    setHistory(nextHistory);
    setBoat(nextBoat);
    setFailure(null);
    setShowResult(false);
    setHinted([]);
    setStatus('playing');
  };

  const undo = () => {
    if (status === 'crossing' || history.length <= 1) {
      return;
    }
    // undoing a crossing returns its passengers to the boat on the side they left from
    resetTo(history.slice(0, -1), history[history.length - 1].group);
  };

  const restart = () => resetTo([{ state: initialState(level), group: [], elapsed: 0 }]);

  const hint = () => {
    if (busy) {
      return;
    }
    if (!solve(level, state, elapsed)?.length) {
      // nothing to earn: say so straight away instead of showing ads
      say(timed ? 'You can no longer make it in time. Try undoing a few moves.' : 'No solution from here. Try undoing a few moves.');
      return;
    }
    setHintOffer(true);
  };

  /** Plays the ads one after another, then reveals the hint. */
  const watchAdsForHint = async () => {
    setHintOffer(false);
    audio.setMusic(false);
    try {
      await showAdsInARow(ADS_PER_HINT, setAdNumber);
    } finally {
      setAdNumber(0);
      audio.setMusic(settings.music);
    }
    revealHint();
  };

  const revealHint = () => {
    const path = solve(level, state, elapsed);
    if (!path || path.length === 0) {
      return;
    }
    setHinted(path[0]);
    const togo = timed ? `${path.length} crossings and ${pathTime(level, path)} minutes to go.` : `${path.length} crossings to go.`;
    say(`Hint: send ${path[0].map(id => charById[id].name).join(' and ')} across. ${togo}`, null);
  };

  // ------------------------------------------------------------- render --
  const score = timed ? elapsed : moves;
  const stars = starsFor(score, optimal);
  const occupants = boat.map(id => charById[id]);

  return (
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: shake }] }]}>
        <Image
          source={bridgeLevel ? IMAGES.sceneNight : IMAGES.scene}
          resizeMode="stretch"
          style={{ position: 'absolute', left: -14, top: 0, width: W + 28, height: H }}
        />
        {!bridgeLevel && <Clouds width={W} height={H} />}
        {!bridgeLevel && <RiverRipples left={riverL + W * 0.035} top={H * 0.56} width={riverR - riverL - W * 0.07} height={H * 0.44} />}

        {level.characters.map((c, index) => {
          const bank = state.positions[c.id];
          if (boat.includes(c.id) || hop?.id === c.id) {
            return null;
          }
          const pos = slotPosition(bank, index);
          return (
            <View key={`${c.id}-${bank}`} style={[styles.slot, pos]}>
              <CharacterSprite
                character={c}
                width={spriteW}
                disabled={busy}
                highlighted={hinted.includes(c.id)}
                instant={landed === c.id}
                hideRowBadge={bridgeLevel}
                onPress={() => toggleCharacter(c.id)}
              />
            </View>
          );
        })}

        <Animated.View
          style={{
            position: 'absolute',
            top: boatTop,
            left: 0,
            transform: [{ translateX: boatX.interpolate({ inputRange: [0, 1], outputRange: [boatStartX, boatGoalX] }) }],
          }}>
          <Boat
            width={boatW}
            capacity={level.boatCapacity}
            setting={level.setting ?? 'river'}
            side={state.boatSide}
            occupants={occupants}
            rowing={status === 'crossing'}
            disabled={busy}
            onPressOccupant={toggleCharacter}
            hiddenId={hop?.id}
            landedId={landed}
          />
        </Animated.View>

        {hop && <HoppingCharacter hop={hop} progress={hopAnim} character={charById[hop.id]} />}
      </Animated.View>

      {/* top bar */}
      <View style={[styles.topBar, { top: Math.max(insets.top, 8), left: Math.max(insets.left, 12), right: Math.max(insets.right, 12) }]}>
        <GlassButton icon={ICONS.back} onPress={onExit} accessibilityLabel="Back to levels" />
        <View style={styles.titleChip}>
          <Text style={styles.title} numberOfLines={1}>
            {level.title}
          </Text>
          {timed ? (
            <>
              <Text style={styles.stats}>
                Time {elapsed} / {level.timeLimit} min  ·  Moves {moves}
              </Text>
              <View style={styles.timeTrack}>
                <View
                  style={[
                    styles.timeFill,
                    {
                      width: `${Math.min(100, (elapsed / level.timeLimit!) * 100)}%`,
                      backgroundColor: elapsed > level.timeLimit! ? colors.danger : colors.gold,
                    },
                  ]}
                />
              </View>
            </>
          ) : (
            <Text style={styles.stats}>
              Moves {moves}  ·  Best {optimal}
            </Text>
          )}
        </View>
        <View style={styles.spacer} />
        <GlassButton icon={ICONS.hint} onPress={hint} disabled={busy} accessibilityLabel="Hint" />
        <GlassButton icon={ICONS.undo} onPress={undo} disabled={moves === 0 || status === 'crossing'} accessibilityLabel="Undo" />
        <GlassButton icon={ICONS.reset} onPress={restart} disabled={status === 'crossing'} accessibilityLabel="Restart" />
        <GlassButton icon={ICONS.rules} onPress={() => setShowRules(true)} accessibilityLabel="Rules" />
        <GlassButton icon={settings.sound ? ICONS.sound : ICONS.soundOff} onPress={settings.toggleSound} accessibilityLabel="Toggle sound" />
        <GlassButton icon={settings.music ? ICONS.music : ICONS.musicOff} onPress={settings.toggleMusic} accessibilityLabel="Toggle music" />
      </View>

      {/* row button */}
      <Animated.View
        style={[
          styles.rowWrap,
          {
            left: (riverL + riverR) / 2 - 65,
            bottom: Math.max(insets.bottom, H * 0.035),
            transform: [{ scale: rowPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) }],
          },
        ]}>
        <Bouncy onPress={go} disabled={busy || boat.length === 0} clickSound={false} style={styles.rowButton} accessibilityRole="button" accessibilityLabel={bridgeLevel ? 'Walk across' : 'Row across'}>
          <Image source={bridgeLevel ? IMAGES.torch : ICONS.paddle} style={bridgeLevel ? styles.torchIcon : styles.rowIcon} />
          <Text style={styles.rowText}>{bridgeLevel ? 'WALK' : 'ROW'}</Text>
        </Bouncy>
      </Animated.View>

      {notice && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.notice,
            {
              top: Math.max(insets.top, 8) + 48,
              opacity: noticeAnim,
              transform: [{ translateY: noticeAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
            },
          ]}>
          <Text style={styles.noticeText}>{notice}</Text>
        </Animated.View>
      )}

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, { opacity: flash }]} />
      {status === 'won' && <Confetti width={W} height={H} />}

      {/* hint offer */}
      <Dialog visible={hintOffer} onRequestClose={() => setHintOffer(false)} width={Math.min(W * 0.5, 440)}>
        <Image source={ICONS.hint} style={styles.hintIcon} />
        <Text style={styles.dialogTitle}>Need a hint?</Text>
        <Text style={styles.dialogText}>Watch {ADS_PER_HINT} short ads and we will show you the next move.</Text>
        <View style={styles.dialogButtons}>
          <DialogButton label="NO THANKS" onPress={() => setHintOffer(false)} />
          <DialogButton label="WATCH ADS" onPress={watchAdsForHint} primary />
        </View>
      </Dialog>

      {adNumber > 0 && (
        <View style={[StyleSheet.absoluteFill, styles.adOverlay]}>
          <Text style={styles.adOverlayText}>
            Ad {adNumber} of {ADS_PER_HINT}
          </Text>
          <Text style={styles.adOverlaySub}>Your hint is on its way...</Text>
        </View>
      )}

      {/* rules */}
      <Dialog visible={showRules} onRequestClose={() => setShowRules(false)} width={Math.min(W * 0.82, 780)}>
        <Text style={styles.dialogTitle}>{level.title}</Text>
        <Text style={styles.dialogText}>{level.description}</Text>
        <View style={styles.rulesBody}>
          <View style={styles.cast}>
            {level.characters
              .filter((c, i, all) => all.findIndex(o => o.image === c.image) === i)
              .map(c => (
                <View key={c.id} style={styles.castItem}>
                  <Image source={c.image} style={styles.castImage} />
                  <Text style={styles.castName}>{c.name}</Text>
                  {c.canRow && !bridgeLevel && (
                    <View style={styles.castRower}>
                      <Image source={ICONS.paddle} style={styles.castRowerIcon} />
                    </View>
                  )}
                </View>
              ))}
          </View>
          <ScrollView style={[styles.rules, { maxHeight: H * 0.42 }]}>
            {level.rules.map(rule => (
              <View key={rule} style={styles.ruleRow}>
                <View style={styles.ruleDot} />
                <Text style={styles.rule}>{rule}</Text>
              </View>
            ))}
            {!bridgeLevel && (
              <View style={styles.ruleRow}>
                <View style={[styles.ruleDot, { backgroundColor: colors.gold }]} />
                <Text style={styles.rule}>Characters with a gold paddle badge can row.</Text>
              </View>
            )}
          </ScrollView>
        </View>
        <View style={styles.dialogButtons}>
          <DialogButton label="PLAY" onPress={() => setShowRules(false)} primary />
        </View>
      </Dialog>

      {/* result */}
      <Dialog visible={showResult} onRequestClose={onExit} width={Math.min(W * 0.6, 540)}>
        {status === 'won' ? (
          <>
            <HeroImage source={IMAGES.trophy} size={Math.min(H * 0.2, 110)} />
            <Text style={styles.dialogTitle}>Puzzle solved!</Text>
            <Stars count={stars} size={Math.min(H * 0.11, 52)} />
            <Text style={styles.dialogText}>
              {timed ? `Everyone made it across in ${elapsed} minutes.` : `${moves} crossings.`}{' '}
              {stars === 3 ? 'A perfect solution!' : `The best possible is ${optimal}. Can you match it?`}
            </Text>
            <View style={styles.dialogButtons}>
              <DialogButton label="REPLAY" onPress={restart} />
              <DialogButton label="STAGES" onPress={onExit} primary={!onNext} />
              {onNext && <DialogButton label="NEXT" onPress={onNext} primary />}
            </View>
            <View style={styles.banner}>
              <BannerAd unitId={AD_UNITS.banner} size={BannerAdSize.BANNER} />
            </View>
          </>
        ) : (
          <>
            <HeroImage source={IMAGES.splash} size={Math.min(H * 0.2, 100)} />
            <Text style={[styles.dialogTitle, { color: colors.danger }]}>Oops!</Text>
            <Text style={styles.dialogText}>{failure}</Text>
            <View style={styles.dialogButtons}>
              <DialogButton label="RESTART" onPress={restart} />
              <DialogButton label="UNDO" onPress={undo} primary />
            </View>
            <View style={styles.banner}>
              <BannerAd unitId={AD_UNITS.banner} size={BannerAdSize.BANNER} />
            </View>
          </>
        )}
      </Dialog>
    </View>
  );
}

/** The character mid-air: follows an arc while resizing from its start spot to its end spot. */
function HoppingCharacter({ hop, progress, character }: { hop: Hop; progress: Animated.Value; character: Character }) {
  const { from, to } = hop;
  const h = (w: number) => w * 1.25;
  // translate so the (end-sized) image's centre starts over the start spot's centre
  const startX = from.x + from.w / 2 - to.w / 2;
  const startY = from.y + h(from.w) / 2 - h(to.w) / 2;
  const height = Math.max(40, Math.abs(to.x - startX) * 0.25);
  const samples = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
  const dir = to.x > startX ? 1 : -1;
  return (
    <Animated.Image
      source={character.image}
      pointerEvents="none"
      style={[
        styles.hopper,
        {
          width: to.w,
          height: h(to.w),
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [startX, to.x] }) },
            {
              translateY: progress.interpolate({
                inputRange: samples,
                outputRange: samples.map(t => startY + (to.y - startY) * t - height * 4 * t * (1 - t)),
              }),
            },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [from.w / to.w, 1] }) },
            { rotate: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['0deg', `${dir * 10}deg`, '0deg'] }) },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  hopper: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  root: {
    flex: 1,
    backgroundColor: '#4f9e3e',
    overflow: 'hidden',
  },
  slot: {
    position: 'absolute',
  },
  topBar: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleChip: {
    marginLeft: 4,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 18,
    backgroundColor: colors.glass,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  stats: {
    color: '#dbeafe',
    fontSize: 11,
    fontWeight: '700',
  },
  spacer: {
    flex: 1,
  },
  rowWrap: {
    position: 'absolute',
    width: 130,
  },
  rowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    borderBottomWidth: 5,
    borderBottomColor: colors.primaryDark,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  banner: {
    alignItems: 'center',
    marginTop: 12,
    minHeight: 50,
  },
  hintIcon: {
    width: 56,
    height: 56,
    alignSelf: 'center',
    tintColor: colors.gold,
  },
  adOverlay: {
    backgroundColor: 'rgba(5, 15, 35, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adOverlayText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  adOverlaySub: {
    color: '#dbeafe',
    fontSize: 14,
    marginTop: 6,
  },
  torchIcon: {
    width: 11,
    height: 30,
    marginRight: 10,
  },
  timeTrack: {
    height: 4,
    marginTop: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    overflow: 'hidden',
  },
  timeFill: {
    height: 4,
    borderRadius: 2,
  },
  rowIcon: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  rowText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 3,
  },
  notice: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '60%',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(14, 32, 64, 0.82)',
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
  },
  noticeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  flash: {
    backgroundColor: '#ff1744',
  },
  dialogTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    marginTop: 4,
  },
  dialogText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    marginVertical: 8,
  },
  dialogButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  rulesBody: {
    flexDirection: 'row',
    gap: 16,
  },
  cast: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignContent: 'center',
    backgroundColor: '#e8f5e0',
    borderRadius: 18,
    padding: 8,
  },
  castItem: {
    alignItems: 'center',
    margin: 4,
  },
  castImage: {
    width: 52,
    height: 65,
  },
  castName: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
  },
  castRower: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  castRowerIcon: {
    width: 11,
    height: 11,
  },
  rules: {
    flex: 1.3,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  ruleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
    marginRight: 10,
  },
  rule: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
});
