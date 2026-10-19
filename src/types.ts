export type EventType = 'corteo' | 'festa' | 'fiaccolata' | 'presidio';
export type PoiType = 'palco' | 'ristoro' | 'soccorso' | 'info' | 'wc';
export type LngLat = [number, number];

export interface Stop { name: string; note: string; lng: number; lat: number }
export interface Poi { type: PoiType; name: string; note: string; lng: number; lat: number }

/** Documento Firestore `events/{id}` */
export interface EventData {
  ownerUid: string;
  published: boolean;
  type: EventType;
  title: string;
  orgs: string[];
  date: string;        // AAAA-MM-GG
  time: string;        // HH:MM
  desc: string;
  city: string;        // es. "Firenze"
  stops: Stop[];
  pois: Poi[];
  route: number[];     // percorso appiattito [lng, lat, lng, lat, ...] (Firestore non accetta array annidati)
  routed: boolean;     // true se segue le strade, false se linea retta
  length: number;      // metri
  stopDist: number[];  // metri dal ritrovo per ogni tappa
  updatedAt?: unknown;
}

/** Evento pronto per la UI, con geometria calcolata */
export interface EventItem extends EventData {
  id: string;
  line: LngLat[];
  cum: number[];
  bbox: [LngLat, LngLat];
  poiDist: number[];
}

export type SheetMode = 'closed' | 'half' | 'full';
