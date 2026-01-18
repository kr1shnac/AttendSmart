import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";

class BiometricAuth {
  constructor() {
    this.API_BASE = "http://localhost:5000/api/auth";
  }

  // Check if biometric is supported
  async isSupported() {
    return (
      window.PublicKeyCredential !== undefined &&
      navigator.credentials !== undefined
    );
  }

  // Register biometric for first-time student
  async registerBiometric(usn) {
    try {
      if (!(await this.isSupported())) {
        throw new Error(
          "Biometric authentication not supported on this device"
        );
      }

      // Step 1: Get registration options from server
      const optionsResponse = await fetch(
        `${this.API_BASE}/student/biometric/register-options`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usn }),
        }
      );

      if (!optionsResponse.ok) {
        const error = await optionsResponse.json();
        throw new Error(error.message || "Failed to get registration options");
      }

      const optionsData = await optionsResponse.json();
      const options = optionsData.data;

      // Step 2: Trigger device biometric (face/fingerprint)
      const credential = await startRegistration(options);

      // Step 3: Send credential to server for verification
      const verifyResponse = await fetch(
        `${this.API_BASE}/student/biometric/register-verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usn, credential }),
        }
      );

      if (!verifyResponse.ok) {
        const error = await verifyResponse.json();
        throw new Error(error.message || "Biometric registration failed");
      }

      const result = await verifyResponse.json();
      return result;
    } catch (error) {
      console.error("Biometric registration error:", error);
      throw error;
    }
  }

  // Login with biometric
  async loginWithBiometric() {
    try {
      if (!(await this.isSupported())) {
        throw new Error(
          "Biometric authentication not supported on this device"
        );
      }

      // Step 1: Get authentication options from server
      const optionsResponse = await fetch(
        `${this.API_BASE}/student/biometric/login-options`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!optionsResponse.ok) {
        const error = await optionsResponse.json();
        throw new Error(error.message || "Failed to get login options");
      }

      const optionsData = await optionsResponse.json();
      const options = optionsData.data;

      // Step 2: Trigger device biometric (face/fingerprint)
      const credential = await startAuthentication(options);

      // Step 3: Verify credential with server
      const verifyResponse = await fetch(
        `${this.API_BASE}/student/biometric/login-verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential }),
        }
      );

      if (!verifyResponse.ok) {
        const error = await verifyResponse.json();
        throw new Error(error.message || "Biometric login failed");
      }

      const result = await verifyResponse.json();
      return result;
    } catch (error) {
      console.error("Biometric login error:", error);
      throw error;
    }
  }

  // Manual login with USN + DOB (fallback)
  async loginManual(usn, dateOfBirth) {
    try {
      const response = await fetch(`${this.API_BASE}/student/login-manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usn, dateOfBirth }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Login failed");
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Manual login error:", error);
      throw error;
    }
  }

  // Teacher login
  async loginTeacher(email, password) {
    try {
      const response = await fetch(`${this.API_BASE}/teacher/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Login failed");
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Teacher login error:", error);
      throw error;
    }
  }
}

export default BiometricAuth;
