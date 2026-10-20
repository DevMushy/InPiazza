const env = import.meta.env;

export const CONFIG = {
  firebase: {
    apiKey: env.VITE_FIREBASE_API_KEY as string,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string,
    projectId: env.VITE_FIREBASE_PROJECT_ID as string,
    appId: env.VITE_FIREBASE_APP_ID as string,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string
  },
  // Chiave pubblica per le notifiche web (Firebase → Impostazioni progetto → Cloud Messaging → Certificati push web)
  vapidKey: (env.VITE_FIREBASE_VAPID_KEY as string) || '',
  publicUrl: (env.VITE_PUBLIC_URL as string) || window.location.origin,
  iosBundleId: (env.VITE_IOS_BUNDLE_ID as string) || 'it.inpiazza.app',
  androidPackage: (env.VITE_ANDROID_PACKAGE as string) || 'it.inpiazza.app',
  // Stile vettoriale gratuito senza chiave. Alternative con chiave: MapTiler, Stadia.
  mapStyleUrl: (env.VITE_MAP_STYLE_URL as string) || 'https://tiles.openfreemap.org/styles/positron',
  // Routing pedonale usato SOLO quando un organizzatore salva un percorso. Il pubblico non lo chiama mai.
  routerUrl: (env.VITE_ROUTER_URL as string) || 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/',
  // Ricerca indirizzi (Photon, basato su OpenStreetMap): usata solo nell'editor degli organizzatori.
  // Nota: Photon accetta solo lang=default/en/de/fr; "default" restituisce i nomi locali (Firenze, Toscana)
  geocoderUrl: (env.VITE_GEOCODER_URL as string) || 'https://photon.komoot.io',
  center: [11.2558, 43.7731] as [number, number],
  zoom: 14.2,
  recolor: true
};

/** Indirizzo delle funzioni su Vercel: sul web stesso dominio, nelle app il dominio pubblico */
export const apiUrl = (path: string) => (isNativeApp() ? CONFIG.publicUrl.replace(/\/$/, '') : '') + path;
function isNativeApp() { return typeof window !== 'undefined' && !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.(); }

export const firebaseConfigured = Boolean(CONFIG.firebase.apiKey && CONFIG.firebase.projectId);
