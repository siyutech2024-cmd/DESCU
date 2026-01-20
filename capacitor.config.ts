import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.venya.marketplace',
  appName: 'DESCU',
  webDir: 'dist',
  server: {
    // 仅在开发环境下使用本地服务器
    // 生产环境此配置被忽略
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#ffffff",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false
    },
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
