import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Platform,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import PushNotification from 'react-native-push-notification';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';

export interface PushNotificationData {
  id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  actions?: NotificationAction[];
  imageUrl?: string;
  sound?: string;
  vibrate?: boolean;
  priority?: 'default' | 'high' | 'max';
  category?: string;
  ttl?: number;
}

export interface NotificationAction {
  id: string;
  title: string;
  icon?: string;
  input?: boolean;
  placeholder?: string;
}

export interface NotificationChannel {
  id: string;
  name: string;
  description: string;
  importance: 'default' | 'high' | 'max' | 'low' | 'min';
  sound?: string;
  vibrate?: boolean;
  enableLights?: boolean;
  lightColor?: string;
}

export interface NotificationHandler {
  requestPermissions: () => Promise<boolean>;
  hasPermission: () => Promise<boolean>;
  sendLocalNotification: (notification: PushNotificationData) => void;
  scheduleNotification: (notification: PushNotificationData, date: Date) => void;
  cancelNotification: (id: string) => void;
  clearAllNotifications: () => void;
  getDeliveredNotifications: () => Promise<PushNotificationData[]>;
  createChannel: (channel: NotificationChannel) => void;
  setBadgeNumber: (number: number) => void;
}

interface PushHandlerContextType {
  notificationHandler: NotificationHandler;
  notifications: PushNotificationData[];
  unreadCount: number;
  permissionsGranted: boolean;
  activeNotification: PushNotificationData | null;
  showNotificationModal: (notification: PushNotificationData) => void;
  hideNotificationModal: () => void;
  handleAction: (notificationId: string, actionId: string, inputText?: string) => void;
}

const PushHandlerContext = createContext<PushHandlerContextType | null>(null);

interface PushNotificationProviderProps {
  children: ReactNode;
  onNotificationPress?: (notification: PushNotificationData) => void;
  onActionPress?: (notification: PushNotificationData, action: NotificationAction, inputText?: string) => void;
  onNotificationReceived?: (notification: PushNotificationData) => void;
}

const { width, height } = Dimensions.get('window');

