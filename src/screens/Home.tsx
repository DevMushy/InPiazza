import { useEffect, useMemo, useRef, useState } from 'react';
import MapView, { type FitRequest, type PoiRef } from '../components/MapView';
import BottomSheet from '../components/BottomSheet';
import Badge from '../components/Badge';
import { Calendar, Caret, Chevron, NumPin, Person } from '../components/Icons';
import { POI_KEYS, POI_TYPES, TYPE_LABEL, TYPE_PLURAL } from '../constants';
import { addMin, durTxt, fmtDate, km, walkMin } from '../lib/format';
import type { Feed } from '../data/events';
import type { EventItem, EventType, PoiType, SheetMode } from '../types';

interface Props { feed: Feed; onAccount: () => void; accountBadge: boolean }

export default function Home({ feed, onAccount, accountBadge }: Props) {
  const [type, setType] = useState<EventType | ''>('');
  const [date, setDate] = useState('');
  const [poiOn, setPoiOn] = useState<Set<PoiType>>(new Set(POI_KEYS));
  const [selId, setSelId] = useState<string | null>(null);
  const [selPoi, setSelPoi] = useState<PoiRef | null>(null);
  const [sheet, setSheet] = useState<SheetMode>('closed');
  const [fit, setFit] = useState<FitRequest | null>(null);
  const phone = useRef<HTMLDivElement>(null);
  const mapWrap = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => feed.events.filter(e => (!type || e.type === type) && (!date || e.date === date)), [feed.events, type, date]);
  const dates = useMemo(() => [...new Set(feed.events.map(e => e.date))].sort(), [feed.events]);
  const types = useMemo(() => [...new Set(feed.events.map(e => e.type))], [feed.events]);
  const sel = visible.find(e => e.id === selId) ?? null;
  const shownSel = sel ?? visible[0] ?? null;

  const halfY = () => {
    const h = phone.current?.clientHeight ?? 800, w = mapWrap.current;
    return w ? Math.max(h * 0.5, w.offsetTop + w.offsetHeight * 0.62) : h * 0.5;
  };
  const covered = (m: SheetMode) => {
    const w = mapWrap.current; if (!w || m !== 'half') return 0;
    return Math.max(0, w.offsetTop + w.offsetHeight - halfY());
  };
  const fitTo = (ev: EventItem | null, m: SheetMode = sheet) => setFit(f => ({ key: (f?.key ?? 0) + 1, bbox: ev?.bbox ?? null, bottom: covered(m) }));

  // prima inquadratura quando arrivano i dati
  const firstFit = useRef(false);
  useEffect(() => {
    if (!firstFit.current && shownSel) { firstFit.current = true; fitTo(shownSel, 'closed'); }
  }, [shownSel]);

  const select = (id: string, open: boolean) => {
    const ev = visible.find(e => e.id === id) ?? null;
    setSelId(id); setSelPoi(null);
    const m: SheetMode = open ? 'half' : sheet;
    if (open) setSheet('half');
    setTimeout(() => fitTo(ev, m), 60);
  };
  const openPoi = (r: PoiRef) => {
    const ev = feed.events.find(e => e.id === r.eventId); if (!ev) return;
    setSelId(ev.id); setSelPoi(r); setSheet('half');
    const p = ev.pois[r.index];
    setTimeout(() => setFit(f => ({ key: (f?.key ?? 0) + 1, bbox: null, center: [p.lng, p.lat], zoom: 16.5, bottom: covered('half') })), 60);
  };
  const changeFilter = (fn: () => void) => { fn(); setSheet('closed'); setSelPoi(null); setSelId(null); firstFit.current = false; };
  const togglePoi = (k: PoiType) => setPoiOn(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const poiEv = selPoi ? feed.events.find(e => e.id === selPoi.eventId) : null;
  const poi = poiEv && selPoi ? poiEv.pois[selPoi.index] : null;

  return (
    <div className="phone" ref={phone}>
      <header className="top">
        <div className="brand">In Piazza</div>
        <button className="icon-btn" onClick={onAccount} aria-label={accountBadge ? 'Area organizzatori' : 'Accesso organizzatori'}><Person /></button>
      </header>

      <div className="map-wrap" ref={mapWrap}>
        <MapView
          events={visible} selectedId={shownSel?.id ?? null} poiOn={poiOn} selectedPoi={selPoi}
          onSelectEvent={id => select(id, true)} onSelectPoi={openPoi} fit={fit}
          label="Mappa con i percorsi delle manifestazioni"
        />
      </div>

      <div className="filters">
        <label className="pill">
          <Caret />
          <select value={type} onChange={e => changeFilter(() => setType(e.target.value as EventType | ''))} aria-label="Tipo di manifestazione">
            <option value="">Manifestazioni</option>
            {(Object.keys(TYPE_PLURAL) as EventType[]).filter(t => types.includes(t)).map(t => <option key={t} value={t}>{TYPE_PLURAL[t]}</option>)}
          </select>
        </label>
        <label className="pill">
          <Calendar />
          <select value={date} onChange={e => changeFilter(() => setDate(e.target.value))} aria-label="Data">
            <option value="">Tutte le date</option>
            {dates.map(d => <option key={d} value={d}>{fmtDate(d)}</option>)}
          </select>
        </label>
        <span className="sep" aria-hidden="true" />
        {POI_KEYS.map(k => (
          <button key={k} className="pill toggle" aria-pressed={poiOn.has(k)} onClick={() => togglePoi(k)}>
            <Badge type={k} />{POI_TYPES[k].label}
          </button>
        ))}
      </div>

      {feed.demo && <div className="banner">Dati di esempio: collega Firebase (file .env.local) per vedere le manifestazioni reali.</div>}
      {feed.error && <div className="banner err">Errore nel caricare i dati: {feed.error}</div>}

      <div className="list">
        {feed.loading && <div className="empty">Carico le manifestazioni…</div>}
        {!feed.loading && !visible.length && (
          <div className="empty">{feed.events.length ? <>Nessuna manifestazione con questi filtri.<br />Prova un’altra data o tipo.</> : 'Non ci sono manifestazioni in programma.'}</div>
        )}
        {visible.map((ev, i) => (
          <div key={ev.id} className={'card' + (ev.id === shownSel?.id ? ' sel' : '')} tabIndex={0}
            onClick={() => select(ev.id, false)} onKeyDown={e => { if (e.key === 'Enter') select(ev.id, true); }}>
            <NumPin n={i + 1} />
            <span className="card-body">
              <span className="card-title">{ev.title}</span>
              <span className="card-org">{ev.orgs.join(' · ')}</span>
              <span className="card-meta">{TYPE_LABEL[ev.type]} · {fmtDate(ev.date, true)} · {ev.time} · {ev.routed ? '' : '~'}{km(ev.length)}</span>
              <span className="card-desc">{ev.desc}</span>
            </span>
            <button className="go" aria-label={'Dettagli ' + ev.title} onClick={e => { e.stopPropagation(); select(ev.id, true); }}><Chevron /></button>
          </div>
        ))}
      </div>

      <BottomSheet
        mode={sheet} onMode={m => { setSheet(m); if (m === 'closed') setSelPoi(null); }}
        halfY={halfY} container={phone}
        eyebrow={poi ? POI_TYPES[poi.type].label : shownSel ? TYPE_LABEL[shownSel.type] + ' · ' + fmtDate(shownSel.date, true) : ''}
        title={poi ? poi.name || POI_TYPES[poi.type].label : shownSel?.title ?? ''}
        scrollKey={(selPoi ? selPoi.eventId + selPoi.index : '') + (shownSel?.id ?? '')}
      >
        {poi && poiEv && selPoi
          ? <PoiDetail ev={poiEv} index={selPoi.index} n={visible.indexOf(poiEv) + 1} onEvent={() => { setSelPoi(null); setSheet('full'); }} />
          : shownSel && <EventDetail ev={shownSel} poiOn={poiOn} onPoi={i => openPoi({ eventId: shownSel.id, index: i })}
              onShow={() => { setSheet('half'); setTimeout(() => fitTo(shownSel, 'half'), 60); }} />}
      </BottomSheet>
    </div>
  );
}

