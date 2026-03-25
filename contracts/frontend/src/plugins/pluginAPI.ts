export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  permissions: PluginPermission[];
  dependencies?: string[];
  entryPoint: string;
  verinodeVersion?: string;
}

export interface PluginPermission {
  type: 'network' | 'storage' | 'filesystem' | 'stellar' | 'ui' | 'events';
  scope: string[];
  description: string;
}

export interface PluginContext {
  id: string;
  metadata: PluginMetadata;
  storage: PluginStorage;
  events: PluginEventEmitter;
  permissions: PluginPermission[];
  api: PluginAPI;
}

export interface PluginStorage {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface PluginEventEmitter {
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
  emit(event: string, data?: any): void;
}

export interface PluginAPI {
  stellar: {
    connect(): Promise<string>;
    getAccount(publicKey: string): Promise<any>;
    signTransaction(transaction: any): Promise<any>;
    submitTransaction(transaction: any): Promise<any>;
  };
  ui: {
    showNotification(message: string, type: 'success' | 'error' | 'info'): void;
    showModal(component: React.ComponentType<any>, props?: any): void;
    addMenuItem(item: MenuItem): void;
    removeMenuItem(itemId: string): void;
  };
  network: {
    request(url: string, options?: RequestInit): Promise<Response>;
    get(url: string): Promise<Response>;
    post(url: string, data: any): Promise<Response>;
  };
  storage: PluginStorage;
  events: PluginEventEmitter;
}

export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
  path?: string;
  action?: () => void;
  order?: number;
}

export interface Plugin {
  metadata: PluginMetadata;
  initialize(context: PluginContext): Promise<void>;
  activate?(): Promise<void>;
  deactivate?(): Promise<void>;
  destroy?(): Promise<void>;
}

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  permissions: PluginPermission[];
  dependencies?: string[];
  verinodeVersion?: string;
}

export class PluginError extends Error {
  constructor(
    message: string,
    public code: string,
    public pluginId?: string
  ) {
    super(message);
    this.name = 'PluginError';
  }
}
