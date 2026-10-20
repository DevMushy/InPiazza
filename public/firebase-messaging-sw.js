/* Service worker per le notifiche web. La configurazione Firebase arriva nell'indirizzo di registrazione. */
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

const cfg = Object.fromEntries(new URL(self.location.href).searchParams.entries());
// messagingSenderId è obbligatorio: se manca lo ricavo dall'appId (1:<sender>:web:...)
if (!cfg.messagingSenderId && cfg.appId) cfg.messagingSenderId = cfg.appId.split(':')[1];

try {
  if (cfg.apiKey && cfg.projectId) {
    firebase.initializeApp(cfg);
    // Le notifiche con titolo e testo vengono mostrate da Firebase anche ad app chiusa;
    // al tocco si apre il link indicato dal server (pagina della manifestazione).
    firebase.messaging();
  }
} catch (e) {
  console.error('[firebase-messaging-sw]', e);
}
