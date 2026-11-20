import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.minimalist.pocketarcade',
  appName: 'Pocket Arcade',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
