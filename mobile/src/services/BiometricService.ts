import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

export interface BiometricResult {
  success: boolean;
  error?: string;
  biometricType?: string;
}

export interface BiometricOptions {
  title: string;
  subtitle?: string;
  description?: string;
  fallbackTitle?: string;
  cancelTitle?: string;
}

export class BiometricService {
  private rnBiometrics: ReactNativeBiometrics;
  private readonly BIOMETRIC_KEY = 'biometric_enabled';
  private readonly CREDENTIALS_KEY = 'encrypted_credentials';

  constructor() {
    this.rnBiometrics = new ReactNativeBiometrics({
      allowDeviceCredentials: true,
    });
  }

  /**
   * Check if biometric authentication is available on the device
   */
  async isAvailable(): Promise<boolean> {
    try {
      const { available } = await this.rnBiometrics.isSensorAvailable();
      return available;
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return false;
    }
  }

  /**
   * Get available biometric types on the device
   */
  async getAvailableBiometrics(): Promise<string[]> {
    try {
      const { available, biometryType } = await this.rnBiometrics.isSensorAvailable();
      
      if (!available) {
        return [];
      }

      const biometrics: string[] = [];
      
      switch (biometryType) {
        case BiometryTypes.TouchID:
          biometrics.push('Touch ID');
          break;
        case BiometryTypes.FaceID:
          biometrics.push('Face ID');
          break;
        case BiometryTypes.Biometrics:
          // For Android, check specific types
          biometrics.push('Fingerprint');
          // Could also check for Iris, Voice etc. based on device capabilities
          break;
      }

      return biometrics;
    } catch (error) {
      console.error('Error getting available biometrics:', error);
      return [];
    }
  }

