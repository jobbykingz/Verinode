import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';

export function logSuccess(message: string): void {
  console.log(chalk.green('✓'), message);
}

export function logError(message: string): void {
  console.error(chalk.red('✗'), message);
}

export function logInfo(message: string): void {
  console.log(chalk.blue('ℹ'), message);
}

export function logWarning(message: string): void {
  console.log(chalk.yellow('⚠'), message);
}

export async function readJsonFile(filePath: string): Promise<any> {
  try {
    return await fs.readJson(filePath);
  } catch (error) {
    throw new Error(`Failed to read JSON file: ${filePath}`);
  }
}

export async function writeJsonFile(filePath: string, data: any): Promise<void> {
  try {
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeJson(filePath, data, { spaces: 2 });
  } catch (error) {
    throw new Error(`Failed to write JSON file: ${filePath}`);
  }
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}