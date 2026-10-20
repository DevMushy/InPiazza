# In Piazza

App per le manifestazioni: mappa in bianco e nero con percorsi, punti di servizio, filtri e scheda di dettaglio.
Un solo codice React per **web**, **iPhone** e **Android** (con Capacitor), dati su **Firebase**.

- Il pubblico **non fa login** e l'app non raccoglie nessun dato su di lui (niente Analytics, niente tracciamento, font inclusi nell'app).
- Il login serve **solo agli organizzatori**: accesso con link via email, senza password. L'unico dato personale salvato è l'email.
- Gli organizzatori approvati creano e pubblicano le manifestazioni direttamente dall'app (tappe e punti si mettono toccando la mappa).

## Stack

| Parte | Cosa |
|---|---|
| UI | React 18 + TypeScript + Vite |
| Mappa | MapLibre GL + stile vettoriale OpenFreeMap (gratuito, senza chiave), ricolorato in `src/lib/recolor.ts` |
| Percorsi | OSRM pedonale, chiamato **solo** quando un organizzatore salva; il percorso viene salvato nel documento |
| Dati | Cloud Firestore (cache offline attiva) |
| Login | Firebase Auth, link email |
| App native | Capacitor 7 (iOS + Android) |
| Web | Firebase Hosting |

## 1. Avvio veloce (senza Firebase)

```bash
npm install
npm run dev
```

Senza `.env.local` l'app parte con dati di esempio su Firenze, così vedi subito mappa e interfaccia.

## 2. Collegare Firebase

1. Crea un progetto su <https://console.firebase.google.com>.
2. **Firestore Database** → Crea database (modalità produzione, regione `europe-west`).
3. **Authentication** → Metodo di accesso → attiva **Email/password** e, sotto, **Link email (accesso senza password)**.
   Non attivare altri provider: Google o Apple salverebbero anche nome e foto.
4. **Authentication → Impostazioni → Domini autorizzati**: aggiungi il dominio dove pubblichi il web (es. `tuo-progetto.web.app`) e `localhost`.
5. **Impostazioni progetto → Le tue app → Web** → registra un'app e copia i valori in `.env.local`:

```bash
cp .env.example .env.local
# poi compila VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID, VITE_PUBLIC_URL
```

6. Pubblica regole e indici:

```bash
npm i -g firebase-tools
firebase login
firebase use --add            # scegli il progetto
npm run deploy:rules
```

7. **Il primo admin** si crea a mano: accedi una volta dall'app, copia il tuo UID da Authentication → Utenti, poi in Firestore crea il documento `admins/<UID>` (anche vuoto, ad es. con un campo `note: "io"`).
   Da quel momento nell'app vedi **Richieste di accesso**.

8. (Facoltativo) Dati di esempio con percorsi veri:

```bash
# Impostazioni progetto → Account di servizio → Genera nuova chiave → salvala come ./service-account.json (è nel .gitignore)
npm run seed -- <UID-proprietario>
```

## 3. Come funziona l'accesso organizzatori

```
utente ─► inserisce email ─► riceve il link ─► lo apre ─► è dentro
       ─► compila “Nome organizzazione” (+ messaggio facoltativo) ─► accessRequests/{uid} (status: pending)
admin  ─► Approva ─► crea organizers/{uid} e CANCELLA la richiesta (email compresa)
       ─► Rifiuta  ─► resta solo status: rejected, l'email viene cancellata
organizzatore ─► crea / modifica / pubblica le sue manifestazioni (events, ownerUid = suo uid)
```

L'utente può ritirare la richiesta, uscire o **eliminare l'account** dall'app.

### Dati salvati

| Collezione | Contenuto | Chi legge |
|---|---|---|
| `events/{id}` | dati pubblici della manifestazione + `ownerUid` | tutti se `published`, altrimenti solo il proprietario |
| `accessRequests/{uid}` | nome organizzazione, messaggio, email (solo finché in attesa), stato | l'utente stesso e gli admin |
| `organizers/{uid}` | nome organizzazione, data di approvazione | l'utente stesso e gli admin |
| `admins/{uid}` | niente di personale | l'utente stesso |
| Firebase Auth | email | solo la console del progetto |

