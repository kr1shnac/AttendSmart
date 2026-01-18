import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.attendsmart.app",
  appName: "AttendSmart",
  webDir: "build",

  server: {
    // For development with live reload - connect phone and PC to same WiFi
    url: "http://172.20.10.3:3000",
    cleartext: true,
    androidScheme: "http",
  },

  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },

  ios: {
    contentInset: "automatic",
    allowsLinkPreview: false,
  },

  plugins: {
    Geolocation: {
      // High accuracy location
    },
    BluetoothLe: {
      displayStrings: {
        scanning: "Scanning for classroom beacons...",
        cancel: "Cancel",
        availableDevices: "Available Devices",
        noDeviceFound: "No beacon found",
      },
    },
    Camera: {
      presentationStyle: "fullscreen",
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#0a0a0a",
      showSpinner: true,
      spinnerColor: "#00d4ff",
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