function EventDetail({ ev, poiOn, onPoi, onShow }: { ev: EventItem; poiOn: Set<PoiType>; onPoi: (i: number) => void; onShow: () => void }) {
  const total = walkMin(ev.type, ev.length);
  const pois = ev.pois.map((p, i) => ({ p, i, d: ev.poiDist[i] })).filter(x => poiOn.has(x.p.type)).sort((a, b) => a.d - b.d);
  const start = ev.stops[0];
  return (
    <>
      <div className="facts">
        <div className="fact"><b>Ritrovo</b><span>{ev.time}</span></div>
        <div className="fact"><b>Arrivo stimato</b><span>{addMin(ev.time, total)}</span></div>
        <div className="fact"><b>Lunghezza</b><span>{ev.routed ? '' : '~'}{km(ev.length)}</span></div>
        <div className="fact"><b>Durata a piedi</b><span>{durTxt(total)}</span></div>
      </div>
      {ev.orgs.length > 0 && <div className="sec"><h3>Organizzano</h3><div className="tags">{ev.orgs.map(o => <span key={o} className="tag">{o}</span>)}</div></div>}
      {ev.desc && <div className="sec"><h3>Descrizione</h3><p>{ev.desc}</p></div>}
      <div className="sec"><h3>Percorso</h3>
        <ol className="timeline">
          {ev.stops.map((s, i) => (
            <li key={i}>
              <time>{addMin(ev.time, walkMin(ev.type, ev.stopDist[i] ?? 0))}</time><span className="dot" />
              <span className="stop">{s.name}<small>{s.note}{i ? ' · ' + km(ev.stopDist[i] ?? 0) : ''}</small></span>
            </li>
          ))}
        </ol>
      </div>
      <div className="sec"><h3>Punti di servizio</h3>
        <div className="pois">
          {pois.length ? pois.map(({ p, i, d }) => (
            <button key={i} className="poi-row" onClick={() => onPoi(i)}>
              <Badge type={p.type} />
              <span><b>{p.name || POI_TYPES[p.type].label}</b><small>{POI_TYPES[p.type].label}{p.note ? ' · ' + p.note : ''}</small></span>
              <em>{d > 30 ? km(d) : 'partenza'}</em>
            </button>
          )) : <p className="muted" style={{ fontSize: 12 }}>Nessun punto da mostrare.</p>}
        </div>
      </div>
      <div className="actions">
        <button className="cta" onClick={onShow}>Mostra sulla mappa</button>
        {start && <a className="cta ghost" target="_blank" rel="noopener noreferrer"
          href={`https://www.google.com/maps/dir/?api=1&destination=${start.lat},${start.lng}&travelmode=walking`}>Portami al ritrovo</a>}
      </div>
    </>
  );
}

function PoiDetail({ ev, index, n, onEvent }: { ev: EventItem; index: number; n: number; onEvent: () => void }) {
  const p = ev.pois[index], d = ev.poiDist[index];
  return (
    <>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Badge type={p.type} big />
        <p className="lead">{p.note || 'Punto di servizio lungo il percorso.'}</p>
      </div>
      <div className="facts">
        <div className="fact"><b>Dal ritrovo</b><span>{d > 30 ? km(d) : 'Partenza'}</span></div>
        <div className="fact"><b>Passaggio corteo</b><span>{addMin(ev.time, walkMin(ev.type, d))}</span></div>
      </div>
      <div className="sec"><h3>Fa parte di</h3>
        <button className="poi-row" onClick={onEvent}>
          <span className="badge" style={{ background: 'var(--accent)', color: '#fff' }}>{n > 0 ? n : '•'}</span>
          <span><b>{ev.title}</b><small>{TYPE_LABEL[ev.type]} · {fmtDate(ev.date, true)} · {ev.time}</small></span>
          <em>›</em>
        </button>
      </div>
    </>
  );
}
