import * as fs from 'fs-extra';
import * as path from 'path';
import { homedir } from 'os';

export interface Config {
  apiUrl: string;
  apiKey?: string;
  environment: 'development' | 'staging' | 'production';
}

const CONFIG_DIR = path.join(homedir(), '.verinode');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export class ConfigManager {
  private config: Config;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): Config {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        return fs.readJsonSync(CONFIG_FILE);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }

    // Default config
    return {
      apiUrl: 'http://localhost:3000/api',
      environment: 'development'
    };
  }

  private saveConfig(): void {
    try {
      fs.ensureDirSync(CONFIG_DIR);
      fs.writeJsonSync(CONFIG_FILE, this.config, { spaces: 2 });
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  getConfig(): Config {
    return { ...this.config };
  }

  setConfig(newConfig: Partial<Config>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();
  }

  getApiUrl(): string {
    return this.config.apiUrl;
  }

  getApiKey(): string | undefined {
    return this.config.apiKey;
  }

  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    this.saveConfig();
  }
}

export const configManager = new ConfigManager();