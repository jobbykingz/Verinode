import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  UploadFile,
  UploadQueue,
  QueueStatus,
  QueueProgress,
  UploadPriority,
} from '../../types/fileUpload';
import UploadProgress from './UploadProgress';

interface UploadQueueProps {
  files: UploadFile[];
  progress: number;
  isUploading: boolean;
  isPaused: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  onRemove?: (fileId: string) => void;
  onRetryFile?: (fileId: string) => void;
  onPauseFile?: (fileId: string) => void;
  onResumeFile?: (fileId: string) => void;
  onCancelFile?: (fileId: string) => void;
  onClose?: () => void;
  style?: any;
}

const { width, height } = Dimensions.get('window');

export const UploadQueue: React.FC<UploadQueueProps> = ({
  files,
  progress,
  isUploading,
  isPaused,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onRemove,
  onRetryFile,
  onPauseFile,
  onResumeFile,
  onCancelFile,
  onClose,
  style,
}) => {
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'status' | 'priority' | 'progress'>('status');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterBy, setFilterBy] = useState<'all' | 'pending' | 'uploading' | 'paused' | 'completed' | 'failed'>('all');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showBatchActions, setShowBatchActions] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [animValue] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // Calculate queue statistics
  const queueStats = useMemo(() => {
    const stats = {
      total: files.length,
      pending: files.filter(f => f.status.state === 'pending').length,
      uploading: files.filter(f => f.status.state === 'uploading').length,
      paused: files.filter(f => f.status.state === 'paused').length,
      completed: files.filter(f => f.status.state === 'completed').length,
      failed: files.filter(f => f.status.state === 'failed').length,
      cancelled: files.filter(f => f.status.state === 'cancelled').length,
      totalSize: files.reduce((sum, f) => sum + f.size, 0),
      uploadedSize: files.reduce((sum, f) => sum + f.progress.bytesUploaded, 0),
      averageSpeed: files.reduce((sum, f) => sum + f.progress.speed, 0) / files.length || 0,
    };

    return stats;
  }, [files]);

  // Filter and sort files
  const processedFiles = useMemo(() => {
    let filtered = files;

    // Apply filter
    if (filterBy !== 'all') {
      filtered = filtered.filter(f => f.status.state === filterBy);
    }

    // Apply sort
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'status':
          comparison = a.status.state.localeCompare(b.status.state);
          break;
        case 'priority':
          const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
          comparison = (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0);
          break;
        case 'progress':
          comparison = a.progress.percentage - b.progress.percentage;
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [files, sortBy, sortOrder, filterBy]);

  // Handle file selection
  const toggleFileSelection = (fileId: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    setSelectedFiles(newSelection);
    setShowBatchActions(newSelection.size > 0);
  };

  const selectAllFiles = () => {
    if (selectedFiles.size === processedFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(processedFiles.map(f => f.id)));
    }
    setShowBatchActions(selectedFiles.size > 0);
  };

  // Batch actions
  const handleBatchRetry = () => {
    const failedFiles = Array.from(selectedFiles).filter(fileId => {
      const file = files.find(f => f.id === fileId);
      return file && (file.status.state === 'failed' || file.status.state === 'cancelled');
    });

    if (failedFiles.length === 0) {
      Alert.alert('No Retryable Files', 'No failed or cancelled files selected');
      return;
    }

    failedFiles.forEach(fileId => onRetryFile?.(fileId));
    setSelectedFiles(new Set());
    setShowBatchActions(false);
  };

  const handleBatchPause = () => {
    const uploadingFiles = Array.from(selectedFiles).filter(fileId => {
      const file = files.find(f => f.id === fileId);
      return file && file.status.state === 'uploading';
    });

    if (uploadingFiles.length === 0) {
      Alert.alert('No Paused Files', 'No uploading files selected');
      return;
    }

    uploadingFiles.forEach(fileId => onPauseFile?.(fileId));
    setSelectedFiles(new Set());
    setShowBatchActions(false);
  };

  const handleBatchResume = () => {
    const pausedFiles = Array.from(selectedFiles).filter(fileId => {
      const file = files.find(f => f.id === fileId);
      return file && file.status.state === 'paused';
    });

    if (pausedFiles.length === 0) {
      Alert.alert('No Resumable Files', 'No paused files selected');
      return;
    }

    pausedFiles.forEach(fileId => onResumeFile?.(fileId));
    setSelectedFiles(new Set());
    setShowBatchActions(false);
  };

  const handleBatchCancel = () => {
    Alert.alert(
      'Cancel Uploads',
      `Are you sure you want to cancel ${selectedFiles.size} upload(s)?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Cancel Uploads',
          style: 'destructive',
          onPress: () => {
            selectedFiles.forEach(fileId => onCancelFile?.(fileId));
            setSelectedFiles(new Set());
            setShowBatchActions(false);
          },
        },
      ]
    );
  };

  const handleBatchRemove = () => {
    Alert.alert(
      'Remove Files',
      `Are you sure you want to remove ${selectedFiles.size} file(s) from the queue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove Files',
          style: 'destructive',
          onPress: () => {
            selectedFiles.forEach(fileId => onRemove?.(fileId));
            setSelectedFiles(new Set());
            setShowBatchActions(false);
          },
        },
      ]
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    // Simulate refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getPriorityIcon = (priority: UploadPriority): string => {
    switch (priority) {
      case 'urgent':
        return 'priority-high';
      case 'high':
        return 'arrow-upward';
      case 'normal':
        return 'remove';
      case 'low':
        return 'arrow-downward';
      default:
        return 'remove';
    }
  };

  const getPriorityColor = (priority: UploadPriority): string => {
    switch (priority) {
      case 'urgent':
        return '#FF6B6B';
      case 'high':
        return '#FFA500';
      case 'normal':
        return '#7F8C8D';
      case 'low':
        return '#6BCF7F';
      default:
        return '#7F8C8D';
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Icon name="close" size={24} color="#34495E" />
        </TouchableOpacity>
        <Text style={styles.title}>Upload Queue</Text>
      </View>
      
      <View style={styles.headerRight}>
        <TouchableOpacity style={styles.headerButton} onPress={handleRefresh}>
          <Icon name="refresh" size={20} color="#7F8C8D" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStats = () => (
    <View style={styles.statsContainer}>
      <View style={styles.statItem}>
        <Text style={styles.statNumber}>{queueStats.total}</Text>
        <Text style={styles.statLabel}>Total</Text>
      </View>
      
      <View style={styles.statItem}>
        <Text style={[styles.statNumber, { color: '#6C5CE7' }]}>
          {queueStats.uploading}
        </Text>
        <Text style={styles.statLabel}>Uploading</Text>
      </View>
      
      <View style={styles.statItem}>
        <Text style={[styles.statNumber, { color: '#FFA500' }]}>
          {queueStats.paused}
        </Text>
        <Text style={styles.statLabel}>Paused</Text>
      </View>
      
      <View style={styles.statItem}>
        <Text style={[styles.statNumber, { color: '#6BCF7F' }]}>
          {queueStats.completed}
        </Text>
        <Text style={styles.statLabel}>Completed</Text>
      </View>
      
      <View style={styles.statItem}>
        <Text style={[styles.statNumber, { color: '#FF6B6B' }]}>
          {queueStats.failed}
        </Text>
        <Text style={styles.statLabel}>Failed</Text>
      </View>
    </View>
  );

  const renderProgress = () => (
    <View style={styles.overallProgressContainer}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressTitle}>Overall Progress</Text>
        <Text style={styles.progressPercentage}>
          {Math.round(progress)}%
        </Text>
      </View>
      
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${progress}%` },
          ]}
        />
      </View>
      
      <View style={styles.progressDetails}>
        <Text style={styles.progressText}>
          {formatFileSize(queueStats.uploadedSize)} / {formatFileSize(queueStats.totalSize)}
        </Text>
        <Text style={styles.progressText}>
          {queueStats.averageSpeed > 0 ? `${formatFileSize(queueStats.averageSpeed)}/s` : 'Calculating...'}
        </Text>
      </View>
    </View>
  );

  const renderControls = () => (
    <View style={styles.controlsContainer}>
      <View style={styles.controlRow}>
        <TouchableOpacity
          style={[styles.controlButton, isUploading && styles.controlButtonActive]}
          onPress={isUploading ? onPause : onResume}
          disabled={!isUploading && !isPaused}
        >
          <Icon
            name={isUploading ? 'pause' : 'play-arrow'}
            size={20}
            color={isUploading ? '#FFFFFF' : '#7F8C8D'}
          />
          <Text style={[
            styles.controlButtonText,
            isUploading && styles.controlButtonTextActive,
          ]}>
            {isUploading ? 'Pause All' : 'Resume All'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.controlButton}
          onPress={onRetry}
          disabled={queueStats.failed === 0}
        >
          <Icon name="refresh" size={20} color="#3498DB" />
          <Text style={styles.controlButtonText}>Retry All</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.controlButton}
          onPress={onCancel}
          disabled={!isUploading && !isPaused}
        >
          <Icon name="cancel" size={20} color="#FF6B6B" />
          <Text style={styles.controlButtonText}>Cancel All</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.controlRow}>
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => {
            const options = ['name', 'size', 'status', 'priority', 'progress'];
            const currentIndex = options.indexOf(sortBy);
            const nextIndex = (currentIndex + 1) % options.length;
            setSortBy(options[nextIndex] as any);
          }}
        >
          <Icon name="sort" size={16} color="#7F8C8D" />
          <Text style={styles.sortButtonText}>
            Sort by {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
        >
          <Icon
            name={sortOrder === 'asc' ? 'arrow-upward' : 'arrow-downward'}
            size={16}
            color="#7F8C8D"
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFilters = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
      {(['all', 'pending', 'uploading', 'paused', 'completed', 'failed'] as const).map((filter) => (
        <TouchableOpacity
          key={filter}
          style={[
            styles.filterButton,
            filterBy === filter && styles.filterButtonActive,
          ]}
          onPress={() => setFilterBy(filter)}
        >
          <Text style={[
            styles.filterButtonText,
            filterBy === filter && styles.filterButtonTextActive,
          ]}>
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
            {' '}
            {filter === 'all' ? queueStats.total :
              filter === 'pending' ? queueStats.pending :
              filter === 'uploading' ? queueStats.uploading :
              filter === 'paused' ? queueStats.paused :
              filter === 'completed' ? queueStats.completed :
              queueStats.failed}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderBatchActions = () => {
    if (!showBatchActions) return null;

    return (
      <View style={styles.batchActionsContainer}>
        <Text style={styles.batchActionsTitle}>
          {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''} selected
        </Text>
        
        <View style={styles.batchActionButtons}>
          <TouchableOpacity style={styles.batchActionButton} onPress={handleBatchRetry}>
            <Icon name="refresh" size={16} color="#3498DB" />
            <Text style={styles.batchActionText}>Retry</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.batchActionButton} onPress={handleBatchPause}>
            <Icon name="pause" size={16} color="#FFA500" />
            <Text style={styles.batchActionText}>Pause</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.batchActionButton} onPress={handleBatchResume}>
            <Icon name="play-arrow" size={16} color="#6BCF7F" />
            <Text style={styles.batchActionText}>Resume</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.batchActionButton} onPress={handleBatchCancel}>
            <Icon name="cancel" size={16} color="#FF6B6B" />
            <Text style={styles.batchActionText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.batchActionButton} onPress={handleBatchRemove}>
            <Icon name="delete" size={16} color="#95A5A6" />
            <Text style={styles.batchActionText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderFileItem = (file: UploadFile) => (
    <View key={file.id} style={styles.fileItem}>
      <TouchableOpacity
        style={styles.fileCheckbox}
        onPress={() => toggleFileSelection(file.id)}
      >
        <Icon
          name={selectedFiles.has(file.id) ? 'check-box' : 'check-box-outline-blank'}
          size={20}
          color={selectedFiles.has(file.id) ? '#6C5CE7' : '#7F8C8D'}
        />
      </TouchableOpacity>
      
      <View style={styles.fileInfo}>
        <View style={styles.fileHeader}>
          <Text style={styles.fileName} numberOfLines={1}>
            {file.name}
          </Text>
          <View style={styles.fileMeta}>
            <Icon
              name={getPriorityIcon(file.priority)}
              size={16}
              color={getPriorityColor(file.priority)}
            />
            <Text style={styles.fileSize}>
              {formatFileSize(file.size)}
            </Text>
          </View>
        </View>
        
        <UploadProgress
          file={file}
          compact={true}
          onPause={() => onPauseFile?.(file.id)}
          onResume={() => onResumeFile?.(file.id)}
          onCancel={() => onCancelFile?.(file.id)}
          onRetry={() => onRetryFile?.(file.id)}
        />
      </View>
      
      <TouchableOpacity
        style={styles.fileRemove}
        onPress={() => onRemove?.(file.id)}
      >
        <Icon name="close" size={20} color="#FF6B6B" />
      </TouchableOpacity>
    </View>
  );

  return (
    <Animated.View style={[styles.container, { opacity: animValue }, style]}>
      {renderHeader()}
      {renderStats()}
      {renderProgress()}
      {renderControls()}
      {renderFilters()}
      {renderBatchActions()}
      
      <ScrollView
        style={styles.fileList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {processedFiles.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="inbox" size={64} color="#BDC3C7" />
            <Text style={styles.emptyStateText}>No files in queue</Text>
            <Text style={styles.emptyStateSubtext}>
              {filterBy === 'all' 
                ? 'Add files to start uploading'
                : `No ${filterBy} files found`
              }
            </Text>
          </View>
        ) : (
          processedFiles.map(renderFileItem)
        )}
      </ScrollView>
      
      {showBatchActions && (
        <View style={styles.selectAllContainer}>
          <TouchableOpacity style={styles.selectAllButton} onPress={selectAllFiles}>
            <Icon
              name={selectedFiles.size === processedFiles.length ? 'check-box' : 'check-box-outline-blank'}
              size={20}
              color="#6C5CE7"
            />
            <Text style={styles.selectAllText}>
              {selectedFiles.size === processedFiles.length ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2C3E50',
  },
  statLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 2,
  },
  overallProgressContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
  },
  progressPercentage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6C5CE7',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6C5CE7',
    borderRadius: 4,
  },
  progressDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressText: {
    fontSize: 12,
    color: '#7F8C8D',
  },
  controlsContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    gap: 6,
  },
  controlButtonActive: {
    backgroundColor: '#6C5CE7',
  },
  controlButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#7F8C8D',
  },
  controlButtonTextActive: {
    color: '#FFFFFF',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    gap: 4,
  },
  sortButtonText: {
    fontSize: 12,
    color: '#7F8C8D',
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#6C5CE7',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#7F8C8D',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  batchActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F0F3FF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  batchActionsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6C5CE7',
  },
  batchActionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  batchActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    gap: 4,
  },
  batchActionText: {
    fontSize: 11,
    color: '#7F8C8D',
  },
  fileList: {
    flex: 1,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  fileCheckbox: {
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2C3E50',
    flex: 1,
    marginRight: 8,
  },
  fileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileSize: {
    fontSize: 12,
    color: '#7F8C8D',
  },
  fileRemove: {
    marginLeft: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 64,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#7F8C8D',
    marginTop: 16,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#95A5A6',
    textAlign: 'center',
  },
  selectAllContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6C5CE7',
  },
});
