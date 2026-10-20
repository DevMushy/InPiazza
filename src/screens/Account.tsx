import { useState } from 'react';
import { Back } from '../components/Icons';
import { firebaseConfigured } from '../config';
import {
  completeLogin, deleteAccount, requestAccess, sendLoginLink, signOut, withdrawRequest, type Session
} from '../data/auth';
import { usePendingRequests } from '../data/events';
import { disablePush, enablePush, lastPushError, pushEnabled } from '../lib/push';
import { isStandalone, pushMessage } from '../lib/ui';

interface Props { session: Session; onBack: () => void; onOrganizer: () => void; onAdmin: () => void }

const errText = (e: unknown) => {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'auth/invalid-email') return 'Indirizzo email non valido.';
  if (code === 'auth/requires-recent-login') return 'Per sicurezza accedi di nuovo con il link email, poi riprova.';
  if (code === 'auth/quota-exceeded') return 'Troppi tentativi: riprova più tardi.';
  if (code === 'auth/invalid-action-code' || code === 'auth/expired-action-code') return 'Link non valido o già usato: richiedine uno nuovo.';
  if (code === 'permission-denied') return 'Operazione non permessa.';
  if (code === 'auth/operation-not-allowed') return 'Accesso con link email non attivo: in Firebase → Authentication → Metodo di accesso attiva Email/password e “Link email”.';
  if (code === 'auth/unauthorized-continue-uri' || code === 'auth/unauthorized-domain') return 'Questo dominio non è autorizzato: aggiungilo in Firebase → Authentication → Impostazioni → Domini autorizzati.';
  if (code === 'auth/invalid-continue-uri' || code === 'auth/missing-continue-uri') return 'Indirizzo di ritorno non valido: controlla VITE_PUBLIC_URL.';
  return 'Qualcosa non ha funzionato' + (code ? ` (${code})` : '') + '. Riprova tra poco.';
};

