import type { ComponentProps } from 'react';
import { Pressable as NativePressable } from 'react-native';

/**
 * Drop-in Pressable that always answers the touch: while pressed (and enabled) the control dims slightly.
 * Styles given as a function still receive the press state and can add their own feedback on top.
 */
export function Pressable({ style, ...props }: ComponentProps<typeof NativePressable>) {
  return <NativePressable {...props} style={state => [typeof style === 'function' ? style(state) : style, state.pressed && !props.disabled && pressed]}/>;
}
const pressed = { opacity: .7 };
