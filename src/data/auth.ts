import { useEffect, useState } from 'react';
import {
  onAuthStateChanged, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
  signOut as fbSignOut, deleteUser, type User, type ActionCodeSettings
} from 'firebase/auth';
import { doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { auth, db } from '../firebase';
import { CONFIG } from '../config';

const EMAIL_KEY = 'inpiazza:emailForSignIn';

export interface AccessRequest { orgName: string; note: string; status: 'pending' | 'rejected' }
export interface Session {
  loading: boolean;
  user: User | null;
  isOrganizer: boolean;
  isAdmin: boolean;
  orgName: string | null;
  request: AccessRequest | null;
}

function actionSettings(): ActionCodeSettings {
  return {
    // sul web il link torna dove sei (anche localhost); nelle app native va al dominio pubblico
    url: (Capacitor.isNativePlatform() ? CONFIG.publicUrl : window.location.origin).replace(/\/$/, '') + '/accedi',
    handleCodeInApp: true,
    iOS: { bundleId: CONFIG.iosBundleId },
    android: { packageName: CONFIG.androidPackage, installApp: false }
  };
}

export async function sendLoginLink(email: string) {
  if (!auth) throw new Error('Firebase non configurato');
  await sendSignInLinkToEmail(auth, email, actionSettings());
  try { localStorage.setItem(EMAIL_KEY, email); } catch { /* storage non disponibile */ }
}

/** Completa l'accesso se l'URL è un link email. Ritorna true se ha gestito il link. */
export async function completeLogin(url: string, askEmail: () => Promise<string | null>): Promise<boolean> {
  if (!auth || !isSignInWithEmailLink(auth, url)) return false;
  let email: string | null = null;
  try { email = localStorage.getItem(EMAIL_KEY); } catch { /* */ }
  if (!email) email = await askEmail();
  if (!email) return false;
  await signInWithEmailLink(auth, email, url);
  try { localStorage.removeItem(EMAIL_KEY); } catch { /* */ }
  if (!Capacitor.isNativePlatform()) window.history.replaceState(null, '', '/');
  return true;
}

/** Sulle app native il link email arriva come universal link / app link */
export function listenNativeLinks(handler: (url: string) => void) {
  if (!Capacitor.isNativePlatform()) return () => {};
  const p = CapApp.addListener('appUrlOpen', e => handler(e.url));
  return () => { p.then(h => h.remove()); };
}

export async function signOut() { if (auth) await fbSignOut(auth); }

export async function requestAccess(user: User, orgName: string, note: string) {
  if (!db) return;
  await setDoc(doc(db, 'accessRequests', user.uid), {
    orgName: orgName.trim(), note: note.trim(), email: user.email, status: 'pending', createdAt: serverTimestamp()
  });
}
export async function withdrawRequest(user: User) {
  if (db) await deleteDoc(doc(db, 'accessRequests', user.uid));
}

/** Cancella richiesta, ruolo organizzatore e account. Le manifestazioni pubblicate restano finché non le elimini. */
export async function deleteAccount(user: User) {
  if (db) {
    await deleteDoc(doc(db, 'accessRequests', user.uid)).catch(() => {});
    await deleteDoc(doc(db, 'organizers', user.uid)).catch(() => {});
  }
  await deleteUser(user);
}

export function useSession(): Session {
  const [s, setS] = useState<Session>({ loading: !!auth, user: null, isOrganizer: false, isAdmin: false, orgName: null, request: null });
  useEffect(() => {
    if (!auth || !db) return;
    let unsubs: (() => void)[] = [];
    const clear = () => { unsubs.forEach(u => u()); unsubs = []; };
    const off = onAuthStateChanged(auth, user => {
      clear();
      if (!user) { setS({ loading: false, user: null, isOrganizer: false, isAdmin: false, orgName: null, request: null }); return; }
      setS(p => ({ ...p, loading: true, user }));
      let pending = 3;
      const done = () => { if (--pending <= 0) setS(p => ({ ...p, loading: false })); };
      const once = () => { let d = false; return () => { if (!d) { d = true; done(); } }; };
      const d1 = once(), d2 = once(), d3 = once();
      unsubs.push(onSnapshot(doc(db!, 'organizers', user.uid),
        snap => { setS(p => ({ ...p, isOrganizer: snap.exists(), orgName: (snap.data()?.orgName as string) ?? null })); d1(); }, () => d1()));
      unsubs.push(onSnapshot(doc(db!, 'admins', user.uid),
        snap => { setS(p => ({ ...p, isAdmin: snap.exists() })); d2(); }, () => d2()));
      unsubs.push(onSnapshot(doc(db!, 'accessRequests', user.uid),
        snap => { setS(p => ({ ...p, request: snap.exists() ? (snap.data() as AccessRequest) : null })); d3(); }, () => d3()));
    });
    return () => { off(); clear(); };
  }, []);
  return s;
}
