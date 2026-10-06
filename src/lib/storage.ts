import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/** Shared persist storage for zustand stores (AsyncStorage works on native and web). */
export const persistStorage = createJSONStorage(() => AsyncStorage);
