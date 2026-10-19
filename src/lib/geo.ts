import type { EventData, EventItem, LngLat } from '../types';

export function hav(a: LngLat, b: LngLat): number {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b[1] - a[1]) * r, dLng = (b[0] - a[0]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export function cumulative(line: LngLat[]): number[] {
  const c = [0];
  for (let i = 1; i < line.length; i++) c.push(c[i - 1] + hav(line[i - 1], line[i]));
  return c;
}
export function pointAt(line: LngLat[], cum: number[], d: number): LngLat {
  const len = cum[cum.length - 1];
  if (d <= 0) return line[0];
  if (d >= len) return line[line.length - 1];
  let i = 1;
  while (cum[i] < d) i++;
  const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1), a = line[i - 1], b = line[i];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
/** distanza lungo il percorso del punto più vicino a p */
export function distanceAlong(line: LngLat[], cum: number[], p: LngLat): number {
  if (line.length < 2) return 0;
  const kx = Math.cos((p[1] * Math.PI) / 180);
  let best = 0, bd = Infinity;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    const ax = a[0] * kx, ay = a[1], bx = b[0] * kx, by = b[1], px = p[0] * kx, py = p[1];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
    const qx = ax + dx * t, qy = ay + dy * t, dd = (px - qx) ** 2 + (py - qy) ** 2;
    if (dd < bd) { bd = dd; best = cum[i - 1] + (cum[i] - cum[i - 1]) * t; }
  }
  return best;
}
export function bboxOf(line: LngLat[]): [LngLat, LngLat] {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
  for (const p of line) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }
  return [[x0, y0], [x1, y1]];
}
export function unionBbox(boxes: [LngLat, LngLat][]): [LngLat, LngLat] | null {
  if (!boxes.length) return null;
  return bboxOf(boxes.flat());
}
export const flatten = (line: LngLat[]) => line.flatMap(p => [Math.round(p[0] * 1e6) / 1e6, Math.round(p[1] * 1e6) / 1e6]);
export function unflatten(route: number[]): LngLat[] {
  const out: LngLat[] = [];
  for (let i = 0; i + 1 < route.length; i += 2) out.push([route[i], route[i + 1]]);
  return out;
}

/** Trasforma il documento Firestore nell'oggetto usato dalla UI */
export function hydrate(id: string, d: EventData): EventItem {
  let line = unflatten(d.route || []);
  if (line.length < 2) line = d.stops.map(s => [s.lng, s.lat] as LngLat);
  if (line.length === 1) line = [line[0], line[0]];
  const cum = cumulative(line);
  return {
    ...d, city: d.city ?? '', id, line, cum,
    bbox: bboxOf(line.length ? line : [[0, 0]]),
    poiDist: d.pois.map(p => distanceAlong(line, cum, [p.lng, p.lat]))
  };
}
