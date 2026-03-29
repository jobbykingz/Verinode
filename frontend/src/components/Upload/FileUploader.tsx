import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Animated,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DocumentPicker from 'react-native-document-picker';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  UploadFile,
  UploadConfig,
  DragDropConfig,
  PreviewConfig,
  UploadOptions,
  UseFileUploadReturn,
  DEFAULT_UPLOAD_CONFIG,
  DEFAULT_DRAG_DROP_CONFIG,
  DEFAULT_PREVIEW_CONFIG,
} from '../../types/fileUpload';
import { useFileUpload } from '../../hooks/useFileUpload';
import UploadProgress from './UploadProgress';
import UploadQueue from './UploadQueue';
import FilePreview from './FilePreview';
import { validateFiles, generateThumbnails, extractMetadata } from '../../utils/fileUtils';

interface FileUploaderProps {
  config?: Partial<UploadConfig>;
  dragDropConfig?: Partial<DragDropConfig>;
  previewConfig?: Partial<PreviewConfig>;
  onFilesSelected?: (files: File[]) => void;
  onUploadStart?: (files: UploadFile[]) => void;
  onUploadProgress?: (file: UploadFile) => void;
  onUploadComplete?: (file: UploadFile) => void;
  onUploadError?: (file: UploadFile, error: any) => void;
  onQueueComplete?: (files: UploadFile[]) => void;
  style?: any;
  disabled?: boolean;
  className?: string;
}

const { width, height } = Dimensions.get('window');

