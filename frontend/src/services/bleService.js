import { API_BASE_URL } from "../config/api";

class BLEService {
  constructor() {
    this.scanning = false;
    this.connectedDevice = null;
    this.onDeviceFoundCallback = null;
    this.bleSupported = false;
    this.checkBLESupport();
  }

  // Check if Web Bluetooth API is supported
  checkBLESupport() {
    if (navigator.bluetooth) {
      this.bleSupported = true;
      console.log("✅ Web Bluetooth API supported");
    } else {
      this.bleSupported = false;
      console.warn("⚠️ Web Bluetooth API not supported in this browser");
    }
  }

  // Request BLE device (for teacher beacon setup)
  async requestDevice() {
    if (!this.bleSupported) {
      throw new Error("Web Bluetooth is not supported in this browser");
    }

    try {
      console.log("📡 Requesting BLE device...");

      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ["battery_service", "device_information"],
      });

      this.connectedDevice = device;
      console.log("✅ Device connected:", device.name);

      return {
        id: device.id,
        name: device.name || "Unknown Device",
        connected: true,
      };
    } catch (error) {
      console.error("❌ BLE device request failed:", error);
      throw error;
    }
  }

  // Scan for nearby BLE devices
  async startScanning(onDeviceFound) {
    this.onDeviceFoundCallback = onDeviceFound;
    this.scanning = true;

    console.log("📡 BLE scanning started...");

    // Call backend API to scan for beacons
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/api/ble/scan`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === "success" && data.devices) {
          data.devices.forEach((device) => {
            if (this.onDeviceFoundCallback) {
              this.onDeviceFoundCallback(device);
            }
          });
        }
      }
    } catch (error) {
      console.error("Error scanning for BLE devices:", error);
    }
  }

  // Stop scanning
  stopScanning() {
    this.scanning = false;
    console.log("📡 BLE scanning stopped");
  }

  // Disconnect device
  async disconnect() {
    if (this.connectedDevice && this.connectedDevice.gatt.connected) {
      await this.connectedDevice.gatt.disconnect();
      this.connectedDevice = null;
      console.log("🔌 Device disconnected");
    }
  }

  // Calculate distance from RSSI
  calculateDistance(rssi, txPower = -59) {
    const N = 2.0; // Environmental factor
    return Math.pow(10, (txPower - rssi) / (10 * N));
  }

  // Get signal quality
  getSignalQuality(rssi) {
    if (rssi >= -50)
      return { quality: "excellent", color: "#10b981", icon: "📶" };
    if (rssi >= -60) return { quality: "good", color: "#00d4ff", icon: "📶" };
    if (rssi >= -70) return { quality: "fair", color: "#fbbf24", icon: "📶" };
    return { quality: "poor", color: "#ef4444", icon: "📶" };
  }

  // Check if BLE is supported
  isSupported() {
    return this.bleSupported;
  }
}

export default new BLEService();
