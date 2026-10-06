import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

/** When false the app runs fully local (guest profile + on-device library). */
export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

interface FirebaseServices {
  app: FirebaseApp;
  auth: FirebaseAuth.Auth;
  db: Firestore;
}

let services: FirebaseServices | null = null;

function createAuth(app: FirebaseApp): FirebaseAuth.Auth {
  if (Platform.OS === 'web') return FirebaseAuth.getAuth(app);
  // `getReactNativePersistence` only exists in the React Native build of firebase/auth,
  // which Metro resolves on native; the web typings don't declare it.
  const getReactNativePersistence = (FirebaseAuth as unknown as {
    getReactNativePersistence?: (storage: typeof AsyncStorage) => FirebaseAuth.Persistence;
  }).getReactNativePersistence;
  try {
    return FirebaseAuth.initializeAuth(app, {
      persistence: getReactNativePersistence ? getReactNativePersistence(AsyncStorage) : undefined,
    });
  } catch {
    return FirebaseAuth.getAuth(app);
  }
}

export function getFirebase(): FirebaseServices | null {
  if (!isFirebaseConfigured) return null;
  if (services) return services;
  const app = getApps().length ? getApp() : initializeApp(config);
  services = {
    app,
    auth: createAuth(app),
    db: initializeFirestore(app, { ignoreUndefinedProperties: true }),
  };
  return services;
}
