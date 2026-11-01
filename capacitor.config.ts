import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.onuratabay.sayactakip',
  appName: 'Sayaç Takip',
  webDir: 'dist',
  // The app opens the published web app, so Android always runs the same version as the web.
  server: {
    url: 'https://sayac-takip.onuratabay.com',
    errorPath: 'offline.html'
  }
};

export default config;
