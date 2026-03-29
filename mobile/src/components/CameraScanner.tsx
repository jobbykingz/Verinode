import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Image,
  ActivityIndicator,
} from 'react-native';
import { RNCamera } from 'react-native-camera';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { CameraService } from '../services/CameraService';
import { ProofService } from '../services/ProofService';

interface CameraScannerProps {
  navigation: any;
}

const CameraScanner: React.FC<CameraScannerProps> = ({ navigation }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const cameraRef = useRef<RNCamera>(null);

  const handleCapture = async () => {
    if (cameraRef.current) {
      try {
        const options = { quality: 0.5, base64: true };
        const data = await cameraRef.current.takePictureAsync(options);
        setCapturedImage(data.uri);
        setShowModal(true);
      } catch (error) {
        Alert.alert('Error', 'Failed to capture image');
      }
    }
  };

  const handleCreateProof = async (title: string, description: string) => {
    if (!capturedImage) return;

    try {
      setProcessing(true);
      
      const processedImage = await CameraService.processDocument(capturedImage);
      const proof = await ProofService.createProof({
        title,
        description,
        image: processedImage,
        metadata: {
          source: 'mobile_camera',
          timestamp: new Date().toISOString(),
          deviceInfo: await CameraService.getDeviceInfo(),
        },
      });

      Alert.alert('Success', 'Proof created successfully');
      setShowModal(false);
      setCapturedImage(null);
      navigation.navigate('ProofViewer', { proofId: proof.id });
    } catch (error) {
      Alert.alert('Error', 'Failed to create proof');
    } finally {
      setProcessing(false);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setShowModal(false);
  };

  const handleGalleryPick = async () => {
    try {
      const image = await CameraService.pickFromGallery();
      if (image) {
        setCapturedImage(image);
        setShowModal(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image from gallery');
    }
  };

  const showProofDetailsDialog = () => {
    Alert.prompt(
      'Create Proof',
      'Enter proof details',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setShowModal(false) },
        {
          text: 'OK',
          onPress: (title) => {
            Alert.prompt(
              'Description',
              'Enter proof description',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Create',
                  onPress: (description) => {
                    handleCreateProof(title || 'Untitled Proof', description || '');
                  },
                },
              ],
              'plain-text',
              ''
            );
          },
        },
      ],
      'plain-text',
      ''
    );
  };

  return (
    <View style={styles.container}>
      <RNCamera
        ref={cameraRef}
        style={styles.camera}
        type={RNCamera.Constants.Type.back}
        flashMode={RNCamera.Constants.FlashMode.auto}
        androidCameraPermissionOptions={{
          title: 'Permission to use camera',
          message: 'We need your permission to use your camera',
          buttonPositive: 'Ok',
          buttonNegative: 'Cancel',
        }}
        androidRecordAudioPermissionOptions={{
          title: 'Permission to use audio recording',
          message: 'We need your permission to use your audio',
          buttonPositive: 'Ok',
          buttonNegative: 'Cancel',
        }}
        onTextRecognized={(result) => {
          if (result.textBlocks && result.textBlocks.length > 0) {
            console.log('Detected text:', result.textBlocks);
          }
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.topOverlay}>
            <Text style={styles.title}>Scan Document</Text>
            <Text style={styles.subtitle}>
              Position the document within the frame
            </Text>
          </View>

          <View style={styles.middleOverlay}>
            <View style={styles.frame} />
          </View>

          <View style={styles.bottomOverlay}>
            <TouchableOpacity
              style={styles.galleryButton}
              onPress={handleGalleryPick}
            >
              <Icon name="photo-library" size={32} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.captureButton}
              onPress={handleCapture}
              disabled={isScanning}
            >
              <View style={styles.captureInner} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.flashButton}
              onPress={() => {
                if (cameraRef.current) {
                  cameraRef.current.flashMode =
                    cameraRef.current.flashMode === RNCamera.Constants.FlashMode.on
                      ? RNCamera.Constants.FlashMode.off
                      : RNCamera.Constants.FlashMode.on;
                }
              }}
            >
              <Icon name="flash-on" size={32} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </RNCamera>

      <Modal
        visible={showModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {capturedImage && (
              <Image source={{ uri: capturedImage }} style={styles.previewImage} />
            )}
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.button, styles.retakeButton]}
                onPress={handleRetake}
              >
                <Icon name="refresh" size={20} color="#fff" />
                <Text style={styles.buttonText}>Retake</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.useButton]}
                onPress={showProofDetailsDialog}
                disabled={processing}
              >
                {processing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Icon name="check" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Use Photo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  topOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.8,
  },
  middleOverlay: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frame: {
    width: 280,
    height: 400,
    borderWidth: 2,
    borderColor: '#6366f1',
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  bottomOverlay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 40,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  captureInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#6366f1',
  },
  galleryButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flashButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    width: '90%',
    maxWidth: 400,
  },
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 8,
  },
  retakeButton: {
    backgroundColor: '#ef4444',
  },
  useButton: {
    backgroundColor: '#10b981',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default CameraScanner;
