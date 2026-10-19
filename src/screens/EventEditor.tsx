import { useEffect, useMemo, useRef, useState } from 'react';
import MapView, { type FitRequest } from '../components/MapView';
import Badge from '../components/Badge';
import { Back, Search } from '../components/Icons';
import { CONFIG } from '../config';
import { cityAt, searchPlaces, type Place } from '../lib/geocode';
import { POI_KEYS, POI_TYPES, TYPE_LABEL } from '../constants';
import { removeEvent, saveEvent } from '../data/events';
import { hydrate } from '../lib/geo';
import { computeRoute, type RouteResult } from '../lib/routing';
import { km, todayISO } from '../lib/format';
import type { EventItem, EventType, LngLat, Poi, PoiType, Stop } from '../types';

interface Props { uid: string; orgName: string | null; event: EventItem | null; onClose: () => void }
type Tool = 'stop' | PoiType;

export default function EventEditor({ uid, orgName, event, onClose }: Props) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [type, setType] = useState<EventType>(event?.type ?? 'corteo');
  const [date, setDate] = useState(event?.date ?? todayISO());
  const [time, setTime] = useState(event?.time ?? '15:00');
  const [orgs, setOrgs] = useState((event?.orgs ?? (orgName ? [orgName] : [])).join(', '));
  const [desc, setDesc] = useState(event?.desc ?? '');
  const [city, setCity] = useState(event?.city ?? '');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState(false);
  const [published, setPublished] = useState(event?.published ?? false);
  const [stops, setStops] = useState<Stop[]>(event?.stops ?? []);
  const [pois, setPois] = useState<Poi[]>(event?.pois ?? []);
  const [tool, setTool] = useState<Tool>('stop');
  const [route, setRoute] = useState<RouteResult | null>(event ? { route: event.route, routed: event.routed, length: event.length, stopDist: event.stopDist } : null);
  const [routing, setRouting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [fit, setFit] = useState<FitRequest | null>(null);
  const routeKey = useRef(event ? JSON.stringify(event.stops.map(s => [s.lng, s.lat])) : '');

  // ricalcola il percorso quando cambiano le posizioni delle tappe
  useEffect(() => {
    const key = JSON.stringify(stops.map(s => [s.lng, s.lat]));
    if (key === routeKey.current) return;
    routeKey.current = key;
    if (stops.length < 2) { setRoute(null); return; }
    setRouting(true);
    const t = setTimeout(async () => {
      const r = await computeRoute(stops);
      if (routeKey.current === key) { setRoute(r); setRouting(false); }
    }, 500);
    return () => clearTimeout(t);
  }, [stops]);

  // ricerca indirizzi (con una pausa mentre scrivi, per non tempestare il servizio)
  useEffect(() => {
    const text = q.trim();
    if (text.length < 3) { setResults([]); setSearching(false); setSearchErr(false); return; }
    const ctrl = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      const near = stops.length ? [stops[stops.length - 1].lng, stops[stops.length - 1].lat] as LngLat : CONFIG.center;
      const query = city && !text.toLocaleLowerCase('it').includes(city.toLocaleLowerCase('it')) ? `${text}, ${city}` : text;
      try { setResults(await searchPlaces(query, near, ctrl.signal)); setSearchErr(false); }
      catch (e) { if ((e as Error).name !== 'AbortError') { setResults([]); setSearchErr(true); } }
      finally { if (!ctrl.signal.aborted) setSearching(false); }
    }, 450);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  // città compilata da sola alla prima tappa
  useEffect(() => {
    if (city || stops.length !== 1) return;
    let alive = true;
    cityAt([stops[0].lng, stops[0].lat]).then(c => { if (alive && c) setCity(prev => prev || c); });
    return () => { alive = false; };
  }, [stops.length]);

  const draft: EventItem = useMemo(() => hydrate('draft', {
    ownerUid: uid, published, type, title: title || 'Nuova manifestazione', orgs: [], date, time, desc, city, stops, pois,
    route: route?.route ?? stops.flatMap(s => [s.lng, s.lat]), routed: route?.routed ?? false,
    length: route?.length ?? 0, stopDist: route?.stopDist ?? stops.map(() => 0)
  }), [uid, published, type, title, date, time, desc, city, stops, pois, route]);

  useEffect(() => { if (event) setFit({ key: 1, bbox: draft.bbox }); }, []);

  const editStops = useMemo(() => ({
    stops,
    onMove: (i: number, ll: LngLat) => setStops(s => s.map((x, j) => (j === i ? { ...x, lng: ll[0], lat: ll[1] } : x)))
  }), [stops]);
  const allPoi = useMemo(() => new Set(POI_KEYS), []);

  const addAt = (ll: LngLat, name?: string) => {
    if (tool === 'stop') setStops(s => [...s, { name: name || (s.length ? `Tappa ${s.length + 1}` : 'Ritrovo'), note: '', lng: ll[0], lat: ll[1] }]);
    else setPois(p => [...p, { type: tool, name: name || POI_TYPES[tool].label, note: '', lng: ll[0], lat: ll[1] }]);
  };
  const onMapClick = (ll: LngLat) => addAt(ll);
  const pickPlace = (p: Place) => {
    addAt(p.ll, p.name.slice(0, 80));
    if (!city && p.city) setCity(p.city);
    setQ(''); setResults([]);
    setFit(f => ({ key: (f?.key ?? 0) + 1, bbox: null, center: p.ll, zoom: 16 }));
  };
  const toolLabel = tool === 'stop' ? 'tappa' : POI_TYPES[tool].label.toLowerCase();
  const upd = <T,>(set: React.Dispatch<React.SetStateAction<T[]>>, i: number, patch: Partial<T>) => set(a => a.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const del = <T,>(set: React.Dispatch<React.SetStateAction<T[]>>, i: number) => set(a => a.filter((_, j) => j !== i));
  const moveStop = (i: number, d: number) => setStops(a => { const b = [...a]; const j = i + d; if (j < 0 || j >= b.length) return a; [b[i], b[j]] = [b[j], b[i]]; return b; });

  const valid = title.trim().length >= 3 && city.trim().length >= 2 && stops.length >= 1 && !routing;
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const r = route ?? await computeRoute(stops);
      await saveEvent(event?.id ?? null, {
        ownerUid: event?.ownerUid ?? uid, published, type, title: title.trim(),
        orgs: orgs.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10),
        date, time, desc: desc.trim().slice(0, 2000), city: city.trim().slice(0, 60),
        stops: stops.map(s => ({ ...s, name: s.name.trim().slice(0, 80) || 'Tappa', note: s.note.trim().slice(0, 200) })),
        pois: pois.map(p => ({ ...p, name: p.name.trim().slice(0, 80), note: p.note.trim().slice(0, 200) })),
        route: r.route, routed: r.routed, length: r.length, stopDist: r.stopDist
      });
      onClose();
    } catch (e) {
      setErr((e as { code?: string }).code === 'permission-denied' ? 'Non hai i permessi per salvare: il tuo accesso da organizzatore è attivo?' : 'Salvataggio non riuscito. Riprova.');
    } finally { setBusy(false); }
  };

  return (
    <div className="panel">
      <div className="panel-top">
        <button className="back" onClick={onClose} aria-label="Indietro"><Back /></button>
        <h1>{event ? 'Modifica' : 'Nuova manifestazione'}</h1>
        <button className="cta" style={{ flex: 'none', padding: '0 16px', height: 40 }} disabled={!valid || busy} onClick={save}>{busy ? 'Salvo…' : 'Salva'}</button>
      </div>

      <div className="search">
        <label className="search-box">
          <Search />
          <input id="ev-search" type="search" enterKeyHint="search" autoComplete="off" value={q} onChange={e => setQ(e.target.value)}
            placeholder="Cerca indirizzo o luogo" aria-label="Cerca indirizzo" />
        </label>
        {q.trim().length >= 3 && (
          <div className="results" role="listbox">
            {searching && !results.length && <div className="res-note">Cerco…</div>}
            {searchErr && <div className="res-note">Ricerca non disponibile. Tocca la mappa per aggiungere a mano.</div>}
            {!searching && !searchErr && !results.length && <div className="res-note">Nessun risultato.</div>}
            {results.map((p, i) => (
              <button key={i} className="res" role="option" onClick={() => pickPlace(p)}>
                <b>{p.label}</b><small>{p.detail}</small>
                <em>+ {toolLabel}</em>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="editor-map">
        <MapView events={[draft]} selectedId="draft" poiOn={allPoi} onMapClick={onMapClick} editStops={editStops} fit={fit} label="Mappa: tocca per aggiungere" />
        <div className="hint">
          {tool === 'stop' ? 'Tocca la mappa per aggiungere una tappa. Trascina i numeri per spostarle.' : `Tocca la mappa per aggiungere: ${POI_TYPES[tool].label}`}
        </div>
      </div>
      <div className="tools">
        <button className="pill tool" aria-pressed={tool === 'stop'} onClick={() => setTool('stop')}>
          <span className="badge" style={{ background: 'var(--accent)', color: '#fff' }}>1</span>Tappa
        </button>
        {POI_KEYS.map(k => (
          <button key={k} className="pill tool" aria-pressed={tool === k} onClick={() => setTool(k)}><Badge type={k} />{POI_TYPES[k].label}</button>
        ))}
      </div>

      <div className="panel-body">
        <div className="box">
          <label className="field"><span>Titolo</span><input id="ev-title" className="input" maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="Es. San Marco – S. M. Novella" /></label>
          <div className="row2">
            <label className="field"><span>Tipo</span>
              <select id="ev-type" value={type} onChange={e => setType(e.target.value as EventType)}>
                {(Object.keys(TYPE_LABEL) as EventType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </label>
            <label className="field"><span>Organizzano</span><input id="ev-orgs" className="input" value={orgs} onChange={e => setOrgs(e.target.value)} placeholder="Separati da virgola" /></label>
          </div>
          <label className="field"><span>Città</span><input id="ev-city" className="input" maxLength={60} autoComplete="address-level2" value={city} onChange={e => setCity(e.target.value)} placeholder="Si compila dalla prima tappa" /></label>
          <div className="row2">
            <label className="field"><span>Data</span><input id="ev-date" className="input" type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
            <label className="field"><span>Ritrovo</span><input id="ev-time" className="input" type="time" value={time} onChange={e => setTime(e.target.value)} /></label>
          </div>
          <label className="field"><span>Descrizione</span><textarea id="ev-desc" maxLength={2000} value={desc} onChange={e => setDesc(e.target.value)} /></label>
          <label className="switch">Pubblica nell’app<input id="ev-pub" type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} /></label>
        </div>

        <div className="sec">
          <h3>Tappe · {routing ? 'calcolo il percorso…' : route ? `${route.routed ? '' : '~'}${km(route.length)}${route.routed ? '' : ' (linea retta)'}` : 'aggiungine almeno due'}</h3>
          <div className="pois">
            {stops.map((s, i) => (
              <div key={i} className="item">
                <span className="n">{i + 1}</span>
                <span className="fields">
                  <input className="input" aria-label={`Nome tappa ${i + 1}`} value={s.name} onChange={e => upd(setStops, i, { name: e.target.value })} />
                  <input className="input" aria-label={`Nota tappa ${i + 1}`} placeholder="Nota (es. Comizio finale)" value={s.note} onChange={e => upd(setStops, i, { note: e.target.value })} />
                </span>
                <span className="acts">
                  <button className="mini" onClick={() => moveStop(i, -1)} aria-label="Sposta su">↑</button>
                  <button className="mini" onClick={() => moveStop(i, 1)} aria-label="Sposta giù">↓</button>
                  <button className="mini" onClick={() => del(setStops, i)} aria-label="Elimina tappa">✕</button>
                </span>
              </div>
            ))}
            {!stops.length && <p className="muted" style={{ fontSize: 12, margin: 0 }}>Nessuna tappa: tocca la mappa per mettere il ritrovo.</p>}
          </div>
        </div>

        <div className="sec">
          <h3>Punti di servizio</h3>
          <div className="pois">
            {pois.map((p, i) => (
              <div key={i} className="item">
                <span style={{ marginTop: 8 }}><Badge type={p.type} /></span>
                <span className="fields">
                  <input className="input" aria-label="Nome punto" value={p.name} onChange={e => upd(setPois, i, { name: e.target.value })} />
                  <input className="input" aria-label="Nota punto" placeholder="Nota (es. 4 cabine, una accessibile)" value={p.note} onChange={e => upd(setPois, i, { note: e.target.value })} />
                </span>
                <span className="acts"><button className="mini" onClick={() => del(setPois, i)} aria-label="Elimina punto">✕</button></span>
              </div>
            ))}
            {!pois.length && <p className="muted" style={{ fontSize: 12, margin: 0 }}>Scegli un tipo nella barra sotto la mappa e tocca dove si trova.</p>}
          </div>
        </div>

        {err && <p className="err">{err}</p>}
        {event && (!confirmDel
          ? <button className="cta danger" onClick={() => setConfirmDel(true)}>Elimina manifestazione</button>
          : <button className="cta danger" disabled={busy} onClick={async () => { setBusy(true); try { await removeEvent(event.id); onClose(); } catch { setErr('Eliminazione non riuscita.'); setBusy(false); } }}>Conferma: elimina definitivamente</button>)}
      </div>
    </div>
  );
}