Le regole in `firestore.rules` accettano **solo** questi campi: un client modificato non può aggiungerne altri.

### Notifiche

Due canali di notifiche push (Firebase Cloud Messaging, gratuito):

| Canale | Chi lo riceve | Quando |
|---|---|---|
| `eventi` | chi tocca la 🔔 nella schermata principale | una manifestazione viene pubblicata (una volta sola per manifestazione) |
| `admin-richieste` | gli admin che lo attivano dal proprio account | arriva una nuova richiesta organizzatore (solo il nome dell'organizzazione, non l'email) |

**Nessun dato dei dispositivi finisce nel database**: il token del dispositivo viene passato a Firebase per l'iscrizione al canale e non viene salvato da nessun'altra parte. Per evitare doppioni le funzioni scrivono solo `notified/{id}` (ora di invio), che i client non possono né leggere né scrivere.

Le funzioni sono in `api/` e girano su Vercel:
- `push-subscribe.js`: iscrive/disiscrive un dispositivo (per il canale admin controlla che chi chiama sia admin);
- `notify-event.js`: chiamata dall'app quando un organizzatore salva una manifestazione pubblicata;
- `notify-request.js`: chiamata quando qualcuno invia la richiesta di accesso (manda anche un'email se configuri Resend).

**Configurazione**
1. Firebase → Impostazioni progetto → **Cloud Messaging** → *Certificati push web* → **Genera coppia di chiavi**. Copia la chiave in `VITE_FIREBASE_VAPID_KEY`.
2. Firebase → Impostazioni progetto → Generali: copia **ID mittente** (o `messagingSenderId` della configurazione web) in `VITE_FIREBASE_MESSAGING_SENDER_ID`.
3. Firebase → Impostazioni progetto → **Account di servizio** → *Genera nuova chiave privata*. Su Vercel crea la variabile `FIREBASE_SERVICE_ACCOUNT` e incolla **tutto il contenuto** del file JSON. È una chiave con pieni poteri: non metterla mai nel codice o su GitHub.
4. Su Vercel aggiungi anche `VITE_FIREBASE_VAPID_KEY` e `VITE_FIREBASE_MESSAGING_SENDER_ID`, poi ridistribuisci.

**iPhone (web)**: Safari mostra le notifiche solo se il sito è aggiunto alla schermata Home (Condividi → Aggiungi alla schermata Home) e aperto da lì. L'app lo spiega quando tocchi la 🔔.

**App native**: il plugin `@capacitor-firebase/messaging` usa gli stessi canali. Servono `GoogleService-Info.plist` (iOS, più una chiave APNs caricata in Firebase → Cloud Messaging) e `google-services.json` (Android), da scaricare da Firebase registrando le app iOS e Android. Segui la guida del plugin: <https://github.com/capawesome-team/capacitor-firebase/tree/main/packages/messaging>.

**Email facoltativa per le richieste**: aggiungi su Vercel `RESEND_API_KEY` e `ADMIN_EMAIL` (vedi [Resend](https://resend.com); senza dominio verificato può scrivere solo all'indirizzo con cui ti sei registrato).

## 4. Pubblicare il web

```bash
npm run deploy:web     # build + Firebase Hosting
```

## 5. App iPhone e Android

Serve un Mac con Xcode per iOS e Android Studio per Android.

```bash
npm run build
npx cap add ios
npx cap add android
npm run ios        # apre Xcode
npm run android    # apre Android Studio
```

Dopo ogni modifica al codice: `npm run cap:sync`.

Prima di pubblicare cambia `appId` in `capacitor.config.ts` (e `VITE_IOS_BUNDLE_ID` / `VITE_ANDROID_PACKAGE` in `.env.local`) con il tuo identificativo.

### Link email dentro l'app nativa

Il link di accesso punta a `VITE_PUBLIC_URL/accedi`. Perché si apra nell'app invece che nel browser:

**iOS**
1. In Xcode → target App → *Signing & Capabilities* → **Associated Domains** → aggiungi `applinks:tuo-progetto.web.app`.
2. In `public/.well-known/apple-app-site-association` sostituisci `TEAMID` con il tuo Team ID Apple, poi `npm run deploy:web`.

**Android**
1. In `android/app/src/main/AndroidManifest.xml`, dentro l'`<activity>` principale, aggiungi:

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https" android:host="tuo-progetto.web.app" android:pathPrefix="/accedi" />
</intent-filter>
```

2. In `public/.well-known/assetlinks.json` metti lo SHA-256 del certificato di firma (`./gradlew signingReport`), poi `npm run deploy:web`.

L'app riceve il link con `@capacitor/app` (`appUrlOpen`) e completa l'accesso in `src/data/auth.ts`.

> Attenzione: dopo la chiusura di Firebase Dynamic Links, i link email per le app passano dal dominio di **Firebase Hosting** del progetto. Prima di pubblicare controlla nella guida Firebase “Autenticazione con link email” (sezioni iOS e Android) quale dominio compare nel link che ricevi, e configura i link universali / App Links su **quel** dominio (se è un dominio personalizzato, puoi passarlo con `linkDomain` in `actionSettings()` dentro `src/data/auth.ts`).
Finché i link universali non sono configurati, gli organizzatori possono comunque accedere dalla versione web.

## 6. Mappa e routing

In `.env.local` (o `src/config.ts`):

- `VITE_MAP_STYLE_URL`: OpenFreeMap va bene anche in produzione. In alternativa MapTiler (`https://api.maptiler.com/maps/dataviz/style.json?key=…`) o Stadia.
  Con `recolor: false` in `src/config.ts` tieni lo stile originale.
- `VITE_GEOCODER_URL`: ricerca indirizzi nell'editor, predefinito Photon (`https://photon.komoot.io`), gratuito e senza chiave. Lo usano solo gli organizzatori.
- `VITE_ROUTER_URL`: il server OSRM pubblico di FOSSGIS è pensato per prove, con limiti d'uso. Siccome lo usano solo gli organizzatori al salvataggio, il traffico è basso; per sicurezza in produzione usa un tuo OSRM/Valhalla/GraphHopper o un servizio a pagamento. Se il routing non risponde, il percorso viene salvato in linea retta (le distanze compaiono con “~”).

## Struttura

```
src/
  App.tsx                 navigazione tra le schermate, completamento login da link
  config.ts               variabili d'ambiente, mappa, routing
  firebase.ts             init Firebase (senza Analytics)
  data/auth.ts            sessione, link email, richiesta accesso, elimina account
  data/events.ts          letture/scritture Firestore, approvazioni admin
  data/sample-events.json dati di esempio (usati anche da scripts/seed.mjs)
  components/MapView.tsx  mappa MapLibre: percorsi, segnaposti, punti, editor
  components/BottomSheet.tsx  scheda a tre altezze trascinabile
  screens/Home.tsx        mappa + filtri + lista + dettagli
  screens/Account.tsx     accesso e richiesta organizzatore
  screens/Organizer.tsx   elenco delle proprie manifestazioni
  screens/EventEditor.tsx crea/modifica: tocca la mappa per tappe e punti
  screens/Admin.tsx       approva o rifiuta le richieste
firestore.rules           regole di sicurezza
```

## Da fare prima della pubblicazione sugli store

- Icona e splash (`npx @capacitor/assets generate` partendo da `assets/icon.png`).
- Informativa privacy (gli store la chiedono): con questa configurazione dichiari solo “email, per l'account organizzatore”.
- Sostituire i dati di esempio e decidere chi sono gli admin.
- Se vuoi notificare l'approvazione via email serve una Cloud Function (non inclusa).
