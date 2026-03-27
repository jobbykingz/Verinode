import { Platform, Alert, Linking, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchCamera, launchImageLibrary, MediaType } from 'react-native-image-picker';
import Geolocation from '@react-native-community/geolocation';

export interface DeviceInfo {
  platform: string;
  version: string;
  model: string;
  brand: string;
  systemVersion: string;
  appVersion: string;
  buildNumber: string;
  deviceId: string;
  isEmulator: boolean;
}

export interface PermissionStatus {
  camera: boolean;
  location: boolean;
  photos: boolean;
  contacts: boolean;
  microphone: boolean;
  notifications: boolean;
}

export interface DeviceCapability {
  hasCamera: boolean;
  hasGPS: boolean;
  hasBiometric: boolean;
  biometricType?: 'Touch ID' | 'Face ID' | 'Fingerprint' | 'None';
  hasFlashlight: boolean;
  hasVibration: boolean;
  hasBluetooth: boolean;
  hasNFC: boolean;
}

export interface MediaOptions {
  quality?: number;
  maxFileSize?: number;
  allowEdit?: boolean;
  mediaType?: 'photo' | 'video' | 'mixed';
  durationLimit?: number; // for video
}

export interface MediaResult {
  uri: string;
  type: string;
  fileName?: string;
  fileSize?: number;
  width?: number;
  height?: number;
  duration?: number; // for video
  metadata?: any;
}

export interface LocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export class DeviceService {
  private static instance: DeviceService;
  private deviceInfo: DeviceInfo | null = null;
  private permissions: PermissionStatus;

  private constructor() {
    this.permissions = {
      camera: false,
      location: false,
      photos: false,
      contacts: false,
      microphone: false,
      notifications: false,
    };
  }

  static getInstance(): DeviceService {
    if (!DeviceService.instance) {
      DeviceService.instance = new DeviceService();
    }
    return DeviceService.instance;
  }

  /**
   * Get comprehensive device information
   */
  async getDeviceInfo(): Promise<DeviceInfo> {
    if (this.deviceInfo) {
      return this.deviceInfo;
    }

    try {
      const deviceInfo: DeviceInfo = {
        platform: Platform.OS,
        version: Platform.Version,
        model: 'Unknown', // Would need react-native-device-info
        brand: 'Unknown',
        systemVersion: Platform.Version,
        appVersion: '1.0.0', // Would get from app config
        buildNumber: '1',
        deviceId: await this.getDeviceId(),
        isEmulator: Platform.isPad || Platform.isTVOS, // Simplified check
      };

      this.deviceInfo = deviceInfo;
      await AsyncStorage.setItem('device_info', JSON.stringify(deviceInfo));
      return deviceInfo;
    } catch (error) {
      console.error('Error getting device info:', error);
      throw error;
    }
  }

