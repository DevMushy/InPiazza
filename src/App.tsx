import { useEffect, useState } from 'react';
import Home from './screens/Home';
import Account from './screens/Account';
import Organizer from './screens/Organizer';
import EventEditor from './screens/EventEditor';
import Admin from './screens/Admin';
import { completeLogin, listenNativeLinks, useSession } from './data/auth';
import { usePublicEvents } from './data/events';
import type { EventItem } from './types';

type View = { name: 'home' } | { name: 'account' } | { name: 'organizer' } | { name: 'editor'; event: EventItem | null } | { name: 'admin' };

export default function App() {
  const feed = usePublicEvents();
  const session = useSession();
  const [view, setView] = useState<View>({ name: 'home' });
  const [loginMsg, setLoginMsg] = useState<string | null>(null);
  const [askEmail, setAskEmail] = useState<((v: string | null) => void) | null>(null);

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
      {loginMsg && <div className="toast on" role="status" onClick={() => setLoginMsg(null)} style={{ pointerEvents: 'auto' }}>{loginMsg}</div>}
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
