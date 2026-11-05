import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createWorkoutStorage } from './workout-run-storage-core';

export const mealStorage = createWorkoutStorage({
  get: async key => Platform.OS === 'web' ? globalThis.localStorage.getItem(key) : SecureStore.getItemAsync(key),
  set: async (key, value) => { if (Platform.OS === 'web') globalThis.localStorage.setItem(key, value); else await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); },
  remove: async key => { if (Platform.OS === 'web') globalThis.localStorage.removeItem(key); else await SecureStore.deleteItemAsync(key); },
}, 'fit.nutrition');
