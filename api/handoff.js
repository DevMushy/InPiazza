// Passa l'accesso da Safari all'app aggiunta alla schermata Home di iPhone.
// Su iPhone il link dell'email si apre sempre in Safari, che non condivide i dati con la web app
// sulla Home. Flusso:
//   1. l'app sulla Home crea un codice casuale e chiama  start  { code, email }
//   2. il link email porta a /accedi/<code>; Safari chiede  email  { code } per completare l'accesso
//   3. Safari, ora collegato, chiama  finish  { code } con il proprio token: il server prepara un
//      token di accesso per lo stesso utente
//   4. l'app sulla Home chiama  claim  { code }, riceve il token, entra e il "biglietto" viene cancellato
// I biglietti scadono dopo 15 minuti e stanno in handoffs/{code}, illeggibile dai client.
import { admin, body, caller, cors } from './_lib/admin.js';

const TTL_MS = 15 * 60 * 1000;
const okCode = c => typeof c === 'string' && /^[a-f0-9]{32,64}$/.test(c);
const okEmail = e => typeof e === 'string' && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const { action, code, email } = body(req);
  if (!okCode(code)) return res.status(400).json({ error: 'code' });
  const { db, auth } = admin();
  const ref = db.doc(`handoffs/${code}`);
  try {
    if (action === 'start') {
      if (!okEmail(email)) return res.status(400).json({ error: 'email' });
      await ref.set({ email: email.toLowerCase(), exp: Date.now() + TTL_MS });
      return res.status(200).json({ ok: true });
    }
    const snap = await ref.get();
    const h = snap.data();
    if (!h || h.exp < Date.now()) { if (snap.exists) await ref.delete(); return res.status(404).json({ error: 'expired' }); }

    if (action === 'email') return res.status(200).json({ email: h.email });

    if (action === 'finish') {
      const u = await caller(req);
      if (!u || (u.email || '').toLowerCase() !== h.email) return res.status(403).json({ error: 'forbidden' });
      const token = await auth.createCustomToken(u.uid);
      await ref.set({ token, exp: h.exp });   // l'email non serve più
      return res.status(200).json({ ok: true });
    }

    if (action === 'claim') {
      if (!h.token) return res.status(200).json({ pending: true });
      await ref.delete();
      return res.status(200).json({ token: h.token });
    }
    return res.status(400).json({ error: 'action' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server' });
  }
}
