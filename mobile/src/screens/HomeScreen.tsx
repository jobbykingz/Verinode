import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

const HomeScreen: React.FC = () => {
  const navigation = useNavigation();

  const quickActions = [
    {
      id: 'scan',
      title: 'Scan Document',
      description: 'Create a new proof by scanning',
      icon: 'camera-alt',
      color: '#6366f1',
      onPress: () => navigation.navigate('Camera'),
    },
    {
      id: 'proofs',
      title: 'My Proofs',
      description: 'View and manage your proofs',
      icon: 'verified',
      color: '#10b981',
      onPress: () => navigation.navigate('Proofs'),
    },
    {
      id: 'verify',
      title: 'Verify Proof',
      description: 'Verify a proof hash',
      icon: 'security',
      color: '#f59e0b',
      onPress: () => console.log('Navigate to verification'),
    },
  ];

  const recentActivity = [
    { id: '1', title: 'Passport Document', time: '2 hours ago', status: 'verified' },
    { id: '2', title: 'ID Card', time: '1 day ago', status: 'pending' },
    { id: '3', title: 'Certificate', time: '3 days ago', status: 'verified' },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.welcomeText}>Welcome to Verinode</Text>
        <Text style={styles.subtitleText}>
          Manage your cryptographic proofs securely
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={[styles.actionCard, { borderLeftColor: action.color }]}
              onPress={action.onPress}
            >
              <Icon name={action.icon} size={32} color={action.color} />
              <Text style={styles.actionTitle}>{action.title}</Text>
              <Text style={styles.actionDescription}>{action.description}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Proofs')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        
        {recentActivity.map((item) => (
          <View key={item.id} style={styles.activityItem}>
            <View style={styles.activityIcon}>
              <Icon 
                name="verified" 
                size={20} 
                color={item.status === 'verified' ? '#10b981' : '#f59e0b'} 
              />
            </View>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>{item.title}</Text>
              <Text style={styles.activityTime}>{item.time}</Text>
            </View>
            <Icon name="chevron-right" size={20} color="#9ca3af" />
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security Features</Text>
        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <Icon name="fingerprint" size={24} color="#6366f1" />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Biometric Protection</Text>
              <Text style={styles.featureDescription}>
                Secure access with fingerprint or face recognition
              </Text>
            </View>
          </View>
          
          <View style={styles.featureItem}>
            <Icon name="lock" size={24} color="#6366f1" />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>End-to-End Encryption</Text>
              <Text style={styles.featureDescription}>
                Your data is encrypted and protected
              </Text>
            </View>
          </View>
          
          <View style={styles.featureItem}>
            <Icon name="offline-bolt" size={24} color="#6366f1" />
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Offline Mode</Text>
              <Text style={styles.featureDescription}>
                Access your proofs even without internet
              </Text>
            </View>
          </View>
        </View>
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
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 22,
  },
  section: {
    padding: 20,
    backgroundColor: '#fff',
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  seeAllText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '500',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 12,
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  featuresList: {
    marginTop: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  featureContent: {
    flex: 1,
    marginLeft: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});

export default HomeScreen;
