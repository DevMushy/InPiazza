// Carica le manifestazioni di esempio in Firestore, con i percorsi calcolati sulle strade.
// Uso: scarica una chiave di servizio (Impostazioni progetto > Account di servizio) in ./service-account.json
//      poi: npm run seed
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const ROUTER = process.env.VITE_ROUTER_URL || 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/';
const sa = JSON.parse(readFileSync(new URL('../service-account.json', import.meta.url)));
initializeApp({ credential: cert(sa) });
const db = getFirestore();
const events = JSON.parse(readFileSync(new URL('../src/data/sample-events.json', import.meta.url)));

const hav = (a, b) => { const R = 6371000, r = Math.PI / 180, dLat = (b[1] - a[1]) * r, dLng = (b[0] - a[0]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

async function route(stops) {
  const pts = stops.map(s => [s.lng, s.lat]);
  try {
    const r = await fetch(ROUTER + pts.map(p => p.join(',')).join(';') + '?overview=full&geometries=geojson');
    const j = await r.json(); const rt = j.routes[0];
    const line = rt.geometry.coordinates; let len = 0; for (let i = 1; i < line.length; i++) len += hav(line[i - 1], line[i]);
    const tot = rt.legs.reduce((a, l) => a + l.distance, 0); let acc = 0;
    return { route: line.flat(), routed: true, length: len, stopDist: [0, ...rt.legs.map(l => (acc += l.distance) * len / tot)] };
  } catch {
    let acc = 0; const sd = [0, ...pts.slice(1).map((p, i) => (acc += hav(pts[i], p)))];
    return { route: pts.flat(), routed: false, length: acc, stopDist: sd };
  }
}

const ownerUid = process.argv[2] || 'seed';
for (const { id, ...e } of events) {
  const r = await route(e.stops);
  await db.collection('events').doc(id).set({ ...e, ...r, ownerUid, published: true, updatedAt: FieldValue.serverTimestamp() });
  console.log((r.routed ? '✓ ' : '~ ') + e.title);
}
console.log('Fatto. Proprietario:', ownerUid);
