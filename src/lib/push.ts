import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import type { User } from 'firebase/auth';
import { CONFIG, apiUrl, firebaseConfigured } from '../config';

export type Topic = 'eventi' | 'admin-richieste';
const KEY = (t: Topic) => 'inpiazza:push:' + t;
const native = () => Capacitor.isNativePlatform();

const store = {
  get: (t: Topic) => { try { return localStorage.getItem(KEY(t)) === '1'; } catch { return false; } },
  set: (t: Topic, on: boolean) => { try { on ? localStorage.setItem(KEY(t), '1') : localStorage.removeItem(KEY(t)); } catch { /* */ } }
};

/** Su iPhone le notifiche web funzionano solo con l'app aggiunta alla schermata Home */
export function iosNeedsInstall(): boolean {
  if (native()) return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

export async function pushSupported(): Promise<boolean> {
  if (!firebaseConfigured) return false;
  if (native()) return true;
  if (!('serviceWorker' in navigator) || !('Notification' in window) || !CONFIG.vapidKey) return false;
  try { return (await FirebaseMessaging.isSupported()).isSupported; } catch { return false; }
}

export function pushEnabled(t: Topic): boolean {
  if (!store.get(t)) return false;
  return native() || (typeof Notification !== 'undefined' && Notification.permission === 'granted');
}

async function deviceToken(): Promise<string> {
  if (native()) return (await FirebaseMessaging.getToken()).token;
  const qs = new URLSearchParams(Object.entries(CONFIG.firebase).filter(([, v]) => !!v) as [string, string][]);
  const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js?' + qs.toString());
  await navigator.serviceWorker.ready;
  return (await FirebaseMessaging.getToken({ vapidKey: CONFIG.vapidKey, serviceWorkerRegistration: reg })).token;
}

async function call(t: Topic, token: string, unsubscribe: boolean, user?: User | null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (user) headers.Authorization = 'Bearer ' + (await user.getIdToken());
  const r = await fetch(apiUrl('/api/push-subscribe'), { method: 'POST', headers, body: JSON.stringify({ token, topic: t, unsubscribe }) });
  if (!r.ok) throw new Error('subscribe ' + r.status);
}

export type EnableResult = 'ok' | 'denied' | 'unsupported' | 'ios-install' | 'error';

/** Chiede il permesso e iscrive il dispositivo al canale. Nessun dato viene salvato nel nostro database. */
export async function enablePush(t: Topic, user?: User | null): Promise<EnableResult> {
  if (iosNeedsInstall()) return 'ios-install';
  if (!(await pushSupported())) return 'unsupported';
  try {
    const perm = await FirebaseMessaging.requestPermissions();
    if (perm.receive !== 'granted') return 'denied';
    await call(t, await deviceToken(), false, user);
    store.set(t, true);
    return 'ok';
  } catch (e) {
    console.error(e);
    return 'error';
  }
}

export async function disablePush(t: Topic, user?: User | null): Promise<void> {
  store.set(t, false);
  try { await call(t, await deviceToken(), true, user); } catch (e) { console.error(e); }
}

/** Notifiche ricevute con l'app aperta e tocchi sulle notifiche (app native) */
export function listenPush(onShow: (title: string, body: string) => void, onOpenEvent: (id: string) => void) {
  if (!firebaseConfigured) return () => {};
  const hs = [
    FirebaseMessaging.addListener('notificationReceived', ({ notification }) => {
      onShow(notification.title ?? '', notification.body ?? '');
    }),
    FirebaseMessaging.addListener('notificationActionPerformed', ({ notification }) => {
      const id = (notification.data as { eventId?: string } | undefined)?.eventId;
      if (id) onOpenEvent(id);
    })
  ];
  return () => { hs.forEach(p => p.then(h => h.remove()).catch(() => {})); };
}

/** Dopo aver pubblicato: chiede al server di avvisare tutti (una volta sola per manifestazione) */
export async function notifyEventPublished(user: User, eventId: string) {
  try {
    await fetch(apiUrl('/api/notify-event'), {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + (await user.getIdToken()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId })
    });
  } catch { /* facoltativo */ }
}
