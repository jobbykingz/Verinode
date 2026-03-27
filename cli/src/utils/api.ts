import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { configManager } from './config';

export class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: configManager.getApiUrl(),
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add auth header if apiKey exists
    const apiKey = configManager.getApiKey();
    if (apiKey) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${apiKey}`;
    }
  }

  async get<T>(url: string, params?: any): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.get(url, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async post<T>(url: string, data?: any): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.post(url, data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async put<T>(url: string, data?: any): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.put(url, data);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async delete<T>(url: string): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.client.delete(url);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private handleError(error: any): Error {
    if (error.response) {
      // Server responded with error status
      const message = error.response.data?.message || `HTTP ${error.response.status}: ${error.response.statusText}`;
      return new Error(message);
    } else if (error.request) {
      // Request was made but no response received
      return new Error('Network error: Unable to connect to the server');
    } else {
      // Something else happened
      return new Error(error.message || 'An unexpected error occurred');
    }
  }

  setAuthToken(token: string): void {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    configManager.setApiKey(token);
  }

  clearAuthToken(): void {
    delete this.client.defaults.headers.common['Authorization'];
    configManager.setApiKey('');
  }
}

export const apiClient = new ApiClient();