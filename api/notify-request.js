// Avvisa gli admin quando qualcuno chiede l'accesso da organizzatore:
// notifica push agli admin iscritti e, se configurata, un'email tramite Resend.
//   POST { uid } con il token dell'utente nell'header Authorization
// Variabili facoltative per l'email: RESEND_API_KEY, ADMIN_EMAIL, MAIL_FROM
import { admin, appUrl, body, caller, cors, markOnce, TOPIC_ADMINS } from './_lib/admin.js';

const MAX_AGE_MS = 10 * 60 * 1000;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  try {
    const u = await caller(req);
    if (!u) return res.status(401).json({ error: 'auth' });
    const { uid = u.uid } = body(req);
    if (uid !== u.uid) return res.status(403).json({ error: 'forbidden' });

    const snap = await admin().db.doc(`accessRequests/${uid}`).get();
    const r = snap.data();
    const created = r?.createdAt?.toMillis?.() ?? 0;
    if (!r || r.status !== 'pending' || Date.now() - created > MAX_AGE_MS) return res.status(200).json({ skipped: true });
    if (!(await markOnce(`request_${uid}_${created}`))) return res.status(200).json({ skipped: 'già inviata' });

    const link = appUrl() || undefined;
    const out = {};
    // 1. push agli admin (senza l'email della persona: resta visibile solo nell'app)
    try {
      await admin().fcm.send({
        topic: TOPIC_ADMINS,
        notification: { title: 'Nuova richiesta organizzatore', body: `${r.orgName} chiede l'accesso. Apri l'app per approvare.` },
        data: { kind: 'request' },
        webpush: link ? { fcmOptions: { link } } : undefined,
        apns: { payload: { aps: { sound: 'default' } } }
      });
      out.push = true;
    } catch (e) { console.error(e); out.push = false; }

    // 2. email, solo se configurata
    const { RESEND_API_KEY, ADMIN_EMAIL, MAIL_FROM } = process.env;
    if (RESEND_API_KEY && ADMIN_EMAIL) {
      const send = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: MAIL_FROM || 'In Piazza <onboarding@resend.dev>',
          to: ADMIN_EMAIL.split(',').map(s => s.trim()).filter(Boolean),
          subject: `Nuova richiesta organizzatore: ${r.orgName}`,
          html: `<p><b>${esc(r.orgName)}</b> ha chiesto l'accesso da organizzatore.</p><p>Email: ${esc(r.email)}</p>${r.note ? `<p>Messaggio: ${esc(r.note)}</p>` : ''}${link ? `<p><a href="${esc(link)}">Apri l'app</a> → profilo → Richieste di accesso</p>` : ''}`
        })
      });
      out.email = send.ok;
    }
    return res.status(200).json(out);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server' });
  }
}