export const FileUploader: React.FC<FileUploaderProps> = ({
  config = {},
  dragDropConfig = {},
  previewConfig = {},
  onFilesSelected,
  onUploadStart,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
  onQueueComplete,
  style,
  disabled = false,
  className,
}) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isDragReject, setIsDragReject] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedFile, setSelectedFile] = useState<UploadFile | null>(null);
  const [showQueue, setShowQueue] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fileInputRef = useRef<any>(null);
  
  const uploadConfig = { ...DEFAULT_UPLOAD_CONFIG, ...config };
  const dragConfig = { ...DEFAULT_DRAG_DROP_CONFIG, ...dragDropConfig };
  const previewConfigFinal = { ...DEFAULT_PREVIEW_CONFIG, ...previewConfig };
  
  const {
    files,
    progress,
    isUploading,
    isPaused,
    error,
    upload,
    pause,
    resume,
    cancel,
    retry,
    remove,
    clear,
    retryAll,
    pauseAll,
    resumeAll,
    cancelAll,
    getStats,
  }: UseFileUploadReturn = useFileUpload(uploadConfig);

  // Animation effects
  useEffect(() => {
    if (isDragActive) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.02,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isDragActive]);

  // Handle file selection
  const handleFileSelection = useCallback(async (selectedFiles: File[]) => {
    try {
      // Validate files
      const validationResults = await validateFiles(selectedFiles, {
        maxSize: uploadConfig.maxFileSize,
        allowedTypes: uploadConfig.allowedTypes,
        blockedTypes: uploadConfig.blockedTypes,
        maxFiles: uploadConfig.maxFiles,
        enableVirusScanning: uploadConfig.enableVirusScanning,
        enableContentValidation: uploadConfig.enableValidation,
      });

      const validFiles = validationResults.filter(result => result.isValid);
      const invalidFiles = validationResults.filter(result => !result.isValid);

      // Show errors for invalid files
      if (invalidFiles.length > 0) {
        const errorMessages = invalidFiles.map(result => 
          result.errors.map(error => error.message).join(', ')
        ).join('\n');
        
        Alert.alert('File Validation Error', errorMessages);
      }

      if (validFiles.length === 0) {
        return;
      }

      // Process valid files
      const processedFiles = await Promise.all(
        validFiles.map(async (result) => {
          const file = result.file;
          
          // Generate thumbnails if enabled
          let thumbnail = undefined;
          if (previewConfigFinal.generateThumbnails && file.type.startsWith('image/')) {
            thumbnail = await generateThumbnails(file, previewConfigFinal);
          }

          // Extract metadata if enabled
          let metadata = undefined;
          if (uploadConfig.enableMetadataExtraction) {
            metadata = await extractMetadata(file);
          }

          return {
            file,
            thumbnail,
            metadata,
          };
        })
      );

      onFilesSelected?.(processedFiles.map(p => p.file));
      
      // Start upload if auto-start is enabled
      if (uploadConfig.autoStart) {
        const uploadOptions: UploadOptions = {
          files: processedFiles.map(p => p.file),
          config: uploadConfig,
          onStart: onUploadStart,
          onProgress: onUploadProgress,
          onComplete: onUploadComplete,
          onError: onUploadError,
          onQueueComplete: (queue) => onQueueComplete?.(queue.files),
        };
        await upload(uploadOptions);
      }
    } catch (error) {
      console.error('Error processing files:', error);
      Alert.alert('Error', 'Failed to process files');
    }
  }, [uploadConfig, previewConfigFinal, onFilesSelected, onUploadStart, onUploadProgress, onUploadComplete, onUploadError, onQueueComplete]);

  // Document picker
  const handleDocumentPicker = useCallback(async () => {
    try {
      const result = await DocumentPicker.pickMultiple({
        type: dragConfig.accept === '*/*' ? [DocumentPicker.types.allFiles] : [dragConfig.accept],
        allowMultiSelection: dragConfig.multiple,
        quality: 1,
      });
      
      const files = result.map(file => ({
        uri: file.uri,
        name: file.name,
        type: file.type,
        size: file.size || 0,
        lastModified: Date.now(),
      }));
      
      await handleFileSelection(files);
    } catch (error) {
      if (DocumentPicker.isCancel(error)) {
        // User cancelled
      } else {
        console.error('Document picker error:', error);
        Alert.alert('Error', 'Failed to select files');
      }
    }
  }, [dragConfig, handleFileSelection]);

  // Image picker
  const handleImagePicker = useCallback(async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'mixed',
        selectionLimit: dragConfig.multiple ? 0 : 1,
        quality: 1,
        includeExtra: true,
      });
      
      if (result.assets) {
        const files = result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.fileName || `image_${Date.now()}`,
          type: asset.type || 'image/jpeg',
          size: asset.fileSize || 0,
          lastModified: asset.timestamp || Date.now(),
        }));
        
        await handleFileSelection(files);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to select images');
    }
  }, [dragConfig, handleFileSelection]);

  // Drag and drop handlers
  const handleDragEnter = useCallback(() => {
    if (!disabled && dragConfig.enabled) {
      setIsDragActive(true);
    }
  }, [disabled, dragConfig]);

  const handleDragLeave = useCallback(() => {
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback(() => {
    if (!disabled && dragConfig.enabled) {
      setIsDragActive(true);
    }
  }, [disabled, dragConfig]);

  const handleDrop = useCallback((e: any) => {
    e.preventDefault();
    setIsDragActive(false);
    
    if (disabled || !dragConfig.enabled) {
      return;
    }

    const droppedFiles = Array.from(e.dataTransfer?.files || []);
    
    if (droppedFiles.length > 0) {
      handleFileSelection(droppedFiles);
    }
  }, [disabled, dragConfig, handleFileSelection]);

  // File management
  const handleRemoveFile = useCallback((fileId: string) => {
    remove(fileId);
  }, [remove]);

  const handleRetryFile = useCallback((fileId: string) => {
    retry(fileId);
  }, [retry]);

  const handlePauseFile = useCallback((fileId: string) => {
    pause();
  }, [pause]);

  const handleResumeFile = useCallback((fileId: string) => {
    resume();
  }, [resume]);

  const handleCancelFile = useCallback((fileId: string) => {
    cancel();
  }, [cancel]);

  const handlePreviewFile = useCallback((file: UploadFile) => {
    setSelectedFile(file);
    setShowPreview(true);
  }, []);

  // Queue management
  const handleStartUpload = useCallback(async () => {
    const uploadOptions: UploadOptions = {
      files: files.map(f => f.file),
      config: uploadConfig,
      onStart: onUploadStart,
      onProgress: onUploadProgress,
      onComplete: onUploadComplete,
      onError: onUploadError,
      onQueueComplete: (queue) => onQueueComplete?.(queue.files),
    };
    await upload(uploadOptions);
  }, [files, uploadConfig, onUploadStart, onUploadProgress, onUploadComplete, onUploadError, onQueueComplete]);

  // Render methods
  const renderDragDropArea = () => {
    const containerStyle = [
      styles.dragDropContainer,
      isDragActive && styles.dragDropActive,
      isDragReject && styles.dragDropReject,
      disabled && styles.dragDropDisabled,
      style,
    ];

    const animatedStyle = {
      transform: [{ scale: scaleAnim }],
      opacity: 1 - fadeAnim.value * 0.3,
    };

    return (
      <Animated.View style={[containerStyle, animatedStyle]}>
        {isDragActive && (
          <View style={styles.dragOverlay}>
            <Icon name="cloud-upload" size={48} color="#6C5CE7" />
            <Text style={styles.dragText}>Drop files here</Text>
          </View>
        )}
        
        <View style={styles.uploadArea}>
          <Icon name="cloud-upload" size={64} color="#6C5CE7" />
          <Text style={styles.uploadTitle}>
            {dragConfig.multiple ? 'Drag & drop files here' : 'Drag & drop file here'}
          </Text>
          <Text style={styles.uploadSubtitle}>
            or click to browse
          </Text>
        </View>
        
        <TouchableOpacity
          style={styles.browseButton}
          onPress={() => setShowFilePicker(true)}
          disabled={disabled}
        >
          <Icon name="folder-open" size={20} color="#FFFFFF" />
          <Text style={styles.browseButtonText}>Browse Files</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderFileList = () => {
    if (files.length === 0) {
      return null;
    }

    return (
      <View style={styles.fileList}>
        <View style={styles.fileListHeader}>
          <Text style={styles.fileListTitle}>
            {files.length} file{files.length !== 1 ? 's' : ''}
          </Text>
          <View style={styles.fileListActions}>
            {!isUploading && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleStartUpload}
              >
                <Icon name="play-arrow" size={16} color="#6C5CE7" />
                <Text style={styles.actionButtonText}>Start</Text>
              </TouchableOpacity>
            )}
            
            {isUploading && !isPaused && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={pauseAll}
              >
                <Icon name="pause" size={16} color="#FFA500" />
                <Text style={styles.actionButtonText}>Pause</Text>
              </TouchableOpacity>
            )}
            
            {isUploading && isPaused && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={resumeAll}
              >
                <Icon name="play-arrow" size={16} color="#6BCF7F" />
                <Text style={styles.actionButtonText}>Resume</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowQueue(true)}
            >
              <Icon name="list" size={16} color="#7F8C8D" />
              <Text style={styles.actionButtonText}>Queue</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={clear}
            >
              <Icon name="clear" size={16} color="#FF6B6B" />
              <Text style={styles.actionButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <ScrollView style={styles.fileItems}>
          {files.map((file) => (
            <View key={file.id} style={styles.fileItem}>
              <TouchableOpacity
                style={styles.filePreview}
                onPress={() => handlePreviewFile(file)}
              >
                {file.thumbnail ? (
                  <Image source={{ uri: file.thumbnail }} style={styles.fileThumbnail} />
                ) : (
                  <View style={styles.fileIcon}>
                    <Icon
                      name={getFileIcon(file.type)}
                      size={32}
                      color="#7F8C8D"
                    />
                  </View>
                )}
              </TouchableOpacity>
              
              <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {file.name}
                </Text>
                <Text style={styles.fileSize}>
                  {formatFileSize(file.size)}
                </Text>
                
                <UploadProgress
                  file={file}
                  compact={true}
                  onPause={() => handlePauseFile(file.id)}
                  onResume={() => handleResumeFile(file.id)}
                  onCancel={() => handleCancelFile(file.id)}
                  onRetry={() => handleRetryFile(file.id)}
                />
              </View>
              
              <View style={styles.fileActions}>
                {file.status.state === 'completed' && (
                  <Icon name="check-circle" size={24} color="#6BCF7F" />
                )}
                
                {file.status.state === 'failed' && (
                  <TouchableOpacity onPress={() => handleRetryFile(file.id)}>
                    <Icon name="refresh" size={24} color="#FFA500" />
                  </TouchableOpacity>
                )}
                
                {(file.status.state === 'pending' || file.status.state === 'uploading') && (
                  <TouchableOpacity onPress={() => handleRemoveFile(file.id)}>
                    <Icon name="close" size={24} color="#FF6B6B" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderFilePickerModal = () => (
    <Modal
      visible={showFilePicker}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowFilePicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.filePickerModal}>
          <View style={styles.filePickerHeader}>
            <Text style={styles.filePickerTitle}>Select Files</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowFilePicker(false)}
            >
              <Icon name="close" size={24} color="#34495E" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.filePickerOptions}>
            <TouchableOpacity
              style={styles.filePickerOption}
              onPress={handleDocumentPicker}
            >
              <Icon name="description" size={32} color="#6C5CE7" />
              <Text style={styles.filePickerOptionText}>Documents</Text>
              <Text style={styles.filePickerOptionSubtext}>
                PDF, Word, Excel, etc.
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.filePickerOption}
              onPress={handleImagePicker}
            >
              <Icon name="image" size={32} color="#4ECDC4" />
              <Text style={styles.filePickerOptionText}>Images</Text>
              <Text style={styles.filePickerOptionSubtext}>
                Photos and images
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.filePickerOption}
              onPress={() => {
                // Would implement camera picker here
                Alert.alert('Camera', 'Camera picker not implemented yet');
              }}
            >
              <Icon name="camera-alt" size={32} color="#FFA500" />
              <Text style={styles.filePickerOptionText}>Camera</Text>
              <Text style={styles.filePickerOptionSubtext}>
                Take photo or video
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderPreviewModal = () => (
    <Modal
      visible={showPreview}
      animationType="slide"
      presentationStyle="page"
      onRequestClose={() => setShowPreview(false)}
    >
      {selectedFile && (
        <FilePreview
          file={selectedFile}
          config={previewConfigFinal}
          onClose={() => setShowPreview(false)}
        />
      )}
    </Modal>
  );

  const renderQueueModal = () => (
    <Modal
      visible={showQueue}
      animationType="slide"
      presentationStyle="page"
      onRequestClose={() => setShowQueue(false)}
    >
      <UploadQueue
        files={files}
        progress={progress}
        isUploading={isUploading}
        isPaused={isPaused}
        onPause={pauseAll}
        onResume={resumeAll}
        onCancel={cancelAll}
        onRetry={retryAll}
        onRemove={handleRemoveFile}
        onClose={() => setShowQueue(false)}
      />
    </Modal>
  );

  return (
    <View style={styles.container}>
      {renderDragDropArea()}
      {renderFileList()}
      {renderFilePickerModal()}
      {renderPreviewModal()}
      {renderQueueModal()}
      
      {/* Hidden file input for web compatibility */}
      <input
        ref={fileInputRef}
        type="file"
        multiple={dragConfig.multiple}
        accept={dragConfig.accept}
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length > 0) {
            handleFileSelection(files);
          }
        }}
      />
    </View>
  );
};

// Helper functions
const getFileIcon = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'videocam';
  if (mimeType.startsWith('audio/')) return 'music-note';
  if (mimeType.includes('pdf')) return 'picture-as-pdf';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'description';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'grid-on';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'slideshow';
  if (mimeType.includes('zip') || mimeType.includes('rar')) return 'folder-zip';
  if (mimeType.includes('text')) return 'text-fields';
  return 'insert-drive-file';
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  dragDropContainer: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 32,
    margin: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
    backgroundColor: '#F8F9FA',
  },
  dragDropActive: {
    borderColor: '#6C5CE7',
    backgroundColor: '#F0F3FF',
  },
  dragDropReject: {
    borderColor: '#FF6B6B',
    backgroundColor: '#FFF5F5',
  },
  dragDropDisabled: {
    opacity: 0.6,
    backgroundColor: '#F5F5F5',
  },
  dragOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(108, 92, 231, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  dragText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6C5CE7',
    marginTop: 8,
  },
  uploadArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginTop: 16,
    marginBottom: 4,
  },
  uploadSubtitle: {
    fontSize: 14,
    color: '#7F8C8D',
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6C5CE7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
    marginTop: 20,
  },
  browseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  fileList: {
    margin: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  fileListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#F8F9FA',
  },
  fileListTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
  },
  fileListActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  fileItems: {
    maxHeight: 300,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filePreview: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
    overflow: 'hidden',
  },
  fileThumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  fileIcon: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2C3E50',
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: '#7F8C8D',
    marginBottom: 4,
  },
  fileActions: {
    marginLeft: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filePickerModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    margin: 32,
    width: width - 64,
    maxHeight: height - 64,
  },
  filePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filePickerOptions: {
    padding: 20,
  },
  filePickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#F8F9FA',
  },
  filePickerOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginLeft: 12,
  },
  filePickerOptionSubtext: {
    fontSize: 12,
    color: '#7F8C8D',
    marginLeft: 12,
  },
});