  /**
   * Authenticate user with biometrics
   */
  async authenticate(biometricType?: string, options?: BiometricOptions): Promise<BiometricResult> {
    try {
      const isSensorAvailable = await this.isAvailable();
      if (!isSensorAvailable) {
        return {
          success: false,
          error: 'Biometric authentication is not available on this device',
        };
      }

      const { available } = await this.rnBiometrics.isSensorAvailable();
      if (!available) {
        return {
          success: false,
          error: 'No biometric sensor available',
        };
      }

      const authResult = await this.rnBiometrics.simplePrompt({
        promptMessage: options?.title || 'Authenticate to continue',
        cancelButtonText: options?.cancelTitle || 'Cancel',
      });

      if (authResult.success) {
        // Get the actual biometric type used
        const { biometryType } = await this.rnBiometrics.isSensorAvailable();
        let detectedType = 'Unknown';
        
        switch (biometryType) {
          case BiometryTypes.TouchID:
            detectedType = 'Touch ID';
            break;
          case BiometryTypes.FaceID:
            detectedType = 'Face ID';
            break;
          case BiometryTypes.Biometrics:
            detectedType = biometricType || 'Fingerprint';
            break;
        }

        return {
          success: true,
          biometricType: detectedType,
        };
      } else {
        return {
          success: false,
          error: 'Authentication was cancelled or failed',
        };
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  /**
   * Enable biometric authentication for the app
   */
  async enableBiometric(): Promise<BiometricResult> {
    try {
      // First authenticate to ensure user can use biometrics
      const authResult = await this.authenticate();
      if (!authResult.success) {
        return authResult;
      }

      // Create biometric keys
      const { publicKey } = await this.rnBiometrics.createKeys();
      
      // Store biometric enabled flag
      await AsyncStorage.setItem(this.BIOMETRIC_KEY, 'true');
      
      return {
        success: true,
      };
    } catch (error) {
      console.error('Error enabling biometric:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enable biometric',
      };
    }
  }

  /**
   * Disable biometric authentication
   */
  async disableBiometric(): Promise<BiometricResult> {
    try {
      // Delete biometric keys
      await this.rnBiometrics.deleteKeys();
      
      // Remove biometric enabled flag
      await AsyncStorage.removeItem(this.BIOMETRIC_KEY);
      await AsyncStorage.removeItem(this.CREDENTIALS_KEY);
      
      return {
        success: true,
      };
    } catch (error) {
      console.error('Error disabling biometric:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disable biometric',
      };
    }
  }

  /**
   * Check if biometric authentication is enabled
   */
  async isBiometricEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(this.BIOMETRIC_KEY);
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking biometric enabled status:', error);
      return false;
    }
  }

  /**
   * Save credentials securely using biometric protection
   */
  async saveCredentials(username: string, password: string): Promise<BiometricResult> {
    try {
      // First authenticate
      const authResult = await this.authenticate();
      if (!authResult.success) {
        return authResult;
      }

      // Encrypt credentials
      const credentials = JSON.stringify({ username, password });
      const encryptedCredentials = this.encryptData(credentials);
      
      // Store encrypted credentials
      await AsyncStorage.setItem(this.CREDENTIALS_KEY, encryptedCredentials);
      
      return {
        success: true,
      };
    } catch (error) {
      console.error('Error saving credentials:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save credentials',
      };
    }
  }

  /**
   * Retrieve credentials using biometric authentication
   */
  async getCredentials(): Promise<BiometricResult & { username?: string; password?: string }> {
    try {
      // First authenticate
      const authResult = await this.authenticate();
      if (!authResult.success) {
        return authResult;
      }

      // Get encrypted credentials
      const encryptedCredentials = await AsyncStorage.getItem(this.CREDENTIALS_KEY);
      if (!encryptedCredentials) {
        return {
          success: false,
          error: 'No saved credentials found',
        };
      }

      // Decrypt credentials
      const decryptedCredentials = this.decryptData(encryptedCredentials);
      const { username, password } = JSON.parse(decryptedCredentials);
      
      return {
        success: true,
        username,
        password,
      };
    } catch (error) {
      console.error('Error retrieving credentials:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve credentials',
      };
    }
  }

  /**
   * Clear saved credentials
   */
  async clearCredentials(): Promise<BiometricResult> {
    try {
      await AsyncStorage.removeItem(this.CREDENTIALS_KEY);
      return {
        success: true,
      };
    } catch (error) {
      console.error('Error clearing credentials:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear credentials',
      };
    }
  }

  /**
   * Check if credentials are saved
   */
  async hasCredentials(): Promise<boolean> {
    try {
      const credentials = await AsyncStorage.getItem(this.CREDENTIALS_KEY);
      return credentials !== null;
    } catch (error) {
      console.error('Error checking saved credentials:', error);
      return false;
    }
  }

  /**
   * Get device-specific biometric information
   */
  async getBiometricInfo(): Promise<{
    available: boolean;
    type?: string;
    supportedTypes: string[];
    isEnabled: boolean;
  }> {
    try {
      const { available, biometryType } = await this.rnBiometrics.isSensorAvailable();
      const supportedTypes = await this.getAvailableBiometrics();
      const isEnabled = await this.isBiometricEnabled();
      
      let detectedType: string | undefined;
      switch (biometryType) {
        case BiometryTypes.TouchID:
          detectedType = 'Touch ID';
          break;
        case BiometryTypes.FaceID:
          detectedType = 'Face ID';
          break;
        case BiometryTypes.Biometrics:
          detectedType = 'Fingerprint';
          break;
      }

      return {
        available,
        type: detectedType,
        supportedTypes,
        isEnabled,
      };
    } catch (error) {
      console.error('Error getting biometric info:', error);
      return {
        available: false,
        supportedTypes: [],
        isEnabled: false,
      };
    }
  }

  /**
   * Create biometric signature for sensitive operations
   */
  async createSignature(payload: string): Promise<BiometricResult & { signature?: string }> {
    try {
      // First authenticate
      const authResult = await this.authenticate();
      if (!authResult.success) {
        return authResult;
      }

      // Create signature
      const { signature } = await this.rnBiometrics.createSignature({
        payload: CryptoJS.SHA256(payload).toString(),
      });
      
      return {
        success: true,
        signature,
      };
    } catch (error) {
      console.error('Error creating biometric signature:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create signature',
      };
    }
  }

  /**
   * Verify biometric signature
   */
  async verifySignature(payload: string, signature: string): Promise<boolean> {
    try {
      const { verified } = await this.rnBiometrics.verifySignature({
        payload: CryptoJS.SHA256(payload).toString(),
        signature,
      });
      
      return verified;
    } catch (error) {
      console.error('Error verifying signature:', error);
      return false;
    }
  }

  /**
   * Show biometric setup dialog
   */
  async showBiometricSetupDialog(): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        'Enable Biometric Authentication',
        'Use your fingerprint or face to quickly and securely access your account.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Enable',
            onPress: async () => {
              const result = await this.enableBiometric();
              resolve(result.success);
            },
          },
        ],
      );
    });
  }

  // Private helper methods

  private encryptData(data: string): string {
    try {
      // In a real app, use a more secure encryption method
      // This is a simplified example
      const secretKey = 'verinode-biometric-key-2024';
      return CryptoJS.AES.encrypt(data, secretKey).toString();
    } catch (error) {
      console.error('Error encrypting data:', error);
      throw error;
    }
  }

  private decryptData(encryptedData: string): string {
    try {
      const secretKey = 'verinode-biometric-key-2024';
      const bytes = CryptoJS.AES.decrypt(encryptedData, secretKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Error decrypting data:', error);
      throw error;
    }
  }

  /**
   * Get platform-specific biometric name
   */
  private getPlatformBiometricName(): string {
    switch (Platform.OS) {
      case 'ios':
        return 'Face ID or Touch ID';
      case 'android':
        return 'Fingerprint or Biometric';
      default:
        return 'Biometric';
    }
  }

  /**
   * Validate biometric strength
   */
  private validateBiometricStrength(type: string): 'weak' | 'medium' | 'strong' {
    switch (type.toLowerCase()) {
      case 'face id':
      case 'face':
        return 'strong';
      case 'touch id':
      case 'fingerprint':
        return 'medium';
      case 'iris':
        return 'strong';
      case 'voice':
        return 'weak';
      default:
        return 'medium';
    }
  }

  /**
   * Get biometric security level
   */
  async getSecurityLevel(): Promise<'low' | 'medium' | 'high'> {
    try {
      const { type } = await this.getBiometricInfo();
      if (!type) return 'low';
      
      const strength = this.validateBiometricStrength(type);
      switch (strength) {
        case 'strong':
          return 'high';
        case 'medium':
          return 'medium';
        case 'weak':
          return 'low';
        default:
          return 'medium';
      }
    } catch (error) {
      console.error('Error getting security level:', error);
      return 'low';
    }
  }
}
