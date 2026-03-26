export interface Proof {
  id: string;
  title: string;
  description: string;
  hash: string;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
  image?: string;
  metadata?: Record<string, any>;
}

export interface CreateProofRequest {
  title: string;
  description: string;
  image: string;
  metadata?: Record<string, any>;
}

export interface VerifyProofResponse {
  verified: boolean;
  message?: string;
  timestamp: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  stellarPublicKey?: string;
  createdAt: string;
  verified: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: string;
}

export interface AppSettings {
  biometricEnabled: boolean;
  notificationsEnabled: boolean;
  darkMode: boolean;
  autoSync: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface NavigationParams {
  ProofViewer: { proofId: string };
  Camera: undefined;
  Settings: undefined;
  Profile: undefined;
  Main: undefined;
}

export type RootStackParamList = {
  Main: undefined;
  ProofViewer: { proofId: string };
  Camera: undefined;
  Settings: undefined;
  Profile: undefined;
};

export type TabParamList = {
  Home: undefined;
  Proofs: undefined;
  Camera: undefined;
  Profile: undefined;
};

export type ProofManagerNavigationProp = any;
export type ProofViewerNavigationProp = any;
export type CameraScannerNavigationProp = any;

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
