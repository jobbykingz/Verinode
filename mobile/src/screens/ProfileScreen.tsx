import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { storage, biometrics, notifications, checkNetworkConnectivity } from '../utils/mobileUtils';

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const [biometricEnabled, setBiometricEnabled] = React.useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(false);
  const [darkMode, setDarkMode] = React.useState(false);

  React.useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await storage.getItem('app_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        setBiometricEnabled(parsed.biometricEnabled || false);
        setNotificationsEnabled(parsed.notificationsEnabled || false);
        setDarkMode(parsed.darkMode || false);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (newSettings: any) => {
    try {
      await storage.setItem('app_settings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleBiometricToggle = async () => {
    if (!biometricEnabled) {
      const isAvailable = await biometrics.isAvailable();
      if (!isAvailable) {
        Alert.alert('Biometrics', 'Biometric authentication is not available on this device');
        return;
      }

      const authenticated = await biometrics.authenticate('Enable biometric authentication');
      if (authenticated) {
        setBiometricEnabled(true);
        await saveSettings({ biometricEnabled: true, notificationsEnabled, darkMode });
      }
    } else {
      setBiometricEnabled(false);
      await saveSettings({ biometricEnabled: false, notificationsEnabled, darkMode });
    }
  };

  const handleNotificationToggle = async () => {
    if (!notificationsEnabled) {
      const hasPermission = await notifications.requestPermissions();
      if (hasPermission) {
        setNotificationsEnabled(true);
        await saveSettings({ biometricEnabled, notificationsEnabled: true, darkMode });
      }
    } else {
      setNotificationsEnabled(false);
      await saveSettings({ biometricEnabled, notificationsEnabled: false, darkMode });
    }
  };

  const handleDarkModeToggle = async () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    await saveSettings({ biometricEnabled, notificationsEnabled, darkMode: newDarkMode });
  };

  const handleSyncOffline = async () => {
    const isConnected = await checkNetworkConnectivity();
    if (!isConnected) {
      Alert.alert('No Internet', 'Please connect to the internet to sync offline data');
      return;
    }

    Alert.alert(
      'Sync Offline Data',
      'Sync all offline proofs and data with the server?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sync',
          onPress: () => {
            console.log('Starting offline sync...');
          },
        },
      ]
    );
  };

  const menuItems = [
    {
      id: 'security',
      title: 'Security',
      icon: 'security',
      color: '#6366f1',
      onPress: () => console.log('Navigate to security settings'),
    },
    {
      id: 'privacy',
      title: 'Privacy',
      icon: 'lock',
      color: '#10b981',
      onPress: () => console.log('Navigate to privacy settings'),
    },
    {
      id: 'backup',
      title: 'Backup & Restore',
      icon: 'backup',
      color: '#f59e0b',
      onPress: () => console.log('Navigate to backup settings'),
    },
    {
      id: 'help',
      title: 'Help & Support',
      icon: 'help',
      color: '#8b5cf6',
      onPress: () => console.log('Navigate to help'),
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.profileInfo}>
          <View style={styles.avatar}>
            <Icon name="person" size={40} color="#6366f1" />
          </View>
          <View style={styles.profileDetails}>
            <Text style={styles.userName}>John Doe</Text>
            <Text style={styles.userEmail}>john.doe@example.com</Text>
            <Text style={styles.memberSince}>Member since March 2024</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Settings</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Icon name="fingerprint" size={24} color="#6366f1" />
            <View style={styles.settingText}>
              <Text style={styles.settingTitle}>Biometric Authentication</Text>
              <Text style={styles.settingDescription}>Use fingerprint or face recognition</Text>
            </View>
          </View>
          <Switch
            value={biometricEnabled}
            onValueChange={handleBiometricToggle}
            trackColor={{ false: '#e5e7eb', true: '#c7d2fe' }}
            thumbColor={biometricEnabled ? '#6366f1' : '#f3f4f6'}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Icon name="notifications" size={24} color="#6366f1" />
            <View style={styles.settingText}>
              <Text style={styles.settingTitle}>Push Notifications</Text>
              <Text style={styles.settingDescription}>Receive proof updates and alerts</Text>
            </View>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleNotificationToggle}
            trackColor={{ false: '#e5e7eb', true: '#c7d2fe' }}
            thumbColor={notificationsEnabled ? '#6366f1' : '#f3f4f6'}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Icon name="dark-mode" size={24} color="#6366f1" />
            <View style={styles.settingText}>
              <Text style={styles.settingTitle}>Dark Mode</Text>
              <Text style={styles.settingDescription}>Reduce eye strain in low light</Text>
            </View>
          </View>
          <Switch
            value={darkMode}
            onValueChange={handleDarkModeToggle}
            trackColor={{ false: '#e5e7eb', true: '#c7d2fe' }}
            thumbColor={darkMode ? '#6366f1' : '#f3f4f6'}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Management</Text>
        
        <TouchableOpacity style={styles.actionItem} onPress={handleSyncOffline}>
          <Icon name="sync" size={24} color="#10b981" />
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Sync Offline Data</Text>
            <Text style={styles.actionDescription}>Sync local proofs with server</Text>
          </View>
          <Icon name="chevron-right" size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>More</Text>
        
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.menuItem}
            onPress={item.onPress}
          >
            <View style={[styles.menuIcon, { backgroundColor: `${item.color}20` }]}>
              <Icon name={item.icon} size={24} color={item.color} />
            </View>
            <Text style={styles.menuTitle}>{item.title}</Text>
            <Icon name="chevron-right" size={20} color="#9ca3af" />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.signOutButton}>
          <Icon name="logout" size={24} color="#ef4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 4,
  },
  memberSince: {
    fontSize: 14,
    color: '#9ca3af',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  actionText: {
    flex: 1,
    marginLeft: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    marginLeft: 8,
  },
});

export default ProfileScreen;
