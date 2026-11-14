import { Platform, Vibration } from 'react-native';

/** Short tactile tick for a confirmed action. Android only: iOS ignores the duration and would buzz for ~400 ms. */
export const tapFeedback = (ms = 12) => { if (Platform.OS === 'android') Vibration.vibrate(ms); };
