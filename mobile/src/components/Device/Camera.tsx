import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Animated,
  Dimensions,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ImagePicker from 'react-native-image-picker';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';

export interface CameraOptions {
  quality?: number;
  format?: 'jpeg' | 'png';
  maxFileSize?: number;
  allowEdit?: boolean;
  includeExtra?: boolean;
}

export interface CameraResult {
  uri: string;
  width: number;
  height: number;
  fileSize: number;
  type: string;
  fileName?: string;
  metadata?: {
    location?: {
      latitude: number;
      longitude: number;
    };
    timestamp: number;
    device?: string;
  };
}

export interface CameraComponentProps {
  onCapture: (result: CameraResult) => void;
  onError: (error: string) => void;
  onClose: () => void;
  mode?: 'camera' | 'gallery' | 'both';
  options?: CameraOptions;
  allowMultiple?: boolean;
  maxImages?: number;
  showControls?: boolean;
  flashMode?: 'on' | 'off' | 'auto';
  cameraType?: 'front' | 'back';
}

const { width, height } = Dimensions.get('window');

export const CameraComponent: React.FC<CameraComponentProps> = ({
  onCapture,
  onError,
  onClose,
  mode = 'both',
  options = {},
  allowMultiple = false,
  maxImages = 1,
  showControls = true,
  flashMode = 'auto',
  cameraType = 'back',
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [activeMode, setActiveMode] = useState<'camera' | 'gallery'>('camera');
  const [selectedImages, setSelectedImages] = useState<CameraResult[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [flashEnabled, setFlashEnabled] = useState(flashMode === 'on');
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>(cameraType);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(height));
  
  const camera = useRef<Camera>(null);
  const devices = useCameraDevices();
  const device = devices.find(d => d.position === cameraPosition);

  useEffect(() => {
    if (isModalVisible) {
      animateModalIn();
    }
  }, [isModalVisible]);

  const animateModalIn = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateModalOut = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      callback?.();
    });
  };

  const requestCameraPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true; // iOS permissions are handled by the system
  };

  const openCamera = async () => {
    try {
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) {
        onError('Camera permission is required');
        return;
      }

      setActiveMode('camera');
      setIsModalVisible(true);
    } catch (error) {
      onError('Failed to open camera');
    }
  };

  const openGallery = async () => {
    try {
      setActiveMode('gallery');
      setIsModalVisible(true);
      setTimeout(() => selectFromGallery(), 500);
    } catch (error) {
      onError('Failed to open gallery');
    }
  };

  const selectFromGallery = () => {
    const options = {
      mediaType: 'photo' as const,
      quality: options.quality || 0.8,
      includeExtra: options.includeExtra || true,
      selectionLimit: allowMultiple ? maxImages : 1,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        return;
      }

      if (response.errorCode) {
        onError('Image selection failed');
        return;
      }

      if (response.assets) {
        const images: CameraResult[] = response.assets.map(asset => ({
          uri: asset.uri!,
          width: asset.width || 0,
          height: asset.height || 0,
          fileSize: asset.fileSize || 0,
          type: asset.type || 'image/jpeg',
          fileName: asset.fileName,
          metadata: {
            timestamp: Date.now(),
            device: Platform.OS,
          },
        }));

        if (allowMultiple) {
          setSelectedImages(images);
        } else {
          handleCapture(images[0]);
        }
      }
    });
  };

  const capturePhoto = async () => {
    if (!camera.current || !device) return;

    try {
      setIsCapturing(true);
      
      const photo = await camera.current.takePhoto({
        quality: options.quality || 0.8,
        flash: flashEnabled ? 'on' : 'off',
        enableShutterSound: true,
      });

      const result: CameraResult = {
        uri: `file://${photo.path}`,
        width: photo.width,
        height: photo.height,
        fileSize: photo.size || 0,
        type: 'image/jpeg',
        metadata: {
          timestamp: Date.now(),
          device: Platform.OS,
        },
      };

      if (allowMultiple) {
        setSelectedImages(prev => [...prev, result]);
      } else {
        handleCapture(result);
      }
    } catch (error) {
      onError('Failed to capture photo');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleCapture = (result: CameraResult) => {
    animateModalOut(() => {
      setIsModalVisible(false);
      onCapture(result);
      resetState();
    });
  };

  const handleMultipleCapture = () => {
    if (selectedImages.length > 0) {
      animateModalOut(() => {
        setIsModalVisible(false);
        onCapture(selectedImages[0]); // Return first image, could be modified to return array
        resetState();
      });
    }
  };

  const resetState = () => {
    setSelectedImages([]);
    setActiveMode('camera');
  };

  const toggleFlash = () => {
    setFlashEnabled(!flashEnabled);
  };

  const switchCamera = () => {
    setCameraPosition(prev => prev === 'back' ? 'front' : 'back');
  };

  const removeSelectedImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const renderCameraControls = () => {
    if (!showControls) return null;

    return (
      <View style={styles.cameraControls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={toggleFlash}
        >
          <Icon
            name={flashEnabled ? 'flash-on' : 'flash-off'}
            size={24}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.captureButton}
          onPress={capturePhoto}
          disabled={isCapturing}
        >
          <View style={[styles.captureInner, isCapturing && styles.captureDisabled]} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={switchCamera}
        >
          <Icon name="flip-camera-ios" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderGalleryControls = () => {
    return (
      <View style={styles.galleryControls}>
        <TouchableOpacity
          style={styles.galleryButton}
          onPress={() => selectFromGallery()}
        >
          <Icon name="photo-library" size={32} color="#6C5CE7" />
          <Text style={styles.galleryButtonText}>Select Photos</Text>
        </TouchableOpacity>

        {allowMultiple && (
          <View style={styles.selectedImages}>
            <Text style={styles.selectedCount}>
              {selectedImages.length}/{maxImages} selected
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderSelectedImages = () => {
    if (selectedImages.length === 0) return null;

    return (
      <View style={styles.selectedImagesContainer}>
        <Text style={styles.selectedImagesTitle}>Selected Images</Text>
        <View style={styles.selectedImagesGrid}>
          {selectedImages.map((image, index) => (
            <View key={index} style={styles.selectedImageItem}>
              <Image
                source={{ uri: image.uri }}
                style={styles.selectedImage}
              />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeSelectedImage(index)}
              >
                <Icon name="close" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {allowMultiple && (
          <TouchableOpacity
            style={[
             styles.doneButton,
              selectedImages.length === 0 && styles.doneButtonDisabled,
            ]}
            onPress={handleMultipleCapture}
            disabled={selectedImages.length === 0}
          >
            <Text style={styles.doneButtonText}>
              Done ({selectedImages.length})
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderCamera = () => {
    if (!device) {
      return (
        <View style={styles.noCameraContainer}>
          <Icon name="camera-alt" size={64} color="#7F8C8D" />
          <Text style={styles.noCameraText}>Camera not available</Text>
        </View>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <Camera
          ref={camera}
          style={styles.camera}
          device={device}
          isActive={true}
          photo={true}
          enableZoomGesture={true}
        />
        {renderCameraControls()}
      </View>
    );
  };

  const renderModeSelector = () => {
    if (mode === 'both') {
      return (
        <View style={styles.modeSelector}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              activeMode === 'camera' && styles.modeButtonActive,
            ]}
            onPress={() => setActiveMode('camera')}
          >
            <Icon name="camera-alt" size={24} color={activeMode === 'camera' ? '#FFFFFF' : '#7F8C8D'} />
            <Text style={[styles.modeButtonText, activeMode === 'camera' && styles.modeButtonTextActive]}>
              Camera
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeButton,
              activeMode === 'gallery' && styles.modeButtonActive,
            ]}
            onPress={() => setActiveMode('gallery')}
          >
            <Icon name="photo-library" size={24} color={activeMode === 'gallery' ? '#FFFFFF' : '#7F8C8D'} />
            <Text style={[styles.modeButtonText, activeMode === 'gallery' && styles.modeButtonTextActive]}>
              Gallery
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      {mode === 'both' && (
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={openCamera}>
            <Icon name="camera-alt" size={24} color="#6C5CE7" />
            <Text style={styles.actionButtonText}>Camera</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={openGallery}>
            <Icon name="photo-library" size={24} color="#6C5CE7" />
            <Text style={styles.actionButtonText}>Gallery</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === 'camera' && (
        <TouchableOpacity style={styles.actionButton} onPress={openCamera}>
          <Icon name="camera-alt" size={24} color="#6C5CE7" />
          <Text style={styles.actionButtonText}>Open Camera</Text>
        </TouchableOpacity>
      )}

      {mode === 'gallery' && (
        <TouchableOpacity style={styles.actionButton} onPress={openGallery}>
          <Icon name="photo-library" size={24} color="#6C5CE7" />
          <Text style={styles.actionButtonText}>Open Gallery</Text>
        </TouchableOpacity>
      )}

      {/* Camera Modal */}
      <Modal
        visible={isModalVisible}
        transparent={false}
        animationType="none"
        onRequestClose={() => animateModalOut(() => {
          setIsModalVisible(false);
          resetState();
        })}
      >
        <Animated.View style={[styles.modalContainer, { opacity: fadeAnim }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => animateModalOut(() => {
              setIsModalVisible(false);
              resetState();
            })}>
              <Icon name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {activeMode === 'camera' ? 'Take Photo' : 'Select Photo'}
            </Text>
            <View style={styles.placeholder} />
          </View>

          {renderModeSelector()}

          <View style={styles.modalContent}>
            {activeMode === 'camera' ? renderCamera() : renderGalleryControls()}
            {renderSelectedImages()}
          </View>
        </Animated.View>
      </Modal>
    </View>
  );
};

// Quick Camera Component for simple use cases
interface QuickCameraProps {
  onCapture: (result: CameraResult) => void;
  onError: (error: string) => void;
  style?: any;
}

export const QuickCamera: React.FC<QuickCameraProps> = ({ onCapture, onError, style }) => {
  return (
    <CameraComponent
      onCapture={onCapture}
      onError={onError}
      onClose={() => {}}
      mode="camera"
      showControls={true}
      style={style}
    />
  );
};

// Quick Gallery Component for simple use cases
interface QuickGalleryProps {
  onSelect: (result: CameraResult) => void;
  onError: (error: string) => void;
  style?: any;
}

export const QuickGallery: React.FC<QuickGalleryProps> = ({ onSelect, onError, style }) => {
  return (
    <CameraComponent
      onCapture={onSelect}
      onError={onError}
      onClose={() => {}}
      mode="gallery"
      showControls={false}
      style={style}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
  },
  actionButton: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    minWidth: 100,
  },
  actionButtonText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#2C3E50',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 24,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    marginHorizontal: 20,
    borderRadius: 25,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 21,
    gap: 8,
  },
  modeButtonActive: {
    backgroundColor: '#6C5CE7',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#7F8C8D',
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  modalContent: {
    flex: 1,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF6B6B',
  },
  captureDisabled: {
    backgroundColor: '#BDC3C7',
  },
  noCameraContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noCameraText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7F8C8D',
  },
  galleryControls: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  galleryButton: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  galleryButtonText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
    color: '#2C3E50',
  },
  selectedImages: {
    marginTop: 20,
  },
  selectedCount: {
    fontSize: 14,
    color: '#7F8C8D',
  },
  selectedImagesContainer: {
    padding: 20,
  },
  selectedImagesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  selectedImagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  selectedImageItem: {
    position: 'relative',
  },
  selectedImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButton: {
    backgroundColor: '#6C5CE7',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 25,
    alignItems: 'center',
    marginTop: 20,
  },
  doneButtonDisabled: {
    backgroundColor: '#BDC3C7',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
