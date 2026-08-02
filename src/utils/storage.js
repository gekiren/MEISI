import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * React Native (Expo / Hermes) 専用の AsyncStorage 永続化ストレージユーティリティ
 * Webブラウザ (localStorage) への依存を一切排除した非同期構造
 */
export const safeStorage = {
  getItem: async (key) => {
    try {
      return await AsyncStorage.getItem(key);
    } catch (e) {
      console.warn(`AsyncStorage getItem error for key "${key}":`, e);
      return null;
    }
  },

  setItem: async (key, value) => {
    try {
      if (value === null || value === undefined) {
        await AsyncStorage.removeItem(key);
      } else {
        await AsyncStorage.setItem(key, String(value));
      }
    } catch (e) {
      console.warn(`AsyncStorage setItem error for key "${key}":`, e);
    }
  },

  removeItem: async (key) => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn(`AsyncStorage removeItem error for key "${key}":`, e);
    }
  }
};
