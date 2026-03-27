import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ProofService } from '../services/ProofService';
import { Proof } from '../types';

interface ProofManagerProps {
  navigation: any;
}

const ProofManager: React.FC<ProofManagerProps> = ({ navigation }) => {
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadProofs();
  }, []);

  const loadProofs = async () => {
    try {
      setLoading(true);
      const proofData = await ProofService.getProofs();
      setProofs(proofData);
    } catch (error) {
      Alert.alert('Error', 'Failed to load proofs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProofs();
  };

  const handleProofPress = (proof: Proof) => {
    navigation.navigate('ProofViewer', { proofId: proof.id });
  };

  const handleCreateProof = () => {
    navigation.navigate('Camera');
  };

  const renderProofItem = ({ item }: { item: Proof }) => (
    <TouchableOpacity
      style={styles.proofItem}
      onPress={() => handleProofPress(item)}
    >
      <View style={styles.proofHeader}>
        <Text style={styles.proofTitle}>{item.title}</Text>
        <View style={[
          styles.statusBadge,
          { backgroundColor: item.verified ? '#10b981' : '#f59e0b' }
        ]}>
          <Text style={styles.statusText}>
            {item.verified ? 'Verified' : 'Pending'}
          </Text>
        </View>
      </View>
      <Text style={styles.proofDescription}>{item.description}</Text>
      <View style={styles.proofFooter}>
        <Text style={styles.proofDate}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
        <Icon name="chevron-right" size={20} color="#9ca3af" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Proofs</Text>
        <TouchableOpacity style={styles.createButton} onPress={handleCreateProof}>
          <Icon name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={proofs}
        renderItem={renderProofItem}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      {proofs.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <Icon name="verified" size={64} color="#9ca3af" />
          <Text style={styles.emptyText}>No proofs yet</Text>
          <Text style={styles.emptySubtext}>
            Create your first proof by scanning a document
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  createButton: {
    backgroundColor: '#6366f1',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  listContainer: {
    padding: 16,
  },
  proofItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  proofHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  proofTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  proofDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  proofFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  proofDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});

export default ProofManager;
