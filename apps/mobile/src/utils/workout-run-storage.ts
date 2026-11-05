import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createWorkoutStorage } from './workout-run-storage-core';

// Two generations: the pointer changes only after every encrypted chunk is durable.
const raw = {
  get: async (key: string) => Platform.OS === 'web' ? globalThis.localStorage.getItem(key) : SecureStore.getItemAsync(key),
  set: async (key: string, value: string) => { if (Platform.OS === 'web') globalThis.localStorage.setItem(key, value); else await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); },
  remove: async (key: string) => { if (Platform.OS === 'web') globalThis.localStorage.removeItem(key); else await SecureStore.deleteItemAsync(key); },
};
const storage = createWorkoutStorage(raw);
export const readWorkoutStorage = storage.read;
export const writeWorkoutStorage = storage.write;
export const clearWorkoutStorage = storage.clear;
