import type { CapacitorConfig } from '@capacitor/cli';

// Cambia appId con il tuo identificativo (deve coincidere con iOS bundle id e Android package)
const config: CapacitorConfig = {
  appId: 'it.inpiazza.app',
  appName: 'In Piazza',
  webDir: 'dist',
  ios: { contentInset: 'never' },
  android: { allowMixedContent: false }
};

export default config;
