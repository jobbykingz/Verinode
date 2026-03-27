import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Animated,
  Dimensions,
  Alert,
  Share,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Video from 'react-native-video';
import PDFView from 'react-native-pdf-view';
import {
  UploadFile,
  PreviewConfig,
  FileMetadata,
  FileDimensions,
  DEFAULT_PREVIEW_CONFIG,
} from '../../types/fileUpload';

interface FilePreviewProps {
  file: UploadFile;
  config?: Partial<PreviewConfig>;
  onClose?: () => void;
  onShare?: (file: UploadFile) => void;
  onDownload?: (file: UploadFile) => void;
  onDelete?: (file: UploadFile) => void;
  style?: any;
}

const { width, height } = Dimensions.get('window');

export const FilePreview: React.FC<FilePreviewProps> = ({
  file,
  config = {},
  onClose,
  onShare,
  onDownload,
  onDelete,
  style,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [showMetadata, setShowMetadata] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoPosition, setVideoPosition] = useState(0);
  
  const scrollViewRef = useRef<ScrollView>(null);
  const videoRef = useRef<Video>(null);
  const pdfRef = useRef<any>(null);
  
  const panResponder = useRef(
    Animated.event(
      [{ nativeEvent: { translationX: 0, translationY: 0 } }],
      { useNativeDriver: false }
    )
  ).current;

  const previewConfig = { ...DEFAULT_PREVIEW_CONFIG, ...config };

  useEffect(() => {
    // Extract metadata when component mounts
    if (previewConfig.showMetadata && file.metadata) {
      // Metadata is already available in file.metadata
    }
  }, [file, previewConfig]);

  const getFileIcon = (): string => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'videocam';
    if (file.type.startsWith('audio/')) return 'music-note';
    if (file.type.includes('pdf')) return 'picture-as-pdf';
    if (file.type.includes('word') || file.type.includes('document')) return 'description';
    if (file.type.includes('excel') || file.type.includes('spreadsheet')) return 'grid-on';
    if (file.type.includes('powerpoint') || file.type.includes('presentation')) return 'slideshow';
    if (file.type.includes('zip') || file.type.includes('rar')) return 'folder-zip';
    if (file.type.includes('text')) return 'text-fields';
    return 'insert-drive-file';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const handleShare = async () => {
    try {
      if (onShare) {
        onShare(file);
      } else {
        // Default share functionality
        await Share.share({
          url: file.uri || '',
          title: file.name,
          message: `Check out this file: ${file.name}`,
        });
      }
    } catch (error) {
      console.error('Share failed:', error);
      Alert.alert('Error', 'Failed to share file');
    }
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload(file);
    } else {
      // Default download functionality
      if (file.uri) {
        Linking.openURL(file.uri);
      } else {
        Alert.alert('Error', 'No download URL available');
      }
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete File',
      `Are you sure you want to delete "${file.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (onDelete) {
              onDelete(file);
            } else {
              onClose?.();
            }
          },
        },
      ]
    );
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleZoom = (inOrOut: 'in' | 'out') => {
    setScale((prev) => {
      const newScale = inOrOut === 'in' ? prev * 1.2 : prev / 1.2;
      return Math.max(0.5, Math.min(5, newScale));
    });
  };

  const handleReset = () => {
    setRotation(0);
    setScale(1);
    scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: true });
  };

  const renderImagePreview = () => {
    const imageStyle = {
      transform: [
        { rotate: `${rotation}deg` },
        { scale },
      ],
      width: previewConfig.maxWidth,
      height: previewConfig.maxHeight,
      resizeMode: 'contain' as const,
    };

    return (
      <View style={styles.previewContainer}>
        <Animated.Image
          source={{ uri: file.uri || file.preview }}
          style={[styles.previewImage, imageStyle]}
        />
        
        {previewConfig.enableRotation && (
          <View style={styles.imageControls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => handleZoom('out')}
            >
              <Icon name="zoom-out" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleRotate}
            >
              <Icon name="rotate-right" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => handleZoom('in')}
            >
              <Icon name="zoom-in" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.controlButton}
              onPress={handleReset}
            >
              <Icon name="refresh" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderVideoPreview = () => {
    return (
      <View style={styles.previewContainer}>
        <Video
          ref={videoRef}
          source={{ uri: file.uri }}
          style={styles.previewVideo}
          controls={true}
          resizeMode="contain"
          onLoad={(load) => {
            setVideoDuration(load.duration);
          }}
          onProgress={(progress) => {
            setVideoPosition(progress.currentTime);
          }}
          onPlayPress={() => setIsVideoPlaying(true)}
          onPausePress={() => setIsVideoPlaying(false)}
        />
        
        <View style={styles.videoInfo}>
          <Text style={styles.videoTime}>
            {formatTime(videoPosition)} / {formatTime(videoDuration)}
          </Text>
        </View>
      </View>
    );
  };

  const renderPDFPreview = () => {
    return (
      <View style={styles.previewContainer}>
        <PDFView
          ref={pdfRef}
          source={{ uri: file.uri }}
          style={styles.previewPDF}
          onLoad={(numberOfPages) => {
            setTotalPages(numberOfPages);
          }}
          onPageChanged={(page) => {
            setCurrentPage(page);
          }}
        />
        
        {totalPages > 1 && (
          <View style={styles.pdfControls}>
            <TouchableOpacity
              style={styles.pdfControlButton}
              onPress={() => {
                if (currentPage > 0) {
                  pdfRef.current?.setPage(currentPage - 1);
                }
              }}
              disabled={currentPage === 0}
            >
              <Icon name="chevron-left" size={20} color="#6C5CE7" />
            </TouchableOpacity>
            
            <Text style={styles.pdfPageText}>
              {currentPage + 1} / {totalPages}
            </Text>
            
            <TouchableOpacity
              style={styles.pdfControlButton}
              onPress={() => {
                if (currentPage < totalPages - 1) {
                  pdfRef.current?.setPage(currentPage + 1);
                }
              }}
              disabled={currentPage === totalPages - 1}
            >
              <Icon name="chevron-right" size={20} color="#6C5CE7" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderAudioPreview = () => {
    return (
      <View style={styles.previewContainer}>
        <View style={styles.audioPreview}>
          <Icon name="music-note" size={64} color="#6C5CE7" />
          <Text style={styles.audioName}>{file.name}</Text>
          <Text style={styles.audioType}>{file.type}</Text>
          <Text style={styles.audioSize}>{formatFileSize(file.size)}</Text>
        </View>
      </View>
    );
  };

  const renderTextPreview = () => {
    return (
      <View style={styles.previewContainer}>
        <View style={styles.textPreview}>
          <Icon name="text-fields" size={64} color="#6C5CE7" />
          <Text style={styles.textName}>{file.name}</Text>
          <Text style={styles.textType}>{file.type}</Text>
          <Text style={styles.textSize}>{formatFileSize(file.size)}</Text>
        </View>
      </View>
    );
  };

  const renderDefaultPreview = () => {
    return (
      <View style={styles.previewContainer}>
        <View style={styles.defaultPreview}>
          <Icon name={getFileIcon()} size={64} color="#7F8C8D" />
          <Text style={styles.defaultName}>{file.name}</Text>
          <Text style={styles.defaultType}>{file.type}</Text>
          <Text style={styles.defaultSize}>{formatFileSize(file.size)}</Text>
        </View>
      </View>
    );
  };

  const renderPreview = () => {
    if (file.type.startsWith('image/')) {
      return renderImagePreview();
    } else if (file.type.startsWith('video/')) {
      return renderVideoPreview();
    } else if (file.type.includes('pdf')) {
      return renderPDFPreview();
    } else if (file.type.startsWith('audio/')) {
      return renderAudioPreview();
    } else if (file.type.startsWith('text/')) {
      return renderTextPreview();
    } else {
      return renderDefaultPreview();
    }
  };

  const renderMetadata = () => {
    if (!previewConfig.showMetadata || !file.metadata) {
      return null;
    }

    const metadata = file.metadata;

    return (
      <View style={styles.metadataContainer}>
        <Text style={styles.metadataTitle}>File Information</Text>
        
        <View style={styles.metadataRow}>
          <Text style={styles.metadataLabel}>Name:</Text>
          <Text style={styles.metadataValue}>{file.name}</Text>
        </View>
        
        <View style={styles.metadataRow}>
          <Text style={styles.metadataLabel}>Size:</Text>
          <Text style={styles.metadataValue}>{formatFileSize(file.size)}</Text>
        </View>
        
        <View style={styles.metadataRow}>
          <Text style={styles.metadataLabel}>Type:</Text>
          <Text style={styles.metadataValue}>{file.type}</Text>
        </View>
        
        <View style={styles.metadataRow}>
          <Text style={styles.metadataLabel}>Modified:</Text>
          <Text style={styles.metadataValue}>
            {formatDate(file.lastModified)}
          </Text>
        </View>
        
        {metadata.dimensions && (
          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Dimensions:</Text>
            <Text style={styles.metadataValue}>
              {metadata.dimensions.width} × {metadata.dimensions.height}
            </Text>
          </View>
        )}
        
        {metadata.duration && (
          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Duration:</Text>
            <Text style={styles.metadataValue}>
              {formatTime(metadata.duration * 1000)}
            </Text>
          </View>
        )}
        
        {metadata.bitrate && (
          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Bitrate:</Text>
            <Text style={styles.metadataValue}>
              {metadata.bitrate} kbps
            </Text>
          </View>
        )}
        
        {metadata.checksum && (
          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Checksum:</Text>
            <Text style={styles.metadataValue} numberOfLines={1}>
              {metadata.checksum}
            </Text>
          </View>
        )}
        
        {metadata.location && (
          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Location:</Text>
            <Text style={styles.metadataValue}>
              {metadata.location.latitude.toFixed(6)}, {metadata.location.longitude.toFixed(6)}
            </Text>
          </View>
        )}
        
        {metadata.camera && (
          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Camera:</Text>
            <Text style={styles.metadataValue}>
              {metadata.camera.make} {metadata.camera.model}
            </Text>
          </View>
        )}
        
        {metadata.deviceInfo && (
          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Device:</Text>
            <Text style={styles.metadataValue}>
              {metadata.deviceInfo.platform} {metadata.deviceInfo.version}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const formatTime = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
  };

  return (
    <Modal
      visible={true}
      animationType="slide"
      presentationStyle="page"
      onRequestClose={onClose}
    >
      <View style={[styles.container, style]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Icon name="close" size={24} color="#34495E" />
          </TouchableOpacity>
          
          <View style={styles.headerCenter}>
            <Text style={styles.fileName} numberOfLines={1}>
              {file.name}
            </Text>
            <Text style={styles.fileSize}>{formatFileSize(file.size)}</Text>
          </View>
          
          <View style={styles.headerActions}>
            {previewConfig.enableFullscreen && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setIsFullscreen(!isFullscreen)}
              >
                <Icon
                  name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'}
                  size={20}
                  color="#7F8C8D"
                />
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Icon name="share" size={20} color="#7F8C8D" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton} onPress={handleDownload}>
              <Icon name="download" size={20} color="#7F8C8D" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton} onPress={handleDelete}>
              <Icon name="delete" size={20} color="#FF6B6B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Preview */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.previewScrollView}
          showsVerticalScrollIndicator={false}
          maximumZoomScale={5}
          minimumZoomScale={0.5}
        >
          {renderPreview()}
          {renderMetadata()}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.footerButton}
            onPress={() => setShowMetadata(!showMetadata)}
          >
            <Icon
              name={showMetadata ? 'visibility-off' : 'visibility'}
              size={20}
              color="#6C5CE7"
            />
            <Text style={styles.footerButtonText}>
              {showMetadata ? 'Hide' : 'Show'} Details
            </Text>
          </TouchableOpacity>
          
          {file.status.state === 'completed' && (
            <TouchableOpacity style={styles.footerButton} onPress={handleShare}>
              <Icon name="share" size={20} color="#6C5CE7" />
              <Text style={styles.footerButtonText}>Share</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    textAlign: 'center',
  },
  fileSize: {
    fontSize: 12,
    color: '#7F8C8D',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewScrollView: {
    flex: 1,
    backgroundColor: '#000000',
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: height - 200,
  },
  previewImage: {
    maxWidth: width,
    maxHeight: height - 200,
  },
  imageControls: {
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 25,
    padding: 8,
    gap: 8,
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewVideo: {
    width: width,
    height: height - 200,
  },
  videoInfo: {
    position: 'absolute',
    bottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  videoTime: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  previewPDF: {
    flex: 1,
    width: width,
  },
  pdfControls: {
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 25,
    padding: 8,
    gap: 16,
  },
  pdfControlButton: {
    padding: 4,
  },
  pdfPageText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2C3E50',
  },
  audioPreview: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 4,
  },
  audioType: {
    fontSize: 14,
    color: '#BDC3C7',
    marginBottom: 4,
  },
  audioSize: {
    fontSize: 12,
    color: '#95A5A6',
  },
  textPreview: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 4,
  },
  textType: {
    fontSize: 14,
    color: '#BDC3C7',
    marginBottom: 4,
  },
  textSize: {
    fontSize: 12,
    color: '#95A5A6',
  },
  defaultPreview: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 4,
  },
  defaultType: {
    fontSize: 14,
    color: '#BDC3C7',
    marginBottom: 4,
  },
  defaultSize: {
    fontSize: 12,
    color: '#95A5A6',
  },
  metadataContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    margin: 16,
    borderRadius: 8,
  },
  metadataTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 16,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metadataLabel: {
    fontSize: 14,
    color: '#7F8C8D',
    fontWeight: '500',
  },
  metadataValue: {
    fontSize: 14,
    color: '#2C3E50',
    flex: 1,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  footerButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6C5CE7',
  },
});
