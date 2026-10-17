import React from 'react';
import { Image, ImageSourcePropType, StyleSheet } from 'react-native';
import { colors } from '../theme';
import Bouncy from './Bouncy';

interface Props {
  icon: ImageSourcePropType;
  onPress: () => void;
  size?: number;
  disabled?: boolean;
  accessibilityLabel: string;
}

export default function GlassButton({ icon, onPress, size = 36, disabled, accessibilityLabel }: Props) {
  return (
    <Bouncy
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={[styles.button, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image source={icon} style={{ width: size * 0.52, height: size * 0.52 }} />
    </Bouncy>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
  },
});
