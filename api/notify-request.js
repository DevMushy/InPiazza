// Avvisa l'admin via email quando qualcuno chiede l'accesso da organizzatore.
// Funzione serverless di Vercel. Non usa chiavi di servizio Firebase:
// legge la richiesta con il token dell'utente stesso, quindi le regole di Firestore
// garantiscono che chi chiama sia davvero il proprietario della richiesta.
//
// Variabili d'ambiente su Vercel:
//   RESEND_API_KEY   chiave API di Resend (https://resend.com)
//   ADMIN_EMAIL      dove ricevere l'avviso (una o più, separate da virgola)
//   MAIL_FROM        facoltativo, es. "In Piazza <avvisi@tuodominio.it>" (dominio verificato su Resend)
//   VITE_FIREBASE_PROJECT_ID  già presente per l'app

const MAX_AGE_MS = 10 * 60 * 1000; // avvisa solo per richieste create negli ultimi 10 minuti

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });

  const { RESEND_API_KEY, ADMIN_EMAIL, MAIL_FROM } = process.env;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  if (!RESEND_API_KEY || !ADMIN_EMAIL || !projectId) return res.status(500).json({ error: 'config' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const uid = typeof req.body === 'object' ? req.body?.uid : JSON.parse(req.body || '{}').uid;
  if (!token || !uid || !/^[A-Za-z0-9]{10,128}$/.test(uid)) return res.status(400).json({ error: 'input' });

  // 1. leggo la richiesta come l'utente: se il token non è suo, Firestore rifiuta
  const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/accessRequests/${uid}`;
  const r = await fetch(docUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return res.status(403).json({ error: 'forbidden' });
  const f = (await r.json()).fields || {};
  const status = f.status?.stringValue;
  const createdAt = Date.parse(f.createdAt?.timestampValue || '');
  if (status !== 'pending' || !createdAt || Date.now() - createdAt > MAX_AGE_MS) return res.status(200).json({ skipped: true });

  const orgName = f.orgName?.stringValue || '';
  const note = f.note?.stringValue || '';
  const email = f.email?.stringValue || '';
  const appUrl = process.env.VITE_PUBLIC_URL || '';

  // 2. invio l'avviso
  const send = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: MAIL_FROM || 'In Piazza <onboarding@resend.dev>',
      to: ADMIN_EMAIL.split(',').map(s => s.trim()).filter(Boolean),
      subject: `Nuova richiesta organizzatore: ${orgName}`,
      text: `${orgName} ha chiesto l'accesso da organizzatore.\n\nEmail: ${email}\n${note ? `Messaggio: ${note}\n` : ''}\nApprova o rifiuta dall'app: ${appUrl}`,
      html: `<p><b>${esc(orgName)}</b> ha chiesto l'accesso da organizzatore.</p>
             <p>Email: ${esc(email)}</p>${note ? `<p>Messaggio: ${esc(note)}</p>` : ''}
             <p>Approva o rifiuta dall'app${appUrl ? `: <a href="${esc(appUrl)}">${esc(appUrl)}</a>` : ''} (profilo → Richieste di accesso).</p>`
    })
  });
  if (!send.ok) return res.status(502).json({ error: 'mail', detail: await send.text() });
  return res.status(200).json({ sent: true });
}
