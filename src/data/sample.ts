import raw from './sample-events.json';
import { hydrate, cumulative } from '../lib/geo';
import type { EventData, EventItem, LngLat } from '../types';

/** Dati dimostrativi mostrati quando Firebase non è ancora configurato (percorsi in linea retta) */
export const SAMPLE_EVENTS: EventItem[] = (raw as (Omit<EventData, 'ownerUid' | 'published' | 'route' | 'routed' | 'length' | 'stopDist'> & { id: string })[])
  .map(({ id, ...e }) => {
    const line = e.stops.map(s => [s.lng, s.lat] as LngLat);
    const cum = cumulative(line);
    return hydrate(id, { ...e, ownerUid: 'demo', published: true, route: line.flat(), routed: false, length: cum[cum.length - 1], stopDist: cum });
  });
