import { CONFIG } from '../config';
import type { LngLat } from '../types';

export interface Place { label: string; detail: string; name: string; city: string; ll: LngLat }

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: { name?: string; street?: string; housenumber?: string; city?: string; town?: string; village?: string; county?: string; state?: string; district?: string; locality?: string };
}

function toPlace(f: PhotonFeature): Place {
  const p = f.properties;
  const street = [p.street, p.housenumber].filter(Boolean).join(' ');
  const city = p.city || p.town || p.village || p.county || '';
  const name = p.name || street || city;
  const label = p.name && street && p.name !== street ? `${p.name}, ${street}` : name;
  return { label, name, city, detail: [p.district || p.locality, city, p.state].filter(Boolean).join(', '), ll: f.geometry.coordinates };
}

/** Cerca indirizzi e luoghi, privilegiando quelli vicini a `near` */
export async function searchPlaces(q: string, near: LngLat | null, signal?: AbortSignal): Promise<Place[]> {
  const u = new URL(CONFIG.geocoderUrl.replace(/\/$/, '') + '/api/');
  u.searchParams.set('q', q);
  u.searchParams.set('limit', '6');
  u.searchParams.set('lang', 'it');
  if (near) { u.searchParams.set('lon', String(near[0])); u.searchParams.set('lat', String(near[1])); }
  const r = await fetch(u, { signal });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const seen = new Set<string>();
  return (j.features as PhotonFeature[]).map(toPlace).filter(p => {
    const k = p.label + '|' + p.detail; if (seen.has(k)) return false; seen.add(k); return true;
  });
}

/** Nome della città in un punto (per compilare il campo città in automatico) */
export async function cityAt(ll: LngLat): Promise<string> {
  try {
    const u = new URL(CONFIG.geocoderUrl.replace(/\/$/, '') + '/reverse');
    u.searchParams.set('lon', String(ll[0])); u.searchParams.set('lat', String(ll[1])); u.searchParams.set('lang', 'it');
    const r = await fetch(u); if (!r.ok) return '';
    const f = (await r.json()).features?.[0] as PhotonFeature | undefined;
    return f ? toPlace(f).city : '';
  } catch { return ''; }
}
