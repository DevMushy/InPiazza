import { CONFIG } from '../config';
import type { LngLat, Stop } from '../types';
import { cumulative, flatten, hav } from './geo';

export interface RouteResult { route: number[]; routed: boolean; length: number; stopDist: number[] }

function straight(stops: Stop[]): RouteResult {
  const line = stops.map(s => [s.lng, s.lat] as LngLat);
  const cum = cumulative(line);
  return { route: flatten(line), routed: false, length: cum[cum.length - 1] || 0, stopDist: cum };
}

/** Calcola il percorso a piedi tra le tappe. Se il servizio non risponde, usa la linea retta. */
export async function computeRoute(stops: Stop[]): Promise<RouteResult> {
  if (stops.length < 2) return straight(stops);
  try {
    const coords = stops.map(s => `${s.lng},${s.lat}`).join(';');
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(`${CONFIG.routerUrl}${coords}?overview=full&geometries=geojson`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const rt = j.routes?.[0];
    if (!rt) throw new Error('nessun percorso');
    let line = rt.geometry.coordinates as LngLat[];
    // semplifico se troppo lungo per un documento Firestore
    if (line.length > 3500) { const step = Math.ceil(line.length / 3500); line = line.filter((_, i) => i % step === 0 || i === line.length - 1); }
    const cum = cumulative(line);
    const length = cum[cum.length - 1];
    const legs: number[] = rt.legs.map((l: { distance: number }) => l.distance);
    const tot = legs.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    const stopDist = [0, ...legs.map(l => (acc += l) * (length / tot))];
    return { route: flatten(line), routed: true, length, stopDist };
  } catch {
    return straight(stops);
  }
}
export { hav };
