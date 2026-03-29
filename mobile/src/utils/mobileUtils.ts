import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-netinfo/netinfo';
import ReactNativeBiometrics from 'react-native-biometrics';
import PushNotification from 'react-native-push-notification';

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPassword = (password: string): boolean => {
  return password.length >= 8;
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return formatDate(dateString);
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substr(0, maxLength) + '...';
};

export const getDevicePlatform = (): string => {
  return Platform.OS;
};

export const isIOS = (): boolean => Platform.OS === 'ios';
export const isAndroid = (): boolean => Platform.OS === 'android';

export const showErrorAlert = (title: string, message: string) => {
  Alert.alert(title, message, [{ text: 'OK' }], { cancelable: false });
};

export const showConfirmationAlert = (
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
) => {
  Alert.alert(
    title,
    message,
    [
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
      { text: 'OK', onPress: onConfirm },
    ],
    { cancelable: true }
  );
};

export const checkNetworkConnectivity = async (): Promise<boolean> => {
  try {
    const netInfo = await NetInfo.fetch();
    return netInfo.isConnected ?? false;
  } catch (error) {
    console.error('Error checking network connectivity:', error);
    return false;
  }
};

export const storage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('Error saving to storage:', error);
      throw error;
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('Error reading from storage:', error);
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from storage:', error);
      throw error;
    }
  },

  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  },
};

export const biometrics = {
  async isAvailable(): Promise<boolean> {
    try {
      const { available } = await ReactNativeBiometrics.isSensorAvailable();
      return available;
    } catch (error) {
      console.error('Error checking biometrics availability:', error);
      return false;
    }
  },

  async authenticate(reason: string): Promise<boolean> {
    try {
      const { available } = await ReactNativeBiometrics.isSensorAvailable();
      if (!available) {
        showErrorAlert('Biometrics', 'Biometric authentication is not available on this device');
        return false;
      }

      const { success } = await ReactNativeBiometrics.simplePrompt({
        promptMessage: reason,
        cancelButtonText: 'Cancel',
      });

      return success;
    } catch (error) {
      console.error('Error during biometric authentication:', error);
      return false;
    }
  },
};

export const notifications = {
  configure(): void {
    PushNotification.configure({
      onRegister: (token) => {
        console.log('Push notification token:', token);
      },
      onNotification: (notification) => {
        console.log('Notification received:', notification);
        
        if (notification.userInteraction) {
          // User tapped the notification
          console.log('User interacted with notification');
        }
      },
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });
  },

  async requestPermissions(): Promise<boolean> {
    return new Promise((resolve) => {
      PushNotification.requestPermissions((permissions) => {
        resolve(permissions.alert || permissions.badge || permissions.sound);
      });
    });
  },

  showLocalNotification(title: string, message: string): void {
    PushNotification.localNotification({
      channelId: 'verinode-notifications',
      title,
      message,
      playSound: true,
      soundName: 'default',
      importance: 'high',
      vibrate: true,
    });
  },

  scheduleNotification(
    title: string,
    message: string,
    date: Date
  ): void {
    PushNotification.localNotificationSchedule({
      channelId: 'verinode-notifications',
      title,
      message,
      date,
      playSound: true,
      soundName: 'default',
      importance: 'high',
      vibrate: true,
    });
  },
};

export const deepLinks = {
  createProofShareLink(proofId: string): string {
    return `verinode://proof/${proofId}`;
  },

  parseDeepLink(url: string): { type: string; id: string } | null => {
    const patterns = [
      { regex: /verinode:\/\/proof\/([^\/]+)/, type: 'proof' },
      { regex: /verinode:\/\/profile\/([^\/]+)/, type: 'profile' },
      { regex: /verinode:\/\/settings/, type: 'settings' },
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern.regex);
      if (match) {
        return { type: pattern.type, id: match[1] };
      }
    }

    return null;
  },
};

export const performance = {
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },
};

export const validation = {
  proof: {
    title: (title: string): string | null => {
      if (!title.trim()) return 'Title is required';
      if (title.length > 100) return 'Title must be less than 100 characters';
      return null;
    },

    description: (description: string): string | null => {
      if (!description.trim()) return 'Description is required';
      if (description.length > 500) return 'Description must be less than 500 characters';
      return null;
    },
  },

  user: {
    email: (email: string): string | null => {
      if (!email.trim()) return 'Email is required';
      if (!isValidEmail(email)) return 'Please enter a valid email';
      return null;
    },

    password: (password: string): string | null => {
      if (!password) return 'Password is required';
      if (!isValidPassword(password)) return 'Password must be at least 8 characters';
      return null;
    },
  },
};

export const constants = {
  API_ENDPOINTS: {
    PROOFS: '/proofs',
    AUTH: '/auth',
    USER: '/user',
  },

  STORAGE_KEYS: {
    AUTH_TOKEN: 'auth_token',
    USER_DATA: 'user_data',
    CACHED_PROOFS: 'cached_proofs',
    SETTINGS: 'app_settings',
  },

  ANIMATION_DURATION: {
    SHORT: 200,
    MEDIUM: 300,
    LONG: 500,
  },

  LIMITS: {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_TITLE_LENGTH: 100,
    MAX_DESCRIPTION_LENGTH: 500,
  },
};
