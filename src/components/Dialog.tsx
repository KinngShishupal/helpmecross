import React, { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors } from '../theme';
import Bouncy from './Bouncy';

interface Props {
  visible: boolean;
  onRequestClose: () => void;
  children: React.ReactNode;
  width?: number;
}

/** Centered card that springs in over a dimmed backdrop. */
export default function Dialog({ visible, onRequestClose, children, width }: Props) {
  const { width: W, height: H } = useWindowDimensions();
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      pop.setValue(0);
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 10 }).start();
    }
  }, [visible, pop]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose} supportedOrientations={['landscape']} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.card,
            {
              width: width ?? Math.min(W * 0.62, 600),
              maxHeight: H * 0.9,
              transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
              opacity: pop,
            },
          ]}>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

export function DialogButton({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Bouncy onPress={onPress} style={[styles.button, primary ? styles.primary : styles.secondary]} accessibilityRole="button">
      <Text style={[styles.buttonText, primary && styles.primaryText]}>{label}</Text>
    </Bouncy>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 15, 35, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fffdf8',
    borderRadius: 28,
    padding: 20,
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  button: {
    minWidth: 140,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 18,
    alignItems: 'center',
    marginHorizontal: 6,
    borderBottomWidth: 4,
  },
  primary: {
    backgroundColor: colors.primary,
    borderBottomColor: colors.primaryDark,
  },
  secondary: {
    backgroundColor: '#e8eef5',
    borderBottomColor: '#c5d0dc',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 0.5,
  },
  primaryText: {
    color: '#fff',
  },
});
