import { Back, Chevron } from '../components/Icons';
import { TYPE_LABEL } from '../constants';
import { useMyEvents } from '../data/events';
import { fmtDate, km, todayISO } from '../lib/format';
import type { EventItem } from '../types';

interface Props { uid: string; orgName: string | null; onBack: () => void; onEdit: (ev: EventItem | null) => void }

export default function Organizer({ uid, orgName, onBack, onEdit }: Props) {
  const list = useMyEvents(uid);
  const today = todayISO();
  return (
    <div className="panel">
      <div className="panel-top">
        <button className="back" onClick={onBack} aria-label="Indietro"><Back /></button>
        <h1>Le tue manifestazioni</h1>
      </div>
      <div className="panel-body">
        <button className="cta" onClick={() => onEdit(null)}>+ Nuova manifestazione</button>
        {!list.length && <div className="empty">Non hai ancora creato manifestazioni{orgName ? ` per ${orgName}` : ''}.</div>}
        {list.map(ev => {
          const past = ev.date < today;
          return (
            <button key={ev.id} className="my-ev" onClick={() => onEdit(ev)}>
              <span>
                <b>{ev.title}</b>
                <small>{TYPE_LABEL[ev.type]} · {fmtDate(ev.date, true)} · {ev.time} · {km(ev.length)}</small><br />
                <span className={'status ' + (past ? 'draft' : ev.published ? 'ok' : 'draft')} style={{ marginTop: 6 }}>
                  {past ? 'Conclusa' : ev.published ? 'Pubblicata' : 'Bozza'}
                </span>
              </span>
              <Chevron />
            </button>
          );
        })}
      </div>
    </div>
  );
}
