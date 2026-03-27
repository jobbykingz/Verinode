import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  UploadFile,
  UploadProgress,
  UploadStatus,
  UploadError,
} from '../../types/fileUpload';

interface UploadProgressProps {
  file: UploadFile;
  compact?: boolean;
  showDetails?: boolean;
  showSpeed?: boolean;
  showTimeRemaining?: boolean;
  showChunkProgress?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  style?: any;
}

const { width } = Dimensions.get('window');

export const UploadProgress: React.FC<UploadProgressProps> = ({
  file,
  compact = false,
  showDetails = true,
  showSpeed = true,
  showTimeRemaining = true,
  showChunkProgress = false,
  onPause,
  onResume,
  onCancel,
  onRetry,
  style,
}) => {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    // Animate progress bar
    Animated.timing(progressAnimation, {
      toValue: file.progress.percentage,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [file.progress.percentage]);

  useEffect(() => {
    // Add pulse effect for uploading state
    if (file.status.state === 'uploading') {
      const pulse = Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]);
      Animated.loop(pulse).start();
    } else {
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [file.status.state]);

  const getStatusIcon = (): string => {
    switch (file.status.state) {
      case 'pending':
        return 'hourglass-empty';
      case 'uploading':
        return 'cloud-upload';
      case 'paused':
        return 'pause';
      case 'completed':
        return 'check-circle';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'cancel';
      case 'validating':
        return 'security';
      case 'processing':
        return 'settings';
      default:
        return 'help';
    }
  };

  const getStatusColor = (): string => {
    switch (file.status.state) {
      case 'pending':
        return '#7F8C8D';
      case 'uploading':
        return '#6C5CE7';
      case 'paused':
        return '#FFA500';
      case 'completed':
        return '#6BCF7F';
      case 'failed':
        return '#FF6B6B';
      case 'cancelled':
        return '#95A5A6';
      case 'validating':
        return '#9B59B6';
      case 'processing':
        return '#3498DB';
      default:
        return '#7F8C8D';
    }
  };

  const getStatusText = (): string => {
    switch (file.status.state) {
      case 'pending':
        return 'Pending';
      case 'uploading':
        return 'Uploading';
      case 'paused':
        return 'Paused';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      case 'validating':
        return 'Validating';
      case 'processing':
        return 'Processing';
      default:
        return 'Unknown';
    }
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond === 0) return '0 B/s';
    
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let size = bytesPerSecond;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatTime = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const renderProgressBar = () => {
    const progressWidth = progressAnimation.interpolate({
      inputRange: [0, 100],
      outputRange: ['0%', '100%'],
      extrapolate: 'clamp',
    });

    return (
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <Animated.View
            style={[
              styles.progressBarFill,
              {
                width: progressWidth,
                backgroundColor: getStatusColor(),
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {Math.round(file.progress.percentage)}%
        </Text>
      </View>
    );
  };

  const renderChunkProgress = () => {
    if (!showChunkProgress || !file.chunks || file.chunks.length === 0) {
      return null;
    }

    const completedChunks = file.chunks.filter(chunk => chunk.uploaded).length;
    const chunkProgress = (completedChunks / file.chunks.length) * 100;

    return (
      <View style={styles.chunkProgressContainer}>
        <Text style={styles.chunkProgressLabel}>
          Chunks: {completedChunks}/{file.chunks.length}
        </Text>
        <View style={styles.chunkProgressBar}>
          <View
            style={[
              styles.chunkProgressBarFill,
              { width: `${chunkProgress}%` },
            ]}
          />
        </View>
      </View>
    );
  };

  const renderActions = () => {
    const actions: JSX.Element[] = [];

    if (file.status.state === 'uploading' && onPause) {
      actions.push(
        <TouchableOpacity
          key="pause"
          style={styles.actionButton}
          onPress={onPause}
        >
          <Icon name="pause" size={16} color="#FFA500" />
        </TouchableOpacity>
      );
    }

    if (file.status.state === 'paused' && onResume) {
      actions.push(
        <TouchableOpacity
          key="resume"
          style={styles.actionButton}
          onPress={onResume}
        >
          <Icon name="play-arrow" size={16} color="#6BCF7F" />
        </TouchableOpacity>
      );
    }

    if ((file.status.state === 'failed' || file.status.state === 'cancelled') && onRetry && file.status.canRetry) {
      actions.push(
        <TouchableOpacity
          key="retry"
          style={styles.actionButton}
          onPress={onRetry}
        >
          <Icon name="refresh" size={16} color="#3498DB" />
        </TouchableOpacity>
      );
    }

    if ((file.status.state === 'uploading' || file.status.state === 'paused') && onCancel && file.status.canCancel) {
      actions.push(
        <TouchableOpacity
          key="cancel"
          style={styles.actionButton}
          onPress={onCancel}
        >
          <Icon name="close" size={16} color="#FF6B6B" />
        </TouchableOpacity>
      );
    }

    return actions.length > 0 ? (
      <View style={styles.actionButtons}>{actions}</View>
    ) : null;
  };

  const renderError = () => {
    if (!file.error) return null;

    return (
      <View style={styles.errorContainer}>
        <Icon name="error" size={16} color="#FF6B6B" />
        <Text style={styles.errorText}>{file.error.message}</Text>
        {file.error.retryCount > 0 && (
          <Text style={styles.retryText}>
            Retry {file.error.retryCount}/{file.error.maxRetries}
          </Text>
        )}
      </View>
    );
  };

  const renderDetails = () => {
    if (!showDetails) return null;

    return (
      <View style={styles.detailsContainer}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Status:</Text>
          <Text style={[styles.detailValue, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Size:</Text>
          <Text style={styles.detailValue}>
            {formatBytes(file.progress.bytesUploaded)} / {formatBytes(file.progress.totalBytes)}
          </Text>
        </View>

        {showSpeed && file.status.state === 'uploading' && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Speed:</Text>
            <Text style={styles.detailValue}>
              {formatSpeed(file.progress.speed)}
            </Text>
          </View>
        )}

        {showTimeRemaining && file.status.state === 'uploading' && file.progress.timeRemaining && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Time remaining:</Text>
            <Text style={styles.detailValue}>
              {formatTime(file.progress.timeRemaining)}
            </Text>
          </View>
        )}

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Time elapsed:</Text>
          <Text style={styles.detailValue}>
            {formatTime(file.progress.timeElapsed)}
          </Text>
        </View>

        {file.chunks && file.chunks.length > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Chunks:</Text>
            <Text style={styles.detailValue}>
              {file.progress.chunksCompleted}/{file.progress.totalChunks}
            </Text>
          </View>
        )}

        {file.priority && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Priority:</Text>
            <Text style={styles.detailValue}>
              {file.priority.charAt(0).toUpperCase() + file.priority.slice(1)}
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (compact) {
    return (
      <View style={[styles.compactContainer, style]}>
        <View style={styles.compactHeader}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Icon
              name={getStatusIcon()}
              size={16}
              color={getStatusColor()}
            />
          </Animated.View>
          <Text style={styles.compactStatus}>{getStatusText()}</Text>
          <Text style={styles.compactProgress}>
            {Math.round(file.progress.percentage)}%
          </Text>
        </View>
        
        {renderProgressBar()}
        
        {renderActions()}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <View style={styles.statusContainer}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Icon
              name={getStatusIcon()}
              size={24}
              color={getStatusColor()}
            />
          </Animated.View>
          <View style={styles.statusTextContainer}>
            <Text style={styles.fileName} numberOfLines={1}>
              {file.name}
            </Text>
            <Text style={styles.statusText}>{getStatusText()}</Text>
          </View>
        </View>
        
        <View style={styles.progressInfo}>
          <Text style={styles.progressPercentage}>
            {Math.round(file.progress.percentage)}%
          </Text>
          <Text style={styles.progressSize}>
            {formatBytes(file.progress.bytesUploaded)} / {formatBytes(file.progress.totalBytes)}
          </Text>
        </View>
      </View>

      {renderProgressBar()}
      {renderChunkProgress()}
      {renderDetails()}
      {renderError()}
      {renderActions()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  compactContainer: {
    padding: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusTextContainer: {
    marginLeft: 8,
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2C3E50',
    marginBottom: 2,
  },
  statusText: {
    fontSize: 12,
    color: '#7F8C8D',
  },
  progressInfo: {
    alignItems: 'flex-end',
  },
  progressPercentage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
  },
  progressSize: {
    fontSize: 12,
    color: '#7F8C8D',
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  compactStatus: {
    fontSize: 12,
    color: '#7F8C8D',
    marginLeft: 8,
    flex: 1,
  },
  compactProgress: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2C3E50',
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBarBackground: {
    flex: 1,
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginRight: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    minWidth: 2,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2C3E50',
    minWidth: 35,
    textAlign: 'right',
  },
  chunkProgressContainer: {
    marginBottom: 8,
  },
  chunkProgressLabel: {
    fontSize: 11,
    color: '#7F8C8D',
    marginBottom: 4,
  },
  chunkProgressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
  },
  chunkProgressBarFill: {
    height: '100%',
    backgroundColor: '#6C5CE7',
    borderRadius: 2,
  },
  detailsContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: '#7F8C8D',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2C3E50',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F5',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#FF6B6B',
    marginLeft: 8,
    flex: 1,
  },
  retryText: {
    fontSize: 10,
    color: '#FF6B6B',
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
});
