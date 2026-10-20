// Iscrive (o disiscrive) un dispositivo a un canale di notifiche.
// Il token del dispositivo NON viene salvato: lo tiene solo Firebase Cloud Messaging.
//   POST { token, topic: 'eventi' | 'admin-richieste', unsubscribe?: true }
//   Per 'admin-richieste' serve il token di accesso di un admin nell'header Authorization.
import { admin, body, caller, cors, isAdmin, TOPIC_ADMINS, TOPIC_EVENTS } from './_lib/admin.js';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const { token, topic, unsubscribe } = body(req);
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) return res.status(400).json({ error: 'token' });
  if (topic !== TOPIC_EVENTS && topic !== TOPIC_ADMINS) return res.status(400).json({ error: 'topic' });
  try {
    if (topic === TOPIC_ADMINS) {
      const u = await caller(req);
      if (!u || !(await isAdmin(u.uid))) return res.status(403).json({ error: 'forbidden' });
    }
    const fcm = admin().fcm;
    const r = unsubscribe ? await fcm.unsubscribeFromTopic([token], topic) : await fcm.subscribeToTopic([token], topic);
    if (r.failureCount) return res.status(400).json({ error: 'fcm', detail: r.errors?.[0]?.error?.code });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server' });
  }
}
