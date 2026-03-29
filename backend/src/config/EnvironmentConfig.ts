import { EnvironmentType } from '../models/Configuration';

export class EnvironmentConfig {
  private currentEnv: EnvironmentType;
  private envVars: Record<string, string | undefined>;

  constructor() {
    this.currentEnv = (process.env.NODE_ENV as EnvironmentType) || EnvironmentType.DEVELOPMENT;
    this.envVars = process.env;
  }

  public getEnv(): EnvironmentType {
    return this.currentEnv;
  }

  public get(key: string, defaultValue?: string): string {
    const value = this.envVars[key];
    if (value === undefined && defaultValue === undefined) {
      throw new Error(`Environment variable ${key} is missing`);
    }
    return value || defaultValue!;
  }
}