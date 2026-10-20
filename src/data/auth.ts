import { useEffect, useState } from 'react';
import {
  onAuthStateChanged, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
  signOut as fbSignOut, deleteUser, signInWithCustomToken, type User, type ActionCodeSettings
} from 'firebase/auth';
import { doc, onSnapshot, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { auth, db } from '../firebase';
import { CONFIG, apiUrl } from '../config';
import { isStandalone } from '../lib/ui';

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

const HANDOFF_KEY = 'inpiazza:handoff';

function actionSettings(handoff?: string): ActionCodeSettings {
  return {
    // sul web il link torna dove sei (anche localhost); nelle app native va al dominio pubblico.
    // /accedi/<codice>: link chiesto dall'app sulla schermata Home (vedi handoff)
    url: (Capacitor.isNativePlatform() ? CONFIG.publicUrl : window.location.origin).replace(/\/$/, '') + '/accedi' + (handoff ? '/' + handoff : ''),
    handleCodeInApp: true,
    iOS: { bundleId: CONFIG.iosBundleId },
    android: { packageName: CONFIG.androidPackage, installApp: false }
  };
}

const handoffApi = async (payload: Record<string, string>, idToken?: string) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) headers.Authorization = 'Bearer ' + idToken;
  const r = await fetch(apiUrl('/api/handoff'), { method: 'POST', headers, body: JSON.stringify(payload) });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) as Record<string, string | boolean> };
};
const randomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(20)), b => b.toString(16).padStart(2, '0')).join('');

export async function sendLoginLink(email: string) {
  if (!auth) throw new Error('Firebase non configurato');
  // dall'app sulla Home di iPhone il link si aprirà in Safari: preparo il passaggio dell'accesso
  let handoff: string | undefined;
  if (!Capacitor.isNativePlatform() && isStandalone()) {
    const code = randomCode();
    const r = await handoffApi({ action: 'start', code, email }).catch(() => null);
    if (r?.ok) { handoff = code; try { localStorage.setItem(HANDOFF_KEY, code); } catch { /* */ } }
  }
  await sendSignInLinkToEmail(auth, email, actionSettings(handoff));
  try { localStorage.setItem(EMAIL_KEY, email); } catch { /* storage non disponibile */ }
}

/** Codice di passaggio nell'URL /accedi/<codice>, se presente */
export function handoffCodeIn(url: string): string | null {
  try {
    const u = new URL(url);
    const direct = u.pathname.match(/^\/accedi\/([a-f0-9]{32,64})/)?.[1];
    if (direct) return direct;
    const cont = u.searchParams.get('continueUrl');
    return cont ? new URL(cont).pathname.match(/^\/accedi\/([a-f0-9]{32,64})/)?.[1] ?? null : null;
  } catch { return null; }
}

/**
 * Safari ha aperto un link chiesto dall'app sulla Home: completo l'accesso qui
 * e lascio al server il "biglietto" che l'app ritirerà. Ritorna true se è andato a buon fine.
 */
export async function completeHandoffInBrowser(url: string, code: string): Promise<boolean> {
  if (!auth || !isSignInWithEmailLink(auth, url)) return false;
  const r = await handoffApi({ action: 'email', code });
  const email = typeof r.data.email === 'string' ? r.data.email : null;
  if (!email) throw new Error('expired');
  const cred = await signInWithEmailLink(auth, email, url);
  window.history.replaceState(null, '', '/');
  const f = await handoffApi({ action: 'finish', code }, await cred.user.getIdToken());
  return f.ok;
}

/** Nell'app sulla Home: se l'accesso è stato fatto in Safari, lo ritiro. Ritorna true se sono entrato. */
export async function claimHandoff(): Promise<boolean> {
  if (!auth || auth.currentUser) return false;
  let code: string | null = null;
  try { code = localStorage.getItem(HANDOFF_KEY); } catch { /* */ }
  if (!code) return false;
  const r = await handoffApi({ action: 'claim', code }).catch(() => null);
  if (!r) return false;
  if (r.status === 404) { try { localStorage.removeItem(HANDOFF_KEY); } catch { /* */ } return false; }
  if (typeof r.data.token !== 'string') return false;
  await signInWithCustomToken(auth, r.data.token);
  try { localStorage.removeItem(HANDOFF_KEY); localStorage.removeItem(EMAIL_KEY); } catch { /* */ }
  return true;
}
export function hasPendingHandoff(): boolean { try { return !!localStorage.getItem(HANDOFF_KEY); } catch { return false; } }

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
  notifyAdmin(user).catch(() => { /* l'avviso è facoltativo: la richiesta è comunque salvata */ });
}

/** Chiede alla funzione su Vercel di avvisare gli admin (notifica push ed eventuale email) */
async function notifyAdmin(user: User) {
  const token = await user.getIdToken();
  await fetch(apiUrl('/api/notify-request'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid: user.uid })
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
