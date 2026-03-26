import { launchImageLibrary, launchCamera, ImagePickerResponse, MediaType } from 'react-native-image-picker';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import RNFS from 'react-native-fs';

export interface ProcessedImageResult {
  uri: string;
  size: number;
  format: string;
  processedAt: string;
}

export interface DeviceInfo {
  platform: string;
  version: string;
  model: string;
  cameraAvailable: boolean;
}

class CameraService {
  async pickFromGallery(): Promise<string | null> {
    return new Promise((resolve) => {
      const options = {
        mediaType: 'photo' as MediaType,
        quality: 0.8,
        includeBase64: false,
        maxHeight: 1024,
        maxWidth: 1024,
      };

      launchImageLibrary(options, (response: ImagePickerResponse) => {
        if (response.didCancel || response.errorMessage) {
          resolve(null);
          return;
        }

        if (response.assets && response.assets[0]) {
          resolve(response.assets[0].uri || null);
        } else {
          resolve(null);
        }
      });
    });
  }

  async captureFromCamera(): Promise<string | null> {
    return new Promise((resolve) => {
      const options = {
        mediaType: 'photo' as MediaType,
        quality: 0.8,
        includeBase64: false,
        maxHeight: 1024,
        maxWidth: 1024,
      };

      launchCamera(options, (response: ImagePickerResponse) => {
        if (response.didCancel || response.errorMessage) {
          resolve(null);
          return;
        }

        if (response.assets && response.assets[0]) {
          resolve(response.assets[0].uri || null);
        } else {
          resolve(null);
        }
      });
    });
  }

  async processDocument(imageUri: string): Promise<ProcessedImageResult> {
    try {
      const processedUri = await this.optimizeImage(imageUri);
      const fileInfo = await RNFS.stat(processedUri);
      
      return {
        uri: processedUri,
        size: fileInfo.size,
        format: this.getImageFormat(processedUri),
        processedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error processing document:', error);
      throw new Error('Failed to process document');
    }
  }

  private async optimizeImage(imageUri: string): Promise<string> {
    try {
      const timestamp = Date.now();
      const outputPath = `${RNFS.CachesDirectoryPath}/optimized_${timestamp}.jpg`;
      
      await RNFS.copyFile(imageUri, outputPath);
      
      return outputPath;
    } catch (error) {
      console.error('Error optimizing image:', error);
      return imageUri;
    }
  }

  private getImageFormat(uri: string): string {
    const extension = uri.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'JPEG';
      case 'png':
        return 'PNG';
      case 'webp':
        return 'WebP';
      default:
        return 'Unknown';
    }
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    return {
      platform: Platform.OS,
      version: Platform.Version.toString(),
      model: Platform.select({
        ios: 'iOS Device',
        android: 'Android Device',
        default: 'Unknown Device',
      }) || 'Unknown Device',
      cameraAvailable: await this.checkCameraAvailability(),
    };
  }

  private async checkCameraAvailability(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.CAMERA
        );
        return granted;
      }
      return true;
    } catch (error) {
      console.error('Error checking camera availability:', error);
      return false;
    }
  }

  async requestCameraPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'Verinode needs access to your camera to scan documents',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      return true;
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      return false;
    }
  }

  async validateImage(imageUri: string): Promise<boolean> {
    try {
      const fileInfo = await RNFS.stat(imageUri);
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      if (fileInfo.size > maxSize) {
        Alert.alert(
          'Image Too Large',
          'Please select an image smaller than 10MB'
        );
        return false;
      }

      const supportedFormats = ['jpg', 'jpeg', 'png', 'webp'];
      const format = this.getImageFormat(imageUri);
      
      if (!supportedFormats.includes(format.toLowerCase())) {
        Alert.alert(
          'Unsupported Format',
          'Please select a JPG, PNG, or WebP image'
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating image:', error);
      return false;
    }
  }

  async extractTextFromImage(imageUri: string): Promise<string> {
    try {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve('OCR functionality would be implemented here');
        }, 1000);
      });
    } catch (error) {
      console.error('Error extracting text from image:', error);
      return '';
    }
  }

  async detectDocumentBounds(imageUri: string): Promise<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null> {
    try {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            x: 50,
            y: 50,
            width: 200,
            height: 300,
          });
        }, 500);
      });
    } catch (error) {
      console.error('Error detecting document bounds:', error);
      return null;
    }
  }

  async cropDocument(
    imageUri: string,
    bounds: { x: number; y: number; width: number; height: number }
  ): Promise<string> {
    try {
      const timestamp = Date.now();
      const outputPath = `${RNFS.CachesDirectoryPath}/cropped_${timestamp}.jpg`;
      
      await RNFS.copyFile(imageUri, outputPath);
      
      return outputPath;
    } catch (error) {
      console.error('Error cropping document:', error);
      return imageUri;
    }
  }

  async saveToAppStorage(imageUri: string): Promise<string> {
    try {
      const timestamp = Date.now();
      const fileName = `proof_${timestamp}.jpg`;
      const outputPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
      
      await RNFS.copyFile(imageUri, outputPath);
      
      return outputPath;
    } catch (error) {
      console.error('Error saving to app storage:', error);
      throw new Error('Failed to save image');
    }
  }

  async cleanupTempFiles(): Promise<void> {
    try {
      const cacheDir = RNFS.CachesDirectoryPath;
      const files = await RNFS.readDir(cacheDir);
      
      const tempFiles = files.filter(file => 
        file.name.includes('optimized_') || 
        file.name.includes('cropped_')
      );

      for (const file of tempFiles) {
        try {
          await RNFS.unlink(file.path);
        } catch (error) {
          console.error(`Error deleting temp file ${file.path}:`, error);
        }
      }
    } catch (error) {
      console.error('Error cleaning up temp files:', error);
    }
  }
}

export default new CameraService();
