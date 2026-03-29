import { PluginMetadata, PluginStorage, PluginEventEmitter } from './pluginAPI';

export class SecuritySandbox {
  private pluginEnvironments = new Map<string, any>();
  private pluginStorages = new Map<string, PluginStorage>();
  private pluginEventEmitters = new Map<string, PluginEventEmitter>();
  private allowedDomains = new Set<string>([
    'https://api.stellar.org',
    'https://horizon.stellar.org',
    'https://soroban.stellar.org'
  ]);

  async initializePlugin(pluginId: string, pluginData: any): Promise<void> {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.sandbox.add('allow-scripts', 'allow-same-origin');
    
    document.body.appendChild(iframe);
    
    const environment = {
      iframe,
      pluginId,
      allowedAPIs: this.getAllowedAPIs(pluginData.metadata.permissions)
    };
    
    this.pluginEnvironments.set(pluginId, environment);
  }

  async cleanupPlugin(pluginId: string): Promise<void> {
    const environment = this.pluginEnvironments.get(pluginId);
    if (environment) {
      environment.iframe.remove();
      this.pluginEnvironments.delete(pluginId);
    }
    
    this.pluginStorages.delete(pluginId);
    this.pluginEventEmitters.delete(pluginId);
  }

  async executePlugin(pluginData: any): Promise<any> {
    const pluginId = pluginData.metadata.id;
    const environment = this.pluginEnvironments.get(pluginId);
    
    if (!environment) {
      throw new Error(`Plugin environment not found for ${pluginId}`);
    }

    const pluginCode = this.wrapPluginCode(pluginData.code, environment.allowedAPIs);
    
    return new Promise((resolve, reject) => {
      const messageHandler = (event: MessageEvent) => {
        if (event.source === environment.iframe.contentWindow) {
          if (event.data.type === 'plugin-result') {
            window.removeEventListener('message', messageHandler);
            resolve(event.data.result);
          } else if (event.data.type === 'plugin-error') {
            window.removeEventListener('message', messageHandler);
            reject(new Error(event.data.error));
          }
        }
      };

      window.addEventListener('message', messageHandler);
      
      environment.iframe.contentWindow?.postMessage({
        type: 'execute-plugin',
        code: pluginCode
      }, '*');
    });
  }

  async executeWithPermission(pluginId: string, apiType: string, method: string, args: any[]): Promise<any> {
    const environment = this.pluginEnvironments.get(pluginId);
    
    if (!environment) {
      throw new Error(`Plugin environment not found for ${pluginId}`);
    }

    if (!environment.allowedAPIs[apiType]?.includes(method)) {
      throw new Error(`Plugin ${pluginId} does not have permission to access ${apiType}.${method}`);
    }

    switch (apiType) {
      case 'stellar':
        return this.executeStellarAPI(method, args);
      case 'ui':
        return this.executeUIAPI(method, args);
      case 'network':
        return this.executeNetworkAPI(method, args);
      default:
        throw new Error(`Unknown API type: ${apiType}`);
    }
  }