export default function Account({ session, onBack, onOrganizer, onAdmin }: Props) {
  const { user, loading, isOrganizer, isAdmin, request, orgName } = session;
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [org, setOrg] = useState('');
  const [note, setNote] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [pasted, setPasted] = useState('');
  const homeApp = isStandalone();
  const usePasted = () => run(async () => {
    const ok = await completeLogin(pasted.trim(), async () => email.trim() || null);
    if (!ok) throw { code: 'auth/invalid-action-code' };
  });
  const pending = usePendingRequests(isAdmin);
  const [adminPush, setAdminPush] = useState(() => pushEnabled('admin-richieste'));
  const [pushNote, setPushNote] = useState<string | null>(null);
  const toggleAdminPush = () => run(async () => {
    if (!user) return;
    if (adminPush) { await disablePush('admin-richieste', user); setAdminPush(false); setPushNote(null); return; }
    const r = await enablePush('admin-richieste', user);
    if (r === 'ok') { setAdminPush(true); setPushNote(null); } else setPushNote(pushMessage[r] + (r === 'error' && lastPushError ? ` (${lastPushError})` : ''));
  });

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr(null);
    try { await fn(); } catch (e) { console.error(e); setErr(errText(e)); } finally { setBusy(false); }
  };

  return (
    <div className="panel">
      <div className="panel-top">
        <button className="back" onClick={onBack} aria-label="Indietro"><Back /></button>
        <h1>{isOrganizer ? 'Il tuo account' : 'Accesso organizzatori'}</h1>
      </div>
      <div className="panel-body">
        {!firebaseConfigured && (
          <div className="box"><h2>Firebase non collegato</h2><p className="lead">Compila il file <code>.env.local</code> come spiegato nel README per attivare l’accesso.</p></div>
        )}

        {firebaseConfigured && !user && (
          <>
            <p className="lead">Per guardare le manifestazioni non serve nessun account. L’accesso serve solo a chi le organizza e vuole pubblicarle.</p>
            {!sent ? (
              <form className="box" onSubmit={e => { e.preventDefault(); run(async () => { await sendLoginLink(email.trim()); setSent(true); }); }}>
                <h2>Ricevi il link di accesso</h2>
                <label className="field"><span>Email</span>
                  <input id="login-email" className="input" type="email" inputMode="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@associazione.it" />
                </label>
                <button className="cta" disabled={busy || !email.includes('@')}>{busy ? 'Invio…' : 'Inviami il link'}</button>
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>Niente password: ti mandiamo un link, lo apri da questo dispositivo e sei dentro.</p>
              </form>
            ) : (
              <div className="box">
                <h2>Controlla la posta</h2>
                <p className="lead">Abbiamo inviato un link a <b>{email}</b>. Aprilo da questo dispositivo per completare l’accesso. Se non lo trovi guarda nello spam.</p>
                <button className="cta ghost" onClick={() => setSent(false)}>Usa un’altra email</button>
              </div>
            )}
            {homeApp && (
              <form className="box" onSubmit={e => { e.preventDefault(); usePasted(); }}>
                <h2>Se non entri da solo</h2>
                <p className="lead">Tocca il link nell’email: si apre Safari, poi torna qui e l’accesso si completa in pochi secondi. Se non succede, tieni premuto il link nell’email → <b>Copia link</b> e incollalo qui.</p>
                <input id="paste-link" className="input" inputMode="url" autoComplete="off" value={pasted} onChange={e => setPasted(e.target.value)} placeholder="https://…" />
                <button className="cta" disabled={busy || !pasted.includes('oobCode')}>{busy ? 'Accesso…' : 'Accedi'}</button>
              </form>
            )}
          </>
        )}

        {user && loading && <p className="lead muted">Carico il tuo profilo…</p>}

        {user && !loading && (
          <>
            <div className="box">
              <span className="muted" style={{ fontSize: 12 }}>Accesso come</span>
              <b style={{ fontSize: 15, wordBreak: 'break-all' }}>{user.email}</b>
              {isOrganizer && <span className="status ok">Organizzatore · {orgName}</span>}
              {!isOrganizer && request?.status === 'pending' && <span className="status wait">Richiesta in attesa · {request.orgName}</span>}
              {!isOrganizer && request?.status === 'rejected' && <span className="status no">Richiesta non approvata</span>}
            </div>

            {isOrganizer && <button className="cta" onClick={onOrganizer}>Gestisci le tue manifestazioni</button>}
            {isAdmin && <button className="cta ghost" onClick={onAdmin}>Richieste di accesso{pending.length ? ` (${pending.length})` : ''}</button>}
            {isAdmin && (
              <div className="box">
                <label className="switch">Notificami le nuove richieste
                  <input id="admin-push" type="checkbox" checked={adminPush} disabled={busy} onChange={toggleAdminPush} />
                </label>
                <p className="muted" style={{ fontSize: 12, margin: 0 }}>Vale solo per questo dispositivo. La notifica dice il nome dell’organizzazione, non l’email.</p>
                {pushNote && <p className="err" style={{ margin: 0 }}>{pushNote}</p>}
              </div>
            )}

            {!isOrganizer && !request && (
              <form className="box" onSubmit={e => { e.preventDefault(); run(() => requestAccess(user, org, note)); }}>
                <h2>Richiedi l’accesso da organizzatore</h2>
                <label className="field"><span>Nome dell’organizzazione</span>
                  <input id="req-org" className="input" required minLength={2} maxLength={80} value={org} onChange={e => setOrg(e.target.value)} placeholder="Es. Comitato Oltrarno" />
                </label>
                <label className="field"><span>Messaggio (facoltativo)</span>
                  <textarea id="req-note" maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="Chi siete e che tipo di iniziative organizzate" />
                </label>
                <button className="cta" disabled={busy || org.trim().length < 2}>{busy ? 'Invio…' : 'Invia richiesta'}</button>
              </form>
            )}
            {!isOrganizer && request?.status === 'pending' && (
              <div className="box">
                <p className="lead">Quando la richiesta sarà approvata, qui comparirà l’area organizzatori.</p>
                <button className="cta ghost" disabled={busy} onClick={() => run(() => withdrawRequest(user))}>Ritira la richiesta</button>
              </div>
            )}
            {!isOrganizer && request?.status === 'rejected' && (
              <button className="cta ghost" disabled={busy} onClick={() => run(() => withdrawRequest(user))}>Fai una nuova richiesta</button>
            )}

            <div className="box">
              <h2>Cosa salviamo</h2>
              <p className="lead">Solo la tua email, per farti accedere. Finché la richiesta è in attesa la vede anche chi la approva; dopo la decisione la togliamo dalla richiesta. Non usiamo statistiche né tracciamento.</p>
            </div>

            <div className="actions">
              <button className="cta ghost" disabled={busy} onClick={() => run(signOut)}>Esci</button>
              {!confirmDel
                ? <button className="cta danger" onClick={() => setConfirmDel(true)}>Elimina account</button>
                : <button className="cta danger" disabled={busy} onClick={() => run(() => deleteAccount(user))}>Conferma eliminazione</button>}
            </div>
            {confirmDel && <p className="muted" style={{ fontSize: 12, margin: 0 }}>Cancella email, richiesta e ruolo. Le manifestazioni già pubblicate restano: eliminale prima dall’area organizzatori se vuoi toglierle.</p>}
          </>
        )}
        {err && <p className="err">{err}</p>}
      </div>
    </div>
  );
}
