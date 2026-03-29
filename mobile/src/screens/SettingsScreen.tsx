import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();

  const settingsCategories = [
    {
      id: 'account',
      title: 'Account',
      icon: 'account-circle',
      color: '#6366f1',
      items: [
        { id: 'profile', title: 'Edit Profile', icon: 'person' },
        { id: 'security', title: 'Security', icon: 'security' },
        { id: 'privacy', title: 'Privacy', icon: 'lock' },
      ],
    },
    {
      id: 'preferences',
      title: 'Preferences',
      icon: 'tune',
      color: '#10b981',
      items: [
        { id: 'notifications', title: 'Notifications', icon: 'notifications' },
        { id: 'appearance', title: 'Appearance', icon: 'palette' },
        { id: 'language', title: 'Language', icon: 'language' },
      ],
    },
    {
      id: 'data',
      title: 'Data & Storage',
      icon: 'storage',
      color: '#f59e0b',
      items: [
        { id: 'backup', title: 'Backup & Restore', icon: 'backup' },
        { id: 'sync', title: 'Sync Settings', icon: 'sync' },
        { id: 'cache', title: 'Clear Cache', icon: 'clear' },
      ],
    },
    {
      id: 'support',
      title: 'Support',
      icon: 'help',
      color: '#8b5cf6',
      items: [
        { id: 'help', title: 'Help Center', icon: 'help-center' },
        { id: 'contact', title: 'Contact Us', icon: 'contact-support' },
        { id: 'about', title: 'About', icon: 'info' },
      ],
    },
  ];

  const handleSettingPress = (category: string, item: string) => {
    console.log(`Navigate to ${category}/${item}`);
    // Navigation logic would go here
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            console.log('Signing out...');
            // Sign out logic would go here
          },
        },
      ]
    );
  };

  const renderSettingItem = (item: any, category: string) => (
    <TouchableOpacity
      key={item.id}
      style={styles.settingItem}
      onPress={() => handleSettingPress(category, item.id)}
    >
      <View style={styles.settingItemLeft}>
        <Icon name={item.icon} size={20} color="#6b7280" />
        <Text style={styles.settingItemText}>{item.title}</Text>
      </View>
      <Icon name="chevron-right" size={20} color="#9ca3af" />
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <Text style={styles.headerSubtitle}>
          Customize your Verinode experience
        </Text>
      </View>

      {settingsCategories.map((category) => (
        <View key={category.id} style={styles.category}>
          <View style={styles.categoryHeader}>
            <View style={[styles.categoryIcon, { backgroundColor: `${category.color}20` }]}>
              <Icon name={category.icon} size={24} color={category.color} />
            </View>
            <Text style={styles.categoryTitle}>{category.title}</Text>
          </View>
          
          <View style={styles.categoryItems}>
            {category.items.map((item) => renderSettingItem(item, category.id))}
          </View>
        </View>
      ))}

      <View style={styles.dangerSection}>
        <Text style={styles.dangerTitle}>Danger Zone</Text>
        
        <TouchableOpacity style={styles.dangerItem} onPress={handleSignOut}>
          <Icon name="logout" size={20} color="#ef4444" />
          <Text style={styles.dangerText}>Sign Out</Text>
          <Icon name="chevron-right" size={20} color="#9ca3af" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.dangerItem} 
          onPress={() => Alert.alert('Delete Account', 'This feature is not yet available')}
        >
          <Icon name="delete-forever" size={20} color="#ef4444" />
          <Text style={styles.dangerText}>Delete Account</Text>
          <Icon name="chevron-right" size={20} color="#9ca3af" />
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.versionText}>Verinode Mobile v1.0.0</Text>
        <Text style={styles.copyrightText}>© 2024 Verinode Team</Text>
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
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 22,
  },
  category: {
    backgroundColor: '#fff',
    marginTop: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  categoryItems: {
    backgroundColor: '#fff',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingItemText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
  },
  dangerSection: {
    backgroundColor: '#fff',
    marginTop: 24,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 20,
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#fef2f2',
  },
  dangerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#fef2f2',
  },
  dangerText: {
    fontSize: 16,
    color: '#ef4444',
    marginLeft: 12,
    flex: 1,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingBottom: 40,
  },
  versionText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  copyrightText: {
    fontSize: 12,
    color: '#9ca3af',
  },
});

export default SettingsScreen;