  /**
   * Get unique device identifier
   */
  private async getDeviceId(): Promise<string> {
    try {
      let deviceId = await AsyncStorage.getItem('device_id');
      
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem('device_id', deviceId);
      }
      
      return deviceId;
    } catch (error) {
      console.error('Error getting device ID:', error);
      return 'unknown_device';
    }
  }

  /**
   * Check device capabilities
   */
  async getDeviceCapabilities(): Promise<DeviceCapability> {
    try {
      const capabilities: DeviceCapability = {
        hasCamera: await this.hasCameraCapability(),
        hasGPS: await this.hasGPSCapability(),
        hasBiometric: await this.hasBiometricCapability(),
        biometricType: await this.getBiometricType(),
        hasFlashlight: await this.hasFlashlightCapability(),
        hasVibration: await this.hasVibrationCapability(),
        hasBluetooth: await this.hasBluetoothCapability(),
        hasNFC: await this.hasNFCCapability(),
      };

      return capabilities;
    } catch (error) {
      console.error('Error checking device capabilities:', error);
      throw error;
    }
  }

  /**
   * Check permission status for various device features
   */
  async getPermissionStatus(): Promise<PermissionStatus> {
    try {
      const permissions: PermissionStatus = {
        camera: await this.checkCameraPermission(),
        location: await this.checkLocationPermission(),
        photos: await this.checkPhotosPermission(),
        contacts: await this.checkContactsPermission(),
        microphone: await this.checkMicrophonePermission(),
        notifications: await this.checkNotificationPermission(),
      };

      this.permissions = permissions;
      return permissions;
    } catch (error) {
      console.error('Error checking permission status:', error);
      throw error;
    }
  }

  /**
   * Request camera permission
   */
  async requestCameraPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA
        );
        this.permissions.camera = granted === PermissionsAndroid.RESULTS.GRANTED;
        return this.permissions.camera;
      } else {
        // iOS permissions are handled by the system
        this.permissions.camera = true;
        return true;
      }
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      return false;
    }
  }

  /**
   * Request location permission
   */
  async requestLocationPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const fineLocation = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        const coarseLocation = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
        );
        
        this.permissions.location = fineLocation === PermissionsAndroid.RESULTS.GRANTED ||
                                  coarseLocation === PermissionsAndroid.RESULTS.GRANTED;
        return this.permissions.location;
      } else {
        this.permissions.location = true;
        return true;
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  }

  /**
   * Request storage permission for photos
   */
  async requestPhotosPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
        );
        this.permissions.photos = granted === PermissionsAndroid.RESULTS.GRANTED;
        return this.permissions.photos;
      } else {
        this.permissions.photos = true;
        return true;
      }
    } catch (error) {
      console.error('Error requesting photos permission:', error);
      return false;
    }
  }

  /**
   * Request contacts permission
   */
  async requestContactsPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS
        );
        this.permissions.contacts = granted === PermissionsAndroid.RESULTS.GRANTED;
        return this.permissions.contacts;
      } else {
        this.permissions.contacts = true;
        return true;
      }
    } catch (error) {
      console.error('Error requesting contacts permission:', error);
      return false;
    }
  }

  /**
   * Request microphone permission
   */
  async requestMicrophonePermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
        this.permissions.microphone = granted === PermissionsAndroid.RESULTS.GRANTED;
        return this.permissions.microphone;
      } else {
        this.permissions.microphone = true;
        return true;
      }
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      return false;
    }
  }

  /**
   * Take photo using camera
   */
  async takePhoto(options: MediaOptions = {}): Promise<MediaResult> {
    try {
      const hasPermission = await this.checkCameraPermission();
      if (!hasPermission) {
        const granted = await this.requestCameraPermission();
        if (!granted) {
          throw new Error('Camera permission denied');
        }
      }

      return new Promise((resolve, reject) => {
        launchCamera(
          {
            mediaType: 'photo',
            quality: options.quality || 0.8,
            maxWidth: 1920,
            maxHeight: 1080,
            includeExtra: true,
          },
          (response) => {
            if (response.didCancel) {
              reject(new Error('Camera operation cancelled'));
              return;
            }

            if (response.errorCode) {
              reject(new Error('Camera error: ' + response.errorMessage));
              return;
            }

            if (response.assets && response.assets[0]) {
              const asset = response.assets[0];
              const result: MediaResult = {
                uri: asset.uri!,
                type: asset.type || 'image/jpeg',
                fileName: asset.fileName,
                fileSize: asset.fileSize,
                width: asset.width,
                height: asset.height,
                metadata: {
                  timestamp: Date.now(),
                  source: 'camera',
                },
              };
              resolve(result);
            } else {
              reject(new Error('No photo captured'));
            }
          }
        );
      });
    } catch (error) {
      console.error('Error taking photo:', error);
      throw error;
    }
  }

  /**
   * Select photo from gallery
   */
  async selectPhoto(options: MediaOptions = {}): Promise<MediaResult> {
    try {
      const hasPermission = await this.checkPhotosPermission();
      if (!hasPermission) {
        const granted = await this.requestPhotosPermission();
        if (!granted) {
          throw new Error('Photos permission denied');
        }
      }

      return new Promise((resolve, reject) => {
        launchImageLibrary(
          {
            mediaType: 'photo',
            quality: options.quality || 0.8,
            includeExtra: true,
          },
          (response) => {
            if (response.didCancel) {
              reject(new Error('Photo selection cancelled'));
              return;
            }

            if (response.errorCode) {
              reject(new Error('Gallery error: ' + response.errorMessage));
              return;
            }

            if (response.assets && response.assets[0]) {
              const asset = response.assets[0];
              const result: MediaResult = {
                uri: asset.uri!,
                type: asset.type || 'image/jpeg',
                fileName: asset.fileName,
                fileSize: asset.fileSize,
                width: asset.width,
                height: asset.height,
                metadata: {
                  timestamp: Date.now(),
                  source: 'gallery',
                },
              };
              resolve(result);
            } else {
              reject(new Error('No photo selected'));
            }
          }
        );
      });
    } catch (error) {
      console.error('Error selecting photo:', error);
      throw error;
    }
  }

  /**
   * Record video
   */
  async recordVideo(options: MediaOptions = {}): Promise<MediaResult> {
    try {
      const hasPermission = await this.checkCameraPermission();
      if (!hasPermission) {
        const granted = await this.requestCameraPermission();
        if (!granted) {
          throw new Error('Camera permission denied');
        }
      }

      return new Promise((resolve, reject) => {
        launchCamera(
          {
            mediaType: 'video',
            quality: options.quality || 0.8,
            durationLimit: options.durationLimit || 60,
            includeExtra: true,
          },
          (response) => {
            if (response.didCancel) {
              reject(new Error('Video recording cancelled'));
              return;
            }

            if (response.errorCode) {
              reject(new Error('Video recording error: ' + response.errorMessage));
              return;
            }

            if (response.assets && response.assets[0]) {
              const asset = response.assets[0];
              const result: MediaResult = {
                uri: asset.uri!,
                type: asset.type || 'video/mp4',
                fileName: asset.fileName,
                fileSize: asset.fileSize,
                duration: asset.duration,
                metadata: {
                  timestamp: Date.now(),
                  source: 'camera',
                },
              };
              resolve(result);
            } else {
              reject(new Error('No video recorded'));
            }
          }
        );
      });
    } catch (error) {
      console.error('Error recording video:', error);
      throw error;
    }
  }

  /**
   * Get current location
   */
  async getCurrentLocation(options: LocationOptions = {}): Promise<LocationData> {
    try {
      const hasPermission = await this.checkLocationPermission();
      if (!hasPermission) {
        const granted = await this.requestLocationPermission();
        if (!granted) {
          throw new Error('Location permission denied');
        }
      }

      return new Promise((resolve, reject) => {
        Geolocation.getCurrentPosition(
          (position) => {
            const locationData: LocationData = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              altitude: position.coords.altitude,
              accuracy: position.coords.accuracy,
              heading: position.coords.heading,
              speed: position.coords.speed,
              timestamp: position.timestamp || Date.now(),
            };
            resolve(locationData);
          },
          (error) => {
            let errorMessage = 'Location error';
            switch (error.code) {
              case 1:
                errorMessage = 'Location permission denied';
                break;
              case 2:
                errorMessage = 'Location unavailable';
                break;
              case 3:
                errorMessage = 'Location request timeout';
                break;
            }
            reject(new Error(errorMessage));
          },
          {
            enableHighAccuracy: options.enableHighAccuracy || true,
            timeout: options.timeout || 15000,
            maximumAge: options.maximumAge || 60000,
          }
        );
      });
    } catch (error) {
      console.error('Error getting location:', error);
      throw error;
    }
  }

  /**
   * Calculate distance between two points
   */
  calculateDistance(from: LocationData, to: LocationData): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (from.latitude * Math.PI) / 180;
    const φ2 = (to.latitude * Math.PI) / 180;
    const Δφ = ((to.latitude - from.latitude) * Math.PI) / 180;
    const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Open device settings
   */
  async openSettings(): Promise<void> {
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('app-settings:');
      } else {
        await Linking.openURL('android.settings.APPLICATION_DETAILS');
      }
    } catch (error) {
      console.error('Error opening settings:', error);
      throw error;
    }
  }

  /**
   * Open app store for rating
   */
  async openAppStore(): Promise<void> {
    try {
      const url = Platform.OS === 'ios'
        ? 'itms-apps://itunes.apple.com/app/id123456789' // Replace with actual app ID
        : 'market://details?id=com.verinode.app'; // Replace with actual package name
      
      await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening app store:', error);
      throw error;
    }
  }

  /**
   * Share content
   */
  async shareContent(options: {
    title?: string;
    message?: string;
    url?: string;
    subject?: string;
  }): Promise<void> {
    try {
      const { Share } = await import('react-native');
      
      await Share.share({
        title: options.title,
        message: options.message,
        url: options.url,
        subject: options.subject,
      });
    } catch (error) {
      console.error('Error sharing content:', error);
      throw error;
    }
  }

  /**
   * Check if app has background location permission (Android 10+)
   */
  async hasBackgroundLocationPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    
    try {
      const granted = await PermissionsAndroid.check(
        'android.permission.ACCESS_BACKGROUND_LOCATION'
      );
      return granted;
    } catch (error) {
      // Permission might not be available on older Android versions
      return true;
    }
  }

  /**
   * Request background location permission (Android 10+)
   */
  async requestBackgroundLocationPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    
    try {
      const granted = await PermissionsAndroid.request(
        'android.permission.ACCESS_BACKGROUND_LOCATION'
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      // Permission might not be available on older Android versions
      return true;
    }
  }

  /**
   * Private helper methods for capability checking
   */
  private async hasCameraCapability(): Promise<boolean> {
    // Simplified check - in production would use react-native-camera
    return true;
  }

  private async hasGPSCapability(): Promise<boolean> {
    // Most modern devices have GPS
    return true;
  }

  private async hasBiometricCapability(): Promise<boolean> {
    // Simplified check - in production would use react-native-biometrics
    return Platform.OS === 'ios' || (Platform.OS === 'android' && Platform.Version >= '6.0');
  }

  private async getBiometricType(): Promise<'Touch ID' | 'Face ID' | 'Fingerprint' | 'None'> {
    // Simplified - in production would use react-native-biometrics
    if (Platform.OS === 'ios') {
      return 'Touch ID'; // Could check for Face ID based on device model
    }
    return 'Fingerprint';
  }

  private async hasFlashlightCapability(): Promise<boolean> {
    // Most modern devices have flashlight
    return true;
  }

  private async hasVibrationCapability(): Promise<boolean> {
    // Most modern devices have vibration
    return true;
  }

  private async hasBluetoothCapability(): Promise<boolean> {
    // Most modern devices have Bluetooth
    return true;
  }

  private async hasNFCCapability(): Promise<boolean> {
    // Not all devices have NFC
    return false; // Simplified - would need react-native-nfc
  }

  private async checkCameraPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
    }
    return true; // iOS permissions are handled by the system
  }

  private async checkLocationPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const fineLocation = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      const coarseLocation = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
      );
      return fineLocation || coarseLocation;
    }
    return true;
  }

  private async checkPhotosPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
    }
    return true;
  }

  private async checkContactsPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CONTACTS);
    }
    return true;
  }

  private async checkMicrophonePermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    }
    return true;
  }

  private async checkNotificationPermission(): Promise<boolean> {
    // Simplified - would need platform-specific implementation
    return true;
  }

  /**
   * Get device battery level
   */
  async getBatteryLevel(): Promise<number> {
    try {
      const { DeviceInfo } = await import('react-native-device-info');
      const batteryLevel = await DeviceInfo.getBatteryLevel();
      return Math.round(batteryLevel * 100);
    } catch (error) {
      console.error('Error getting battery level:', error);
      return -1;
    }
  }

  /**
   * Check if device is in power saving mode
   */
  async isPowerSaveMode(): Promise<boolean> {
    try {
      const { DeviceInfo } = await import('react-native-device-info');
      return await DeviceInfo.isPowerSaveMode();
    } catch (error) {
      console.error('Error checking power save mode:', error);
      return false;
    }
  }

  /**
   * Get available memory info
   */
  async getMemoryInfo(): Promise<{
    totalMemory: number;
    usedMemory: number;
    freeMemory: number;
  }> {
    try {
      const { DeviceInfo } = await import('react-native-device-info');
      const totalMemory = await DeviceInfo.getTotalMemory();
      const usedMemory = await DeviceInfo.getUsedMemory();
      const freeMemory = totalMemory - usedMemory;
      
      return {
        totalMemory,
        usedMemory,
        freeMemory,
      };
    } catch (error) {
      console.error('Error getting memory info:', error);
      return {
        totalMemory: 0,
        usedMemory: 0,
        freeMemory: 0,
      };
    }
  }
}
