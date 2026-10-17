import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import { audio } from '../audio';

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Play the UI click sound on press (default true). */
  clickSound?: boolean;
  children?: React.ReactNode;
}

/** Pressable that squashes on touch and springs back. */
export default function Bouncy({ style, clickSound = true, onPress, disabled, children, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (value: number) =>
    Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 40, bounciness: 12 }).start();

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPressIn={() => to(0.9)}
      onPressOut={() => to(1)}
      onPress={e => {
        if (clickSound) {
          audio.play('sfx_click', 0.6);
        }
        onPress?.(e);
      }}>
      <Animated.View style={[style, { transform: [{ scale }] }, disabled && { opacity: 0.45 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
