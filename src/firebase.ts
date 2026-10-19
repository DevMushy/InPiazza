import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, type Auth
} from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { CONFIG, firebaseConfigured } from './config';

// Nessun Analytics, nessun Crashlytics, nessun Performance: l'app non traccia chi la usa.
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (firebaseConfigured) {
  app = initializeApp(CONFIG.firebase);
  // Nella WebView di iOS getAuth() può bloccarsi: si usa initializeAuth con persistenza esplicita
  auth = initializeAuth(app, {
    persistence: Capacitor.isNativePlatform() ? indexedDBLocalPersistence : [indexedDBLocalPersistence, browserLocalPersistence]
  });
  auth.languageCode = 'it';
  // cache offline condivisa tra più schede aperte (con una sola scheda, la seconda restava senza dati)
  try {
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    db = initializeFirestore(app, {});
  }
}

export { app, auth, db };
