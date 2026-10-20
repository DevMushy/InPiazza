// Avvisa tutti gli iscritti quando una manifestazione viene pubblicata.
// Chiamata dall'app dopo il salvataggio; parte una sola volta per manifestazione.
//   POST { eventId }  con il token dell'organizzatore nell'header Authorization
import { admin, appUrl, body, caller, cors, isAdmin, markOnce, TOPIC_EVENTS } from './_lib/admin.js';

const TYPE = { corteo: 'Corteo', festa: 'Festa', fiaccolata: 'Fiaccolata', presidio: 'Presidio' };
const WD = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const fmt = iso => { const d = new Date(iso + 'T12:00:00Z'); return `${WD[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const { eventId } = body(req);
  if (typeof eventId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(eventId)) return res.status(400).json({ error: 'input' });
  try {
    const u = await caller(req);
    if (!u) return res.status(401).json({ error: 'auth' });
    const snap = await admin().db.doc(`events/${eventId}`).get();
    if (!snap.exists) return res.status(404).json({ error: 'not-found' });
    const ev = snap.data();
    if (ev.ownerUid !== u.uid && !(await isAdmin(u.uid))) return res.status(403).json({ error: 'forbidden' });
    if (!ev.published || ev.date < today()) return res.status(200).json({ skipped: 'non pubblicata o passata' });
    if (!(await markOnce(`event_${eventId}`))) return res.status(200).json({ skipped: 'già inviata' });

    const link = appUrl() ? `${appUrl()}/?e=${encodeURIComponent(eventId)}` : undefined;
    await admin().fcm.send({
      topic: TOPIC_EVENTS,
      notification: {
        title: `Nuova manifestazione${ev.city ? ' a ' + ev.city : ''}`,
        body: `${TYPE[ev.type] || ''} · ${ev.title} · ${fmt(ev.date)} ore ${ev.time}`
      },
      data: { eventId },
      webpush: link ? { fcmOptions: { link } } : undefined,
      apns: { payload: { aps: { sound: 'default' } } }
    });
    return res.status(200).json({ sent: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server' });
  }
}
