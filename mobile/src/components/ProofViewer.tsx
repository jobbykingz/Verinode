import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ProofService } from '../services/ProofService';
import { Proof } from '../types';

interface ProofViewerProps {
  route: any;
  navigation: any;
}

const ProofViewer: React.FC<ProofViewerProps> = ({ route, navigation }) => {
  const [proof, setProof] = useState<Proof | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const { proofId } = route.params;
    loadProof(proofId);
  }, [route.params]);

  const loadProof = async (proofId: string) => {
    try {
      setLoading(true);
      const proofData = await ProofService.getProofById(proofId);
      setProof(proofData);
    } catch (error) {
      Alert.alert('Error', 'Failed to load proof details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!proof) return;
    
    try {
      setVerifying(true);
      const result = await ProofService.verifyProof(proof.id);
      
      if (result.verified) {
        Alert.alert('Success', 'Proof verified successfully');
        setProof({ ...proof, verified: true });
      } else {
        Alert.alert('Verification Failed', result.message || 'Unable to verify proof');
      }
    } catch (error) {
      Alert.alert('Error', 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleShare = async () => {
    if (!proof) return;
    
    try {
      await Share.share({
        message: `Check out this proof: ${proof.title}\n${proof.description}\nVerification: ${proof.verified ? 'Verified' : 'Pending'}`,
        title: 'Share Proof',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share proof');
    }
  };

  const handleDelete = () => {
    if (!proof) return;
    
    Alert.alert(
      'Delete Proof',
      'Are you sure you want to delete this proof? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await ProofService.deleteProof(proof.id);
              Alert.alert('Success', 'Proof deleted successfully');
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete proof');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!proof) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error" size={64} color="#ef4444" />
        <Text style={styles.errorText}>Proof not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>{proof.title}</Text>
        <View style={[
          styles.statusBadge,
          { backgroundColor: proof.verified ? '#10b981' : '#f59e0b' }
        ]}>
          <Text style={styles.statusText}>
            {proof.verified ? 'Verified' : 'Pending'}
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.sectionContent}>{proof.description}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Created</Text>
          <Text style={styles.sectionContent}>
            {new Date(proof.createdAt).toLocaleString()}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Proof Hash</Text>
          <Text style={styles.hashText}>{proof.hash}</Text>
        </View>

        {proof.metadata && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Metadata</Text>
            {Object.entries(proof.metadata).map(([key, value]) => (
              <View key={key} style={styles.metadataRow}>
                <Text style={styles.metadataKey}>{key}:</Text>
                <Text style={styles.metadataValue}>{String(value)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.actions}>
          {!proof.verified && (
            <TouchableOpacity
              style={[styles.button, styles.verifyButton]}
              onPress={handleVerify}
              disabled={verifying}
            >
              {verifying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="verified" size={20} color="#fff" />
                  <Text style={styles.buttonText}>Verify Proof</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, styles.shareButton]}
            onPress={handleShare}
          >
            <Icon name="share" size={20} color="#fff" />
            <Text style={styles.buttonText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.deleteButton]}
            onPress={handleDelete}
          >
            <Icon name="delete" size={20} color="#fff" />
            <Text style={styles.buttonText}>Delete</Text>
          </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ef4444',
    marginTop: 16,
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    padding: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  hashText: {
    fontSize: 12,
    color: '#6b7280',
    fontFamily: 'monospace',
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 6,
  },
  metadataRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  metadataKey: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginRight: 8,
  },
  metadataValue: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  actions: {
    marginTop: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
  },
  verifyButton: {
    backgroundColor: '#10b981',
  },
  shareButton: {
    backgroundColor: '#6366f1',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default ProofViewer;
