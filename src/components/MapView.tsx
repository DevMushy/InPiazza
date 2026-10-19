import { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as MLMap, type Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CONFIG } from '../config';
import { POI_TYPES } from '../constants';
import type { EventItem, LngLat, PoiType, Stop } from '../types';
import { recolor, readMapColors, type MapColors } from '../lib/recolor';

export interface FitRequest { key: number; bbox: [LngLat, LngLat] | null; bottom?: number; center?: LngLat; zoom?: number }
export interface PoiRef { eventId: string; index: number }

interface Props {
  events: EventItem[];
  selectedId: string | null;
  poiOn: Set<PoiType>;
  selectedPoi?: PoiRef | null;
  onSelectEvent?: (id: string) => void;
  onSelectPoi?: (p: PoiRef) => void;
  onMapClick?: (ll: LngLat) => void;
  fit?: FitRequest | null;
  /** editor: tappe trascinabili al posto dei segnaposti */
  editStops?: { stops: Stop[]; onMove: (i: number, ll: LngLat) => void };
  label?: string;
}

const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const PIN = (n: number | string) =>
  `<svg viewBox="0 0 26 32" width="28" height="34" aria-hidden="true"><path d="M13 31C9 24 1.5 19 1.5 12a11.5 11.5 0 0 1 23 0c0 7-7.5 12-11.5 19z"/></svg><span>${n}</span>`;
const badgeHTML = (t: PoiType) => `<span class="badge ${t}" aria-hidden="true">${POI_TYPES[t].g}</span>`;

