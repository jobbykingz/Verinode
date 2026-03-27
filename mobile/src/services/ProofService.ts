import axios, { AxiosInstance, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-netinfo/netinfo';
import { Proof, CreateProofRequest, VerifyProofResponse, ApiResponse } from '../types';

class ProofService {
  private api: AxiosInstance;
  private readonly BASE_URL = __DEV__ 
    ? 'http://localhost:3001/api' 
    : 'https://api.verinode.io/api';

  constructor() {
    this.api = axios.create({
      baseURL: this.BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.api.interceptors.request.use(async (config) => {
      const token = await AsyncStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        throw new Error('No internet connection');
      }

      return config;
    });

    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          await AsyncStorage.removeItem('authToken');
        }
        return Promise.reject(error);
      }
    );
  }

  async getProofs(): Promise<Proof[]> {
    try {
      const response: AxiosResponse<ApiResponse<Proof[]>> = await this.api.get('/proofs');
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      throw new Error(response.data.error || 'Failed to fetch proofs');
    } catch (error) {
      console.error('Error fetching proofs:', error);
      return this.getOfflineProofs();
    }
  }

  async getProofById(id: string): Promise<Proof> {
    try {
      const response: AxiosResponse<ApiResponse<Proof>> = await this.api.get(`/proofs/${id}`);
      
      if (response.data.success && response.data.data) {
        await this.cacheProof(response.data.data);
        return response.data.data;
      }
      
      throw new Error(response.data.error || 'Proof not found');
    } catch (error) {
      console.error('Error fetching proof:', error);
      return this.getOfflineProof(id);
    }
  }

  async createProof(request: CreateProofRequest): Promise<Proof> {
    try {
      const response: AxiosResponse<ApiResponse<Proof>> = await this.api.post('/proofs', request);
      
      if (response.data.success && response.data.data) {
        await this.cacheProof(response.data.data);
        return response.data.data;
      }
      
      throw new Error(response.data.error || 'Failed to create proof');
    } catch (error) {
      console.error('Error creating proof:', error);
      const offlineProof = await this.createOfflineProof(request);
      this.scheduleSync();
      return offlineProof;
    }
  }

  async verifyProof(id: string): Promise<VerifyProofResponse> {
    try {
      const response: AxiosResponse<ApiResponse<VerifyProofResponse>> = await this.api.post(`/proofs/${id}/verify`);
      
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      
      throw new Error(response.data.error || 'Verification failed');
    } catch (error) {
      console.error('Error verifying proof:', error);
      return {
        verified: false,
        message: 'Offline: Cannot verify proof without internet connection',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async deleteProof(id: string): Promise<void> {
    try {
      await this.api.delete(`/proofs/${id}`);
      await this.removeCachedProof(id);
    } catch (error) {
      console.error('Error deleting proof:', error);
      await this.removeCachedProof(id);
      this.scheduleSync();
    }
  }

  async syncOfflineProofs(): Promise<void> {
    try {
      const offlineProofs = await this.getOfflineProofs();
      const netInfo = await NetInfo.fetch();
      
      if (!netInfo.isConnected) {
        return;
      }

      for (const proof of offlineProofs) {
        if (proof.id.startsWith('offline_')) {
          try {
            const response: AxiosResponse<ApiResponse<Proof>> = await this.api.post('/proofs', {
              title: proof.title,
              description: proof.description,
              image: proof.image,
              metadata: proof.metadata,
            });
            
            if (response.data.success && response.data.data) {
              await this.removeCachedProof(proof.id);
              await this.cacheProof(response.data.data);
            }
          } catch (error) {
            console.error('Error syncing proof:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error during sync:', error);
    }
  }

  private async cacheProof(proof: Proof): Promise<void> {
    try {
      const cachedProofs = await this.getOfflineProofs();
      const index = cachedProofs.findIndex(p => p.id === proof.id);
      
      if (index >= 0) {
        cachedProofs[index] = proof;
      } else {
        cachedProofs.push(proof);
      }
      
      await AsyncStorage.setItem('cached_proofs', JSON.stringify(cachedProofs));
    } catch (error) {
      console.error('Error caching proof:', error);
    }
  }

  private async getOfflineProofs(): Promise<Proof[]> {
    try {
      const cached = await AsyncStorage.getItem('cached_proofs');
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      console.error('Error getting offline proofs:', error);
      return [];
    }
  }

  private async getOfflineProof(id: string): Promise<Proof> {
    const proofs = await this.getOfflineProofs();
    const proof = proofs.find(p => p.id === id);
    
    if (!proof) {
      throw new Error('Proof not found offline');
    }
    
    return proof;
  }

  private async createOfflineProof(request: CreateProofRequest): Promise<Proof> {
    const proof: Proof = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: request.title,
      description: request.description,
      hash: this.generateHash(request),
      verified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      image: request.image,
      metadata: {
        ...request.metadata,
        offline: true,
      },
    };

    await this.cacheProof(proof);
    return proof;
  }

  private async removeCachedProof(id: string): Promise<void> {
    try {
      const cachedProofs = await this.getOfflineProofs();
      const filteredProofs = cachedProofs.filter(p => p.id !== id);
      await AsyncStorage.setItem('cached_proofs', JSON.stringify(filteredProofs));
    } catch (error) {
      console.error('Error removing cached proof:', error);
    }
  }

  private generateHash(request: CreateProofRequest): string {
    const data = `${request.title}${request.description}${Date.now()}`;
    return btoa(data).substring(0, 32);
  }

  private scheduleSync(): void {
    setTimeout(() => {
      this.syncOfflineProofs();
    }, 5000);
  }
}

export default new ProofService();
