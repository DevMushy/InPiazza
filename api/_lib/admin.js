// Inizializzazione condivisa di firebase-admin per le funzioni Vercel.
// Variabile d'ambiente richiesta su Vercel:
//   FIREBASE_SERVICE_ACCOUNT = contenuto del file JSON dell'account di servizio
//                              (Impostazioni progetto → Account di servizio → Genera nuova chiave)
//                              Va bene sia il JSON così com'è sia codificato in base64.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

function credentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT mancante');
  const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  return JSON.parse(text);
}

export function admin() {
  if (!getApps().length) initializeApp({ credential: cert(credentials()) });
  return { auth: getAuth(), db: getFirestore(), fcm: getMessaging() };
}

export const TOPIC_EVENTS = 'eventi';
export const TOPIC_ADMINS = 'admin-richieste';
export const appUrl = () => (process.env.VITE_PUBLIC_URL || '').replace(/\/$/, '');

export function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
}

export function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

/** Utente dal token Firebase nell'header Authorization, oppure null */
export async function caller(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try { return await admin().auth.verifyIdToken(token); } catch { return null; }
}

export async function isAdmin(uid) {
  return (await admin().db.doc(`admins/${uid}`).get()).exists;
}

/** Segna un avviso come già inviato; ritorna false se lo era già (niente doppioni) */
export async function markOnce(id) {
  try { await admin().db.doc(`notified/${id}`).create({ at: new Date() }); return true; }
  catch (e) { if (e.code === 6 || /already exists/i.test(e.message)) return false; throw e; }
}
