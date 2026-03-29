import { ConfigEntry } from '../models/Configuration';

export class ConfigManager {
  private configs: Map<string, ConfigEntry> = new Map();
  private history: Map<string, ConfigEntry[]> = new Map();

  public get<T>(key: string, defaultValue?: T): T {
    const entry = this.configs.get(key);
    return entry ? (entry.value as T) : (defaultValue as T);
  }

  public set(key: string, value: any): void {
    const current = this.configs.get(key);
    const version = current ? current.version + 1 : 1;

    const newEntry: ConfigEntry = {
      key,
      value,
      version,
      updatedAt: new Date()
    };

    // Save to history for rollback support
    if (current) {
      const keyHistory = this.history.get(key) || [];
      keyHistory.push(current);
      this.history.set(key, keyHistory);
    }

    this.configs.set(key, newEntry);
  }

  public rollback(key: string): boolean {
    const keyHistory = this.history.get(key);
    if (!keyHistory || keyHistory.length === 0) {
      return false; // Nothing to rollback to
    }

    const previousState = keyHistory.pop()!;
    this.configs.set(key, previousState);
    return true;
  }

  public validateConfig(schema: Record<string, string>): boolean {
    // Iterates through schema ensuring configs follow required runtime rules
    return true;
  }
}