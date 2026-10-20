import { useEffect, useState } from 'react';
import Home from './screens/Home';
import Account from './screens/Account';
import Organizer from './screens/Organizer';
import EventEditor from './screens/EventEditor';
import Admin from './screens/Admin';
import { completeLogin, listenNativeLinks, useSession } from './data/auth';
import { usePublicEvents } from './data/events';
import { listenPush } from './lib/push';
import { openEvent } from './lib/ui';
import type { EventItem } from './types';

type View = { name: 'home' } | { name: 'account' } | { name: 'organizer' } | { name: 'editor'; event: EventItem | null } | { name: 'admin' };

export default function App() {
  const feed = usePublicEvents();
  const session = useSession();
  const [view, setView] = useState<View>({ name: 'home' });
  const [loginMsg, setLoginMsg] = useState<string | null>(null);
  const [askEmail, setAskEmail] = useState<((v: string | null) => void) | null>(null);

  // messaggi brevi e notifiche ricevute con l'app aperta
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const show = (m: string) => { setNote(m); clearTimeout(t); t = setTimeout(() => setNote(null), 4000); };
    const h = (e: Event) => show((e as CustomEvent<string>).detail);
    window.addEventListener('inpiazza:toast', h);
    const off = listenPush((title, body) => show(body ? `${title}: ${body}` : title), id => { setView({ name: 'home' }); openEvent(id); });
    return () => { window.removeEventListener('inpiazza:toast', h); off(); clearTimeout(t); };
  }, []);

  // completa l'accesso dal link email (web: URL attuale; app: universal/app link)
  useEffect(() => {
    const ask = () => new Promise<string | null>(res => setAskEmail(() => res));
    const handle = (url: string) => completeLogin(url, ask)
      .then(ok => { if (ok) { setView({ name: 'account' }); setLoginMsg(null); } })
      .catch(() => setLoginMsg('Il link di accesso non è valido o è scaduto. Richiedine uno nuovo.'));
    handle(window.location.href);
    return listenNativeLinks(handle);
  }, []);

  const uid = session.user?.uid;
  return (
    <>
      <Home feed={feed} onAccount={() => setView({ name: 'account' })} accountBadge={session.isOrganizer} />
      {view.name !== 'home' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 30, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div className="phone" style={{ background: 'transparent', boxShadow: 'none', pointerEvents: 'auto' }}>
            {view.name === 'account' && <Account session={session} onBack={() => setView({ name: 'home' })}
              onOrganizer={() => setView({ name: 'organizer' })} onAdmin={() => setView({ name: 'admin' })} />}
            {view.name === 'organizer' && uid && <Organizer uid={uid} orgName={session.orgName} onBack={() => setView({ name: 'account' })} onEdit={ev => setView({ name: 'editor', event: ev })} />}
            {view.name === 'editor' && uid && <EventEditor uid={uid} orgName={session.orgName} event={view.event} onClose={() => setView({ name: 'organizer' })} />}
            {view.name === 'admin' && <Admin onBack={() => setView({ name: 'account' })} />}
          </div>
        </div>
      )}
      {askEmail && <EmailPrompt onDone={v => { askEmail(v); setAskEmail(null); }} />}
      {(loginMsg || note) && <div className="toast on" role="status" onClick={() => { setLoginMsg(null); setNote(null); }} style={{ pointerEvents: 'auto', position: 'fixed', zIndex: 40 }}>{loginMsg || note}</div>}
    </>
  );
}

/** Se il link viene aperto su un altro dispositivo serve riconfermare l'email */
function EmailPrompt({ onDone }: { onDone: (v: string | null) => void }) {
  const [v, setV] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 20, background: 'var(--scrim)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <form className="box" style={{ background: 'var(--surface)', width: 'min(360px, 100%)' }} onSubmit={e => { e.preventDefault(); onDone(v.trim()); }}>
        <h2>Conferma la tua email</h2>
        <p className="lead">Hai aperto il link su un dispositivo diverso: scrivi l’email a cui l’hai ricevuto.</p>
        <input id="confirm-email" className="input" type="email" required value={v} onChange={e => setV(e.target.value)} autoFocus />
        <div className="actions">
          <button type="button" className="cta ghost" onClick={() => onDone(null)}>Annulla</button>
          <button className="cta">Accedi</button>
        </div>
      </form>
    </div>
  );
}
