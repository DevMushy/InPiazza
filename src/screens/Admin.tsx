import { useState } from 'react';
import { Back } from '../components/Icons';
import { approveRequest, rejectRequest, usePendingRequests } from '../data/events';

export default function Admin({ onBack }: { onBack: () => void }) {
  const list = usePendingRequests(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const act = async (uid: string, fn: () => Promise<void>) => {
    setBusy(uid); setErr(null);
    try { await fn(); } catch { setErr('Operazione non riuscita. Controlla di essere admin.'); } finally { setBusy(null); }
  };
  return (
    <div className="panel">
      <div className="panel-top">
        <button className="back" onClick={onBack} aria-label="Indietro"><Back /></button>
        <h1>Richieste di accesso</h1>
      </div>
      <div className="panel-body">
        <p className="lead muted">Approvando, la persona diventa organizzatore e la richiesta (con l’email) viene cancellata. Rifiutando, resta solo lo stato “non approvata”.</p>
        {!list.length && <div className="empty">Nessuna richiesta in attesa.</div>}
        {list.map(r => (
          <div key={r.uid} className="box">
            <h2>{r.orgName}</h2>
            {r.email && <span style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-all' }}>{r.email}</span>}
            {r.note && <p className="lead">{r.note}</p>}
            <div className="actions">
              <button className="cta" disabled={busy === r.uid} onClick={() => act(r.uid, () => approveRequest(r))}>Approva</button>
              <button className="cta danger" disabled={busy === r.uid} onClick={() => act(r.uid, () => rejectRequest(r))}>Rifiuta</button>
            </div>
          </div>
        ))}
        {err && <p className="err">{err}</p>}
      </div>
    </div>
  );
}