  async createStorage(pluginId: string): Promise<PluginStorage> {
    if (this.pluginStorages.has(pluginId)) {
      return this.pluginStorages.get(pluginId)!;
    }

    const storage: PluginStorage = {
      get: async (key: string) => {
        const fullKey = `plugin_${pluginId}_${key}`;
        const value = localStorage.getItem(fullKey);
        return value ? JSON.parse(value) : null;
      },
      set: async (key: string, value: any) => {
        const fullKey = `plugin_${pluginId}_${key}`;
        localStorage.setItem(fullKey, JSON.stringify(value));
      },
      delete: async (key: string) => {
        const fullKey = `plugin_${pluginId}_${key}`;
        localStorage.removeItem(fullKey);
      },
      clear: async () => {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith(`plugin_${pluginId}_`)) {
            localStorage.removeItem(key);
          }
        });
      }
    };

    this.pluginStorages.set(pluginId, storage);
    return storage;
  }

  async createEventEmitter(pluginId: string): Promise<PluginEventEmitter> {
    if (this.pluginEventEmitters.has(pluginId)) {
      return this.pluginEventEmitters.get(pluginId)!;
    }

    const listeners = new Map<string, Set<Function>>();

    const eventEmitter: PluginEventEmitter = {
      on: (event: string, handler: Function) => {
        if (!listeners.has(event)) {
          listeners.set(event, new Set());
        }
        listeners.get(event)!.add(handler);
      },
      off: (event: string, handler: Function) => {
        const eventListeners = listeners.get(event);
        if (eventListeners) {
          eventListeners.delete(handler);
        }
      },
      emit: (event: string, data?: any) => {
        const eventListeners = listeners.get(event);
        if (eventListeners) {
          eventListeners.forEach(handler => {
            try {
              handler(data);
            } catch (error) {
              console.error(`Error in plugin event handler for ${event}:`, error);
            }
          });
        }
      }
    };

    this.pluginEventEmitters.set(pluginId, eventEmitter);
    return eventEmitter;
  }

  private wrapPluginCode(code: string, allowedAPIs: any): string {
    return `
      (function() {
        const allowedAPIs = ${JSON.stringify(allowedAPIs)};
        
        const stellarAPI = {
          connect: () => parent.postMessage({ type: 'stellar-api', method: 'connect', args: [] }, '*'),
          getAccount: (pubKey) => parent.postMessage({ type: 'stellar-api', method: 'getAccount', args: [pubKey] }, '*'),
          signTransaction: (tx) => parent.postMessage({ type: 'stellar-api', method: 'signTransaction', args: [tx] }, '*'),
          submitTransaction: (tx) => parent.postMessage({ type: 'stellar-api', method: 'submitTransaction', args: [tx] }, '*')
        };
        
        const uiAPI = {
          showNotification: (msg, type) => parent.postMessage({ type: 'ui-api', method: 'showNotification', args: [msg, type] }, '*'),
          showModal: (component, props) => parent.postMessage({ type: 'ui-api', method: 'showModal', args: [component, props] }, '*'),
          addMenuItem: (item) => parent.postMessage({ type: 'ui-api', method: 'addMenuItem', args: [item] }, '*'),
          removeMenuItem: (itemId) => parent.postMessage({ type: 'ui-api', method: 'removeMenuItem', args: [itemId] }, '*')
        };
        
        const networkAPI = {
          request: (url, options) => parent.postMessage({ type: 'network-api', method: 'request', args: [url, options] }, '*'),
          get: (url) => parent.postMessage({ type: 'network-api', method: 'get', args: [url] }, '*'),
          post: (url, data) => parent.postMessage({ type: 'network-api', method: 'post', args: [url, data] }, '*')
        };
        
        try {
          ${code}
          parent.postMessage({ type: 'plugin-result', result: typeof module !== 'undefined' ? module.exports : null }, '*');
        } catch (error) {
          parent.postMessage({ type: 'plugin-error', error: error.message }, '*');
        }
      })();
    `;
  }

  private getAllowedAPIs(permissions: any[]): any {
    const allowedAPIs: any = {
      stellar: [],
      ui: [],
      network: []
    };

    permissions.forEach(permission => {
      switch (permission.type) {
        case 'stellar':
          allowedAPIs.stellar.push(...permission.scope);
          break;
        case 'ui':
          allowedAPIs.ui.push(...permission.scope);
          break;
        case 'network':
          allowedAPIs.network.push(...permission.scope);
          break;
      }
    });

    return allowedAPIs;
  }

  private async executeStellarAPI(method: string, args: any[]): Promise<any> {
    switch (method) {
      case 'connect':
        return this.connectStellar();
      case 'getAccount':
        return this.getStellarAccount(args[0]);
      case 'signTransaction':
        return this.signStellarTransaction(args[0]);
      case 'submitTransaction':
        return this.submitStellarTransaction(args[0]);
      default:
        throw new Error(`Unknown Stellar API method: ${method}`);
    }
  }

  private async executeUIAPI(method: string, args: any[]): Promise<any> {
    switch (method) {
      case 'showNotification':
        return this.showNotification(args[0], args[1]);
      case 'showModal':
        return this.showModal(args[0], args[1]);
      case 'addMenuItem':
        return this.addMenuItem(args[0]);
      case 'removeMenuItem':
        return this.removeMenuItem(args[0]);
      default:
        throw new Error(`Unknown UI API method: ${method}`);
    }
  }

  private async executeNetworkAPI(method: string, args: any[]): Promise<any> {
    switch (method) {
      case 'request':
        return this.networkRequest(args[0], args[1]);
      case 'get':
        return this.networkGet(args[0]);
      case 'post':
        return this.networkPost(args[0], args[1]);
      default:
        throw new Error(`Unknown Network API method: ${method}`);
    }
  }

  private async connectStellar(): Promise<string> {
    return 'connected-stellar-public-key';
  }

  private async getStellarAccount(publicKey: string): Promise<any> {
    return { publicKey, balance: '1000', sequence: 1 };
  }

  private async signStellarTransaction(transaction: any): Promise<any> {
    return { ...transaction, signature: 'signed-transaction' };
  }

  private async submitStellarTransaction(transaction: any): Promise<any> {
    return { hash: 'transaction-hash', successful: true };
  }

  private async showNotification(message: string, type: 'success' | 'error' | 'info'): Promise<void> {
    console.log(`Plugin notification [${type}]: ${message}`);
  }

  private async showModal(component: any, props?: any): Promise<void> {
    console.log('Plugin modal shown:', component, props);
  }

  private async addMenuItem(item: any): Promise<void> {
    console.log('Plugin menu item added:', item);
  }

  private async removeMenuItem(itemId: string): Promise<void> {
    console.log('Plugin menu item removed:', itemId);
  }

  private async networkRequest(url: string, options?: RequestInit): Promise<Response> {
    if (!this.isAllowedDomain(url)) {
      throw new Error(`Domain not allowed: ${url}`);
    }
    return fetch(url, options);
  }

  private async networkGet(url: string): Promise<Response> {
    if (!this.isAllowedDomain(url)) {
      throw new Error(`Domain not allowed: ${url}`);
    }
    return fetch(url);
  }

  private async networkPost(url: string, data: any): Promise<Response> {
    if (!this.isAllowedDomain(url)) {
      throw new Error(`Domain not allowed: ${url}`);
    }
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
  }

  private isAllowedDomain(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return this.allowedDomains.has(urlObj.origin);
    } catch {
      return false;
    }
  }
}
