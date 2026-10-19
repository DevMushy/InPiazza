import type { Map as MLMap } from 'maplibre-gl';

export interface MapColors { bg: string; minor: string; mid: string; major: string; river: string; park: string; building: string; label: string; other: string; accent: string }

export function readMapColors(): MapColors {
  const cs = getComputedStyle(document.documentElement);
  const v = (k: string) => cs.getPropertyValue('--' + k).trim();
  return {
    bg: v('map-bg'), minor: v('map-minor'), mid: v('map-mid'), major: v('map-major'), river: v('map-river'),
    park: v('map-park'), building: v('map-building'), label: v('map-label'), other: v('map-other'), accent: v('accent')
  };
}

/** Ricolora uno stile OpenMapTiles (Positron, Liberty, MapTiler…) in bianco e nero */
export function recolor(map: MLMap, c: MapColors) {
  const set = (id: string, prop: string, val: unknown) => { try { map.setPaintProperty(id, prop, val); } catch { /* proprietà non presente */ } };
  const hide = (id: string) => { try { map.setLayoutProperty(id, 'visibility', 'none'); } catch { /* */ } };
  for (const l of map.getStyle().layers) {
    const id = l.id;
    const s = (('source-layer' in l && l['source-layer']) || '') + ' ' + id;
    switch (l.type) {
      case 'background': set(id, 'background-color', c.bg); break;
      case 'fill':
        if (/water/.test(s)) set(id, 'fill-color', c.river);
        else if (/park|wood|grass|landcover|cemetery|pitch/.test(s)) set(id, 'fill-color', c.park);
        else if (/building/.test(s)) set(id, 'fill-color', c.building);
        else set(id, 'fill-color', c.bg);
        set(id, 'fill-outline-color', c.bg);
        break;
      case 'fill-extrusion': hide(id); break;
      case 'line':
        if (/water/.test(s)) set(id, 'line-color', c.river);
        else if (/boundary|admin/.test(s)) hide(id);
        else if (/rail|transit/.test(s)) set(id, 'line-color', c.minor);
        else if (/casing/.test(id)) set(id, 'line-color', c.bg);
        else if (/motorway|trunk|primary|major/.test(id)) set(id, 'line-color', c.major);
        else if (/secondary|tertiary|subtle/.test(id)) set(id, 'line-color', c.mid);
        else set(id, 'line-color', c.minor);
        break;
      case 'symbol':
        if (/poi|housenum|transit|aeroway|airport|shield/.test(s)) hide(id);
        else { set(id, 'text-color', c.label); set(id, 'text-halo-color', c.bg); set(id, 'text-halo-width', 1.4); }
        break;
    }
  }
}
