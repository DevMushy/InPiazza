/** Messaggio breve in basso (gestito da App) */
export const toast = (msg: string) => window.dispatchEvent(new CustomEvent('inpiazza:toast', { detail: msg }));
/** Apre una manifestazione nella schermata principale (gestito da Home) */
export const openEvent = (id: string) => window.dispatchEvent(new CustomEvent('inpiazza:open-event', { detail: id }));

export const pushMessage: Record<string, string> = {
  denied: 'Notifiche bloccate: attivale dalle impostazioni del browser o del telefono.',
  unsupported: 'Questo browser non supporta le notifiche.',
  unconfigured: 'Notifiche non ancora configurate: manca la chiave VITE_FIREBASE_VAPID_KEY.',
  'ios-install': 'Su iPhone: tocca Condividi → “Aggiungi alla schermata Home”, apri l’app da lì e riattiva le notifiche.',
  error: 'Non sono riuscito ad attivare le notifiche. Riprova tra poco.'
};