export default function MapView(p: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const colors = useRef<MapColors>(readMapColors());
  const props = useRef(p);
  props.current = p;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // crea la mappa una sola volta
  useEffect(() => {
    if (!el.current) return;
    const map = new maplibregl.Map({
      container: el.current, style: CONFIG.mapStyleUrl, center: CONFIG.center, zoom: CONFIG.zoom,
      attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;
    map.on('load', () => {
      if (CONFIG.recolor) recolor(map, colors.current);
      map.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      const c = colors.current;
      map.addLayer({ id: 'r-oc', type: 'line', source: 'routes', filter: ['==', ['get', 'sel'], 0], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': c.bg, 'line-width': 6 } });
      map.addLayer({ id: 'r-o', type: 'line', source: 'routes', filter: ['==', ['get', 'sel'], 0], layout: { 'line-join': 'round' }, paint: { 'line-color': c.other, 'line-width': 3, 'line-dasharray': [1.6, 1.6] } });
      map.addLayer({ id: 'r-sc', type: 'line', source: 'routes', filter: ['==', ['get', 'sel'], 1], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': c.bg, 'line-width': 9 } });
      map.addLayer({ id: 'r-s', type: 'line', source: 'routes', filter: ['==', ['get', 'sel'], 1], layout: { 'line-join': 'round' }, paint: { 'line-color': c.accent, 'line-width': 4.5, 'line-dasharray': [2, 1.2] } });
      for (const id of ['r-o', 'r-s']) {
        map.on('click', id, e => { const f = e.features?.[0]; if (f && !props.current.onMapClick) props.current.onSelectEvent?.(f.properties.id as string); });
        map.on('mouseenter', id, () => { if (!props.current.onMapClick) map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
      }
      setReady(true);
    });
    map.on('click', e => props.current.onMapClick?.([e.lngLat.lng, e.lngLat.lat]));
    map.on('error', e => { if (!map.isStyleLoaded() && /fetch|style|NetworkError/i.test(String(e.error?.message))) setFailed(true); });
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(el.current);

    const onTheme = () => {
      colors.current = readMapColors();
      if (!map.isStyleLoaded()) return;
      if (CONFIG.recolor) recolor(map, colors.current);
      const c = colors.current;
      map.setPaintProperty('r-s', 'line-color', c.accent); map.setPaintProperty('r-o', 'line-color', c.other);
      map.setPaintProperty('r-sc', 'line-color', c.bg); map.setPaintProperty('r-oc', 'line-color', c.bg);
    };
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', onTheme);
    return () => { mq.removeEventListener('change', onTheme); ro.disconnect(); markers.current.forEach(m => m.remove()); map.remove(); mapRef.current = null; };
  }, []);

  // percorsi e marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const { events, selectedId, poiOn, selectedPoi, editStops } = p;
    (map.getSource('routes') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: events.filter(e => e.line.length > 1).map(e => ({
        type: 'Feature', properties: { id: e.id, sel: e.id === selectedId ? 1 : 0 },
        geometry: { type: 'LineString', coordinates: e.line }
      }))
    });
    markers.current.forEach(m => m.remove());
    markers.current = [];
    const add = (node: HTMLElement, ll: LngLat, opts: maplibregl.MarkerOptions, onClick?: () => void) => {
      const m = new maplibregl.Marker({ element: node, ...opts }).setLngLat(ll).addTo(map);
      if (onClick) node.addEventListener('click', ev => { ev.stopPropagation(); onClick(); });
      markers.current.push(m);
      return m;
    };
    const btn = (cls: string, html: string, label: string) => {
      const b = document.createElement('button'); b.className = cls; b.innerHTML = html; b.setAttribute('aria-label', label); return b;
    };
    const sel = events.find(e => e.id === selectedId);
    events.forEach((ev, i) => {
      if (ev === sel || !ev.line.length) return;
      add(btn('mk-pin other', PIN(i + 1), ev.title), ev.line[0], { anchor: 'bottom' }, () => props.current.onSelectEvent?.(ev.id));
    });
    if (sel) {
      if (!editStops && sel.line.length > 1) {
        add(btn('mk-end', '', 'Arrivo: ' + sel.stops[sel.stops.length - 1]?.name), sel.line[sel.line.length - 1], { anchor: 'center' }, () => props.current.onSelectEvent?.(sel.id));
      }
      sel.pois.forEach((po, i) => {
        if (!poiOn.has(po.type)) return;
        const on = selectedPoi?.eventId === sel.id && selectedPoi.index === i;
        // un punto sopra il ritrovo o l'arrivo viene spostato di lato per non coprire il segnaposto
        const near = (q: LngLat) => Math.abs(q[0] - po.lng) < 0.00035 && Math.abs(q[1] - po.lat) < 0.00025;
        const offset: [number, number] = sel.line.length && near(sel.line[0]) ? [22, 4] : sel.line.length > 1 && near(sel.line[sel.line.length - 1]) ? [-22, -6] : [0, 0];
        add(btn('mk-poi' + (on ? ' on' : ''), badgeHTML(po.type), po.name || POI_TYPES[po.type].label), [po.lng, po.lat], { anchor: 'center', offset },
          () => props.current.onSelectPoi?.({ eventId: sel.id, index: i }));
      });
      if (editStops) {
        editStops.stops.forEach((s, i) => {
          const node = btn('mk-draft', String(i + 1), s.name || 'Tappa ' + (i + 1));
          const m = add(node, [s.lng, s.lat], { anchor: 'center', draggable: true });
          m.on('dragend', () => { const ll = m.getLngLat(); props.current.editStops?.onMove(i, [ll.lng, ll.lat]); });
        });
      } else if (sel.line.length) {
        add(btn('mk-pin sel', PIN(events.indexOf(sel) + 1), sel.title), sel.line[0], { anchor: 'bottom' }, () => props.current.onSelectEvent?.(sel.id));
      }
    }
  }, [ready, p.events, p.selectedId, p.poiOn, p.selectedPoi, p.editStops]);

  // inquadratura
  useEffect(() => {
    const map = mapRef.current, f = p.fit;
    if (!map || !ready || !f) return;
    const duration = reduce ? 0 : 700;
    if (f.center) { map.easeTo({ center: f.center, zoom: Math.max(map.getZoom(), f.zoom ?? 16), padding: { top: 0, left: 0, right: 0, bottom: f.bottom ?? 0 }, duration }); return; }
    if (!f.bbox) { map.easeTo({ center: CONFIG.center, zoom: CONFIG.zoom, duration }); return; }
    const [[x0, y0], [x1, y1]] = f.bbox;
    const h = el.current?.clientHeight ?? 300;
    const bottom = Math.min(h * 0.6, 30 + (f.bottom ?? 0));
    if (x0 === x1 && y0 === y1) { map.easeTo({ center: [x0, y0], zoom: 16, duration }); return; }
    map.fitBounds(f.bbox, { padding: { top: 50, left: 40, right: 84, bottom }, maxZoom: 17, duration });
  }, [ready, p.fit?.key]);

  const map = mapRef.current;
  return (
    <>
      <div ref={el} style={{ position: 'absolute', inset: 0 }} aria-label={p.label ?? 'Mappa'} />
      <div className="map-ctrl">
        <button onClick={() => map?.zoomIn()} aria-label="Ingrandisci">+</button>
        <button onClick={() => map?.zoomOut()} aria-label="Riduci">−</button>
        {p.fit !== undefined && (
          <button onClick={() => { const f = props.current.fit; if (map && f?.bbox) map.fitBounds(f.bbox, { padding: { top: 50, left: 40, right: 84, bottom: 30 + (f.bottom ?? 0) }, maxZoom: 17, duration: reduce ? 0 : 700 }); }} aria-label="Mostra tutto il percorso">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
          </button>
        )}
      </div>
      {failed && <div className="hint" style={{ right: 10 }}>Non riesco a caricare la mappa. Controlla la connessione.</div>}
    </>
  );
}