export const PushNotificationProvider: React.FC<PushNotificationProviderProps> = ({
  children,
  onNotificationPress,
  onActionPress,
  onNotificationReceived,
}) => {
  const [notifications, setNotifications] = useState<PushNotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [activeNotification, setActiveNotification] = useState<PushNotificationData | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [slideAnim] = useState(new Animated.Value(height));
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    initializePushNotifications();
    checkPermissions();
    loadStoredNotifications();
  }, []);

  const initializePushNotifications = () => {
    PushNotification.configure({
      onRegister: (token) => {
        console.log('Push notification token:', token);
        // Send token to backend
        sendTokenToBackend(token);
      },
      onNotification: (notification) => {
        handleNotificationReceived(notification);
      },
      onAction: (notification) => {
        handleNotificationAction(notification);
      },
      onRegistrationError: (error) => {
        console.error('Push notification registration error:', error);
      },
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      popInitialNotification: true,
      requestPermissions: Platform.OS !== 'ios',
    });

    // Create default channels
    createDefaultChannels();
  };

  const createDefaultChannels = () => {
    const channels: NotificationChannel[] = [
      {
        id: 'default',
        name: 'Default Notifications',
        description: 'General notifications',
        importance: 'default',
        sound: 'default',
        vibrate: true,
        enableLights: true,
        lightColor: '#6C5CE7',
      },
      {
        id: 'messages',
        name: 'Messages',
        description: 'Chat and message notifications',
        importance: 'high',
        sound: 'message',
        vibrate: true,
        enableLights: true,
        lightColor: '#4ECDC4',
      },
      {
        id: 'alerts',
        name: 'Alerts',
        description: 'Important alerts and security notifications',
        importance: 'max',
        sound: 'alert',
        vibrate: true,
        enableLights: true,
        lightColor: '#FF6B6B',
      },
      {
        id: 'system',
        name: 'System',
        description: 'System and maintenance notifications',
        importance: 'low',
        sound: false,
        vibrate: false,
        enableLights: false,
      },
    ];

    channels.forEach(channel => {
      PushNotification.createChannel(channel);
    });
  };

  const checkPermissions = async () => {
    const hasPermission = await notificationHandler.hasPermission();
    setPermissionsGranted(hasPermission);
  };

  const loadStoredNotifications = async () => {
    try {
      const stored = await AsyncStorage.getItem('push_notifications');
      if (stored) {
        const parsedNotifications = JSON.parse(stored);
        setNotifications(parsedNotifications);
        updateUnreadCount(parsedNotifications);
      }
    } catch (error) {
      console.error('Error loading stored notifications:', error);
    }
  };

  const sendTokenToBackend = async (token: string) => {
    try {
      // Send token to your backend API
      const response = await fetch('https://api.verinode.com/push/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`,
        },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        throw new Error('Failed to register push token');
      }
    } catch (error) {
      console.error('Error sending token to backend:', error);
    }
  };

  const getAuthToken = async (): Promise<string> => {
    // Get authentication token from storage
    return await AsyncStorage.getItem('auth_token') || '';
  };

  const handleNotificationReceived = (notification: any) => {
    const notificationData: PushNotificationData = {
      id: notification.id || Date.now().toString(),
      title: notification.title || 'Notification',
      body: notification.message || notification.body || '',
      data: notification.data || {},
      actions: notification.actions || [],
      imageUrl: notification.imageUrl,
      sound: notification.sound,
      vibrate: notification.vibrate,
      priority: notification.priority || 'default',
      category: notification.category || 'default',
    };

    // Add to notifications list
    setNotifications(prev => {
      const updated = [notificationData, ...prev];
      storeNotifications(updated);
      updateUnreadCount(updated);
      return updated;
    });

    // Show modal for rich notifications
    if (notificationData.actions && notificationData.actions.length > 0) {
      showNotificationModal(notificationData);
    }

    // Call callback
    if (onNotificationReceived) {
      onNotificationReceived(notificationData);
    }

    // Handle notification press
    if (notification.userInteraction) {
      handleNotificationPress(notificationData);
    }
  };

  const handleNotificationAction = (notification: any) => {
    const notificationData: PushNotificationData = {
      id: notification.id || Date.now().toString(),
      title: notification.title || 'Notification',
      body: notification.message || notification.body || '',
      data: notification.data || {},
    };

    const action = notification.action || 'default';
    handleAction(notificationData.id, action);
  };

  const handleNotificationPress = (notification: PushNotificationData) => {
    // Mark as read
    setNotifications(prev => {
      const updated = prev.map(n => 
        n.id === notification.id ? { ...n, read: true } : n
      );
      storeNotifications(updated);
      updateUnreadCount(updated);
      return updated;
    });

    // Handle deep linking
    if (notification.data?.deepLink) {
      Linking.openURL(notification.data.deepLink);
    }

    // Call callback
    if (onNotificationPress) {
      onNotificationPress(notification);
    }
  };

  const handleAction = (notificationId: string, actionId: string, inputText?: string) => {
    const notification = notifications.find(n => n.id === notificationId);
    if (!notification) return;

    const action = notification.actions?.find(a => a.id === actionId);
    if (!action) return;

    // Execute action
    executeNotificationAction(notification, action, inputText);

    // Call callback
    if (onActionPress) {
      onActionPress(notification, action, inputText);
    }

    // Hide modal
    hideNotificationModal();
  };

  const executeNotificationAction = async (
    notification: PushNotificationData, 
    action: NotificationAction, 
    inputText?: string
  ) => {
    try {
      // Send action to backend
      const response = await fetch('https://api.verinode.com/push/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`,
        },
        body: JSON.stringify({
          notificationId: notification.id,
          actionId: action.id,
          inputText,
          data: notification.data,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to execute notification action');
      }

      // Handle local action execution
      await executeLocalAction(notification, action, inputText);
    } catch (error) {
      console.error('Error executing notification action:', error);
    }
  };

  const executeLocalAction = async (
    notification: PushNotificationData,
    action: NotificationAction,
    inputText?: string
  ) => {
    switch (action.id) {
      case 'mark_read':
        // Mark notification as read
        setNotifications(prev => {
          const updated = prev.map(n => 
            n.id === notification.id ? { ...n, read: true } : n
          );
          storeNotifications(updated);
          updateUnreadCount(updated);
          return updated;
        });
        break;
      
      case 'delete':
        // Delete notification
        setNotifications(prev => {
          const updated = prev.filter(n => n.id !== notification.id);
          storeNotifications(updated);
          updateUnreadCount(updated);
          return updated;
        });
        break;
      
      case 'reply':
        // Handle reply action
        if (inputText && notification.data?.conversationId) {
          // Send reply to conversation
          await sendReply(notification.data.conversationId, inputText);
        }
        break;
      
      case 'accept':
      case 'confirm':
        // Handle accept/confirm actions
        if (notification.data?.requestId) {
          await respondToRequest(notification.data.requestId, 'accept');
        }
        break;
      
      case 'decline':
      case 'reject':
        // Handle decline/reject actions
        if (notification.data?.requestId) {
          await respondToRequest(notification.data.requestId, 'decline');
        }
        break;
      
      default:
        // Custom action
        if (notification.data?.customAction) {
          await executeCustomAction(notification.data.customAction, inputText);
        }
        break;
    }
  };

  const sendReply = async (conversationId: string, message: string) => {
    try {
      const response = await fetch('https://api.verinode.com/messages/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`,
        },
        body: JSON.stringify({
          conversationId,
          message,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send reply');
      }
    } catch (error) {
      console.error('Error sending reply:', error);
    }
  };

  const respondToRequest = async (requestId: string, response: 'accept' | 'decline') => {
    try {
      const apiResponse = await fetch('https://api.verinode.com/requests/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`,
        },
        body: JSON.stringify({
          requestId,
          response,
        }),
      });

      if (!apiResponse.ok) {
        throw new Error('Failed to respond to request');
      }
    } catch (error) {
      console.error('Error responding to request:', error);
    }
  };

  const executeCustomAction = async (actionData: any, inputText?: string) => {
    try {
      const response = await fetch('https://api.verinode.com/actions/custom', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`,
        },
        body: JSON.stringify({
          action: actionData,
          inputText,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to execute custom action');
      }
    } catch (error) {
      console.error('Error executing custom action:', error);
    }
  };

  const showNotificationModal = (notification: PushNotificationData) => {
    setActiveNotification(notification);
    setModalVisible(true);
    
    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: height * 0.3,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const hideNotificationModal = () => {
    // Animate out
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
      setModalVisible(false);
      setActiveNotification(null);
    });
  };

  const storeNotifications = async (notificationsList: PushNotificationData[]) => {
    try {
      await AsyncStorage.setItem('push_notifications', JSON.stringify(notificationsList));
    } catch (error) {
      console.error('Error storing notifications:', error);
    }
  };

  const updateUnreadCount = (notificationsList: PushNotificationData[]) => {
    const unread = notificationsList.filter(n => !n.read).length;
    setUnreadCount(unread);
  };

  const notificationHandler: NotificationHandler = {
    requestPermissions: async (): Promise<boolean> => {
      try {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          setPermissionsGranted(granted === PermissionsAndroid.RESULTS.GRANTED);
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        } else {
          // iOS permissions are handled by the system
          const hasPermission = await PushNotification.checkPermissions();
          setPermissionsGranted(hasPermission);
          return hasPermission;
        }
      } catch (error) {
        console.error('Error requesting permissions:', error);
        return false;
      }
    },

    hasPermission: async (): Promise<boolean> => {
      try {
        return await PushNotification.checkPermissions();
      } catch (error) {
        console.error('Error checking permissions:', error);
        return false;
      }
    },

    sendLocalNotification: (notification: PushNotificationData) => {
      PushNotification.localNotification({
        channelId: notification.category || 'default',
        id: parseInt(notification.id),
        title: notification.title,
        message: notification.body,
        data: notification.data,
        actions: notification.actions?.map(action => ({
          title: action.title,
          icon: action.icon,
        })),
        userInfo: notification.data,
        playSound: !!notification.sound,
        soundName: notification.sound,
        vibrate: notification.vibrate,
        priority: notification.priority,
        largeIcon: notification.imageUrl,
        bigText: notification.body,
        bigPictureUrl: notification.imageUrl,
      });
    },

    scheduleNotification: (notification: PushNotificationData, date: Date) => {
      PushNotification.localNotificationSchedule({
        channelId: notification.category || 'default',
        id: parseInt(notification.id),
        title: notification.title,
        message: notification.body,
        data: notification.data,
        date: date.getTime(),
        playSound: !!notification.sound,
        soundName: notification.sound,
        vibrate: notification.vibrate,
        priority: notification.priority,
      });
    },

    cancelNotification: (id: string) => {
      PushNotification.cancelLocalNotifications(parseInt(id));
    },

    clearAllNotifications: () => {
      PushNotification.cancelAllLocalNotifications();
      PushNotification.cancelAllLocalNotifications();
    },

    getDeliveredNotifications: async (): Promise<PushNotificationData[]> => {
      try {
        const delivered = await PushNotification.getDeliveredNotifications();
        return delivered.map((notif: any) => ({
          id: notif.id.toString(),
          title: notif.title,
          body: notif.body,
          data: notif.data || {},
        }));
      } catch (error) {
        console.error('Error getting delivered notifications:', error);
        return [];
      }
    },

    createChannel: (channel: NotificationChannel) => {
      PushNotification.createChannel(channel);
    },

    setBadgeNumber: (number: number) => {
      PushNotification.setApplicationIconBadgeNumber(number);
    },
  };

  const contextValue: PushHandlerContextType = {
    notificationHandler,
    notifications,
    unreadCount,
    permissionsGranted,
    activeNotification,
    showNotificationModal,
    hideNotificationModal,
    handleAction,
  };

  return (
    <PushHandlerContext.Provider value={contextValue}>
      {children}
      
      {/* Notification Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="none"
        onRequestClose={hideNotificationModal}
      >
        <Animated.View style={[styles.modalOverlay, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.modalBackground}
            activeOpacity={1}
            onPress={hideNotificationModal}
          />
          <Animated.View style={[styles.notificationModal, { transform: [{ translateY: slideAnim }] }]}>
            {activeNotification && (
              <NotificationModalContent
                notification={activeNotification}
                onAction={handleAction}
                onClose={hideNotificationModal}
              />
            )}
          </Animated.View>
        </Animated.View>
      </Modal>
    </PushHandlerContext.Provider>
  );
};

export const usePushNotifications = () => {
  const context = useContext(PushHandlerContext);
  if (!context) {
    throw new Error('usePushNotifications must be used within PushNotificationProvider');
  }
  return context;
};

// Notification Modal Content Component
interface NotificationModalContentProps {
  notification: PushNotificationData;
  onAction: (notificationId: string, actionId: string, inputText?: string) => void;
  onClose: () => void;
}

const NotificationModalContent: React.FC<NotificationModalContentProps> = ({
  notification,
  onAction,
  onClose,
}) => {
  const [inputText, setInputText] = useState('');
  const [showInput, setShowInput] = useState(false);

  const handleActionPress = (action: NotificationAction) => {
    if (action.input) {
      setShowInput(true);
    } else {
      onAction(notification.id, action.id);
    }
  };

  const handleInputSubmit = () => {
    const action = notification.actions?.find(a => a.input);
    if (action) {
      onAction(notification.id, action.id, inputText);
    }
  };

  return (
    <View style={styles.modalContent}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>{notification.title}</Text>
        <TouchableOpacity onPress={onClose}>
          <Icon name="close" size={24} color="#7F8C8D" />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.modalBody}>{notification.body}</Text>
      
      {notification.imageUrl && (
        <Image
          source={{ uri: notification.imageUrl }}
          style={styles.modalImage}
          resizeMode="cover"
        />
      )}
      
      {notification.actions && notification.actions.length > 0 && (
        <View style={styles.actionsContainer}>
          {notification.actions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.actionButton}
              onPress={() => handleActionPress(action)}
            >
              <Icon
                name={action.icon || 'touch-app'}
                size={20}
                color="#6C5CE7"
              />
              <Text style={styles.actionButtonText}>{action.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      
      {showInput && (
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder={notification.actions?.find(a => a.input)?.placeholder || 'Enter response...'}
            value={inputText}
            onChangeText={setInputText}
            multiline
            autoFocus
          />
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleInputSubmit}
          >
            <Text style={styles.submitButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// Notification Badge Component
interface NotificationBadgeProps {
  size?: number;
  color?: string;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  size = 20,
  color = '#FF6B6B',
}) => {
  const { unreadCount } = usePushNotifications();

  if (unreadCount === 0) return null;

  return (
    <View style={[styles.badge, { width: size, height: size, backgroundColor: color }]}>
      <Text style={[styles.badgeText, { fontSize: size * 0.6 }]}>
        {unreadCount > 99 ? '99+' : unreadCount}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackground: {
    flex: 1,
  },
  notificationModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.7,
  },
  modalContent: {
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    flex: 1,
  },
  modalBody: {
    fontSize: 16,
    color: '#34495E',
    lineHeight: 24,
    marginBottom: 16,
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  actionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  inputContainer: {
    marginTop: 16,
    gap: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#6C5CE7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 20,
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
