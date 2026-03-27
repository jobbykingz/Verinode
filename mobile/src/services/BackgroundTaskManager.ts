import { Platform, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter, NativeModules } from 'react-native';
import { PushNotificationService } from '../services/mobile/PushNotificationService';
import { DeviceService } from '../services/DeviceService';

export interface BackgroundTask {
  id: string;
  name: string;
  type: 'sync' | 'analytics' | 'cleanup' | 'backup' | 'update' | 'notification' | 'location';
  priority: 'low' | 'medium' | 'high' | 'critical';
  interval?: number; // in milliseconds
  delay?: number; // delay before first execution
  maxRetries?: number;
  timeout?: number; // timeout for task execution
  requiresNetwork?: boolean;
  requiresCharging?: boolean;
  requiresDeviceIdle?: boolean;
  conditions?: {
    minimumBatteryLevel?: number;
    maximumMemoryUsage?: number;
    onlyOnWiFi?: boolean;
    timeWindows?: Array<{
      start: string; // HH:mm format
      end: string;   // HH:mm format
    }>;
  };
  callback: () => Promise<any>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  lastRun?: Date;
  nextRun?: Date;
  retryCount?: number;
  error?: string;
}

export interface TaskScheduler {
  tasks: Map<string, BackgroundTask>;
  isRunning: boolean;
  activeTasks: Set<string>;
  completedTasks: Set<string>;
  failedTasks: Set<string>;
  lastCleanup: Date;
}

export interface BackgroundSyncConfig {
  enableBackgroundSync: boolean;
  syncInterval: number;
  maxConcurrentTasks: number;
  taskTimeout: number;
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelay: number;
    maxDelay: number;
  };
  batteryOptimization: {
    enableBatteryOptimization: boolean;
    minimumBatteryLevel: number;
    pauseOnLowBattery: boolean;
    reduceFrequencyOnBatterySaver: boolean;
  };
  networkOptimization: {
    requireWiFiForLargeTransfers: boolean;
    pauseOnMeteredNetwork: boolean;
    compressData: boolean;
  };
  storageOptimization: {
    maxCacheSize: number;
    enableCompression: boolean;
    cleanupInterval: number;
  };
}

export interface BackgroundUpdate {
  id: string;
  version: string;
  type: 'critical' | 'recommended' | 'optional';
  title: string;
  description: string;
  downloadUrl?: string;
  size: number;
  checksum?: string;
  forceUpdate?: boolean;
  rollbackSafe?: boolean;
  requirements?: {
    minVersion: string;
    platform?: string;
    deviceCapabilities?: string[];
  };
  scheduledAt?: Date;
  completedAt?: Date;
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  error?: string;
}

export class BackgroundTaskManager {
  private config: BackgroundSyncConfig;
  private scheduler: TaskScheduler;
  private appState: AppStateStatus;
  private isHeadless: boolean;
  private deviceService: DeviceService;
  private pushNotificationService?: PushNotificationService;
  private backgroundTasks: Map<string, BackgroundTask>;
  private updateQueue: BackgroundUpdate[];
  private networkStatus: boolean;
  private batteryLevel: number;
  private isCharging: boolean;
  private isPowerSaveMode: boolean;
  private isMeteredNetwork: boolean;
  private isWiFiConnected: boolean;

  constructor(config: BackgroundSyncConfig, pushNotificationService?: PushNotificationService) {
    this.config = config;
    this.scheduler = {
      tasks: new Map(),
      isRunning: false,
      activeTasks: new Set(),
      completedTasks: new Set(),
      failedTasks: new Set(),
      lastCleanup: new Date(),
    };
    this.deviceService = DeviceService.getInstance();
    this.pushNotificationService = pushNotificationService;
    this.backgroundTasks = new Map();
    this.updateQueue = [];
    this.networkStatus = true;
    this.batteryLevel = 100;
    this.isCharging = false;
    this.isPowerSaveMode = false;
    this.isMeteredNetwork = false;
    this.isWiFiConnected = true;
    this.isHeadless = false;
    this.appState = AppState.currentState;

    this.initializeServices();
  }

  private async initializeServices(): Promise<void> {
    try {
      // Set up app state listeners
      AppState.addEventListener('change', this.handleAppStateChange);
      
      // Set up device event listeners
      DeviceEventEmitter.addListener('batteryLevelChanged', this.handleBatteryLevelChange);
      DeviceEventEmitter.addListener('powerSaveModeChanged', this.handlePowerSaveModeChange);
      
      // Set up network listeners
      NetInfo.addEventListener(this.handleNetworkChange);
      
      // Load background tasks
      await this.loadBackgroundTasks();
      
      // Load update queue
      await this.loadUpdateQueue();
      
      // Start task scheduler
      this.startScheduler();
      
      // Start background fetch
      if (this.config.enableBackgroundSync) {
        this.startBackgroundFetch();
      }
      
      console.log('Background Task Manager initialized');
    } catch (error) {
      console.error('Failed to initialize Background Task Manager', error);
      throw error;
    }
  }

  /**
   * Register a background task
   */
  registerTask(task: Omit<BackgroundTask, 'status' | 'lastRun' | 'nextRun' | 'retryCount' | 'error'>): void {
    const backgroundTask: BackgroundTask = {
      ...task,
      status: 'pending',
      nextRun: task.delay ? new Date(Date.now() + task.delay) : new Date(),
    };

    this.backgroundTasks.set(task.id, backgroundTask);
    this.scheduler.tasks.set(task.id, backgroundTask);
    
    console.log(`Background task registered: ${task.name} (${task.id})`);
  }

  /**
   * Unregister a background task
   */
  unregisterTask(taskId: string): boolean {
    const removed = this.backgroundTasks.delete(taskId);
    if (removed) {
      this.scheduler.tasks.delete(taskId);
      this.scheduler.activeTasks.delete(taskId);
      console.log(`Background task unregistered: ${taskId}`);
    }
    return removed;
  }

  /**
   * Execute a background task immediately
   */
  async executeTask(taskId: string): Promise<any> {
    const task = this.backgroundTasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (!this.canExecuteTask(task)) {
      throw new Error(`Task cannot be executed due to conditions: ${taskId}`);
    }

    return await this.executeTaskInternal(task);
  }

  /**
   * Schedule background update
   */
  scheduleUpdate(update: Omit<BackgroundUpdate, 'status' | 'progress' | 'completedAt' | 'error'>): void {
    const backgroundUpdate: BackgroundUpdate = {
      ...update,
      status: 'pending',
      progress: 0,
    };

    this.updateQueue.push(backgroundUpdate);
    this.saveUpdateQueue();
    
    console.log(`Background update scheduled: ${update.title} (${update.id})`);
  }

  /**
   * Get task scheduler status
   */
  getSchedulerStatus(): TaskScheduler {
    return {
      ...this.scheduler,
      tasks: new Map(this.scheduler.tasks),
    };
  }

  /**
   * Get background tasks
   */
  getBackgroundTasks(): BackgroundTask[] {
    return Array.from(this.backgroundTasks.values());
  }

  /**
   * Get update queue
   */
  getUpdateQueue(): BackgroundUpdate[] {
    return [...this.updateQueue];
  }

  /**
   * Get system status
   */
  getSystemStatus(): {
    return {
      appState: this.appState,
      isHeadless: this.isHeadless,
      networkStatus: this.networkStatus,
      batteryLevel: this.batteryLevel,
      isCharging: this.isCharging,
      isPowerSaveMode: this.isPowerSaveMode,
      isMeteredNetwork: this.isMeteredNetwork,
      isWiFiConnected: this.isWiFiConnected,
      activeTasks: Array.from(this.scheduler.activeTasks),
      completedTasks: Array.from(this.scheduler.completedTasks),
      failedTasks: Array.from(this.scheduler.failedTasks),
    };
  }

  /**
   * Force sync all pending tasks
   */
  async forceSync(): Promise<{ success: number; failed: number; errors: string[] }> {
    const pendingTasks = Array.from(this.backgroundTasks.values())
      .filter(task => task.status === 'pending');

    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const task of pendingTasks) {
      try {
        await this.executeTaskInternal(task);
        success++;
      } catch (error) {
        failed++;
        errors.push(`Task ${task.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { success, failed, errors };
  }

  /**
   * Cancel a background task
   */
  cancelTask(taskId: string): boolean {
    const task = this.backgroundTasks.get(taskId);
    if (!task) {
      return false;
    }

    task.status = 'cancelled';
    this.scheduler.activeTasks.delete(taskId);
    console.log(`Background task cancelled: ${task.name} (${taskId})`);
    
    return true;
  }

  /**
   * Cancel all background tasks
   */
  cancelAllTasks(): number {
    let cancelledCount = 0;
    
    for (const task of this.backgroundTasks.values()) {
      if (task.status === 'pending' || task.status === 'running') {
        task.status = 'cancelled';
        cancelledCount++;
      }
    }
    
    this.scheduler.activeTasks.clear();
    console.log(`All background tasks cancelled (${cancelledCount})`);
    
    return cancelledCount;
  }

  // Private methods

  private handleAppStateChange = (state: AppStateStatus) => {
    this.appState = state;
    
    if (state === 'active') {
      // App came to foreground, check if any tasks need to run
      this.checkPendingTasks();
    } else if (state === 'background') {
      // App went to background, optimize for background execution
      this.optimizeForBackground();
    }
  };

  private handleBatteryLevelChange = (level: number) => {
    this.batteryLevel = level;
    
    if (this.config.batteryOptimization.enableBatteryOptimization) {
      if (level < this.config.batteryOptimization.minimumBatteryLevel) {
        this.pauseNonCriticalTasks();
      } else {
        this.resumeTasks();
      }
    }
  };

  private handlePowerSaveModeChange = (enabled: boolean) => {
    this.isPowerSaveMode = enabled;
    
    if (this.config.batteryOptimization.reduceFrequencyOnBatterySaver) {
      if (enabled) {
        this.reduceTaskFrequency();
      } else {
        this.restoreTaskFrequency();
      }
    }
  };

  private handleNetworkChange = (state: any) => {
    const isConnected = state.isConnected;
    const type = state.type;
    
    this.networkStatus = isConnected;
    this.isMeteredNetwork = type === 'cellular' && state.details?.isConnectionExpensive;
    this.isWiFiConnected = type === 'wifi';
    
    // Handle network-dependent tasks
    this.handleNetworkDependentTasks();
  };

  private startScheduler(): void {
    if (this.scheduler.isRunning) return;
    
    this.scheduler.isRunning = true;
    
    // Run scheduler every minute
    const interval = setInterval(() => {
      this.processScheduledTasks();
    }, 60000);
    
    console.log('Background task scheduler started');
  }

  private async processScheduledTasks(): Promise<void> {
    if (!this.scheduler.isRunning) return;

    const now = new Date();
    const readyTasks: BackgroundTask[] = [];

    for (const task of this.scheduler.tasks.values()) {
      if (task.status === 'pending' && task.nextRun && task.nextRun <= now) {
        if (this.canExecuteTask(task)) {
          readyTasks.push(task);
        }
      }
    }

    // Execute ready tasks (respecting concurrency limit)
    const maxConcurrent = this.config.maxConcurrentTasks;
    const concurrentTasks = readyTasks.slice(0, maxConcurrent);
    
    for (const task of concurrentTasks) {
      try {
        await this.executeTaskInternal(task);
      } catch (error) {
        console.error(`Failed to execute task ${task.name}:`, error);
      }
    }

    // Schedule next runs
    for (const task of this.scheduler.tasks.values()) {
      if (task.status === 'pending' && task.interval) {
        const nextRun = new Date(task.nextRun!.getTime() + task.interval);
        task.nextRun = nextRun;
      }
    }
  }

  private async executeTaskInternal(task: BackgroundTask): Promise<any> {
    task.status = 'running';
    task.lastRun = new Date();
    this.scheduler.activeTasks.add(task.id);

    try {
      const timeout = task.timeout || this.config.taskTimeout;
      
      const result = await Promise.race([
        task.callback(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Task timeout')), timeout)
        )
      ]);

      task.status = 'completed';
      task.nextRun = task.interval ? 
        new Date(task.lastRun.getTime() + task.interval) : 
        undefined;
      
      this.scheduler.activeTasks.delete(task.id);
      this.scheduler.completedTasks.add(task.id);
      
      console.log(`Task completed: ${task.name} (${task.id})`);
      return result;
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      task.retryCount = (task.retryCount || 0) + 1;
      
      this.scheduler.activeTasks.delete(task.id);
      
      // Schedule retry if within limits
      if (task.retryCount <= (task.maxRetries || this.config.retryPolicy.maxRetries)) {
        const delay = Math.min(
          this.config.retryPolicy.initialDelay * 
          Math.pow(this.config.retryPolicy.backoffMultiplier, task.retryCount - 1),
          this.config.retryPolicy.maxDelay
        );
        
        task.nextRun = new Date(Date.now() + delay);
        task.status = 'pending';
      } else {
        this.scheduler.failedTasks.add(task.id);
      }
      
      console.error(`Task failed: ${task.name} (${task.id}) - ${task.error}`);
      throw error;
    }
  }

  private canExecuteTask(task: BackgroundTask): boolean {
    // Check app state
    if (this.appState !== 'background' && this.appState !== 'active') {
      return false;
    }

    // Check network requirement
    if (task.requiresNetwork && !this.networkStatus) {
      return false;
    }

    // Check charging requirement
    if (task.requiresCharging && !this.isCharging) {
      return false;
    }

    // Check device idle requirement
    if (task.requiresDeviceIdle && this.appState === 'active') {
      return false;
    }

    // Check battery level
    if (task.conditions?.minimumBatteryLevel) {
      if (this.batteryLevel < task.conditions.minimumBatteryLevel) {
        return false;
      }
    }

    // Check memory usage
    if (task.conditions?.maximumMemoryUsage) {
      // Would need to get actual memory usage
      // For now, assume it's acceptable
    }

    // Check WiFi requirement
    if (task.conditions?.onlyOnWiFi && !this.isWiFiConnected) {
      return false;
    }

    // Check time windows
    if (task.conditions?.timeWindows) {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      
      const inTimeWindow = task.conditions.timeWindows.some(window => {
        const [startHour, startMin] = window.start.split(':').map(Number);
        const [endHour, endMin] = window.end.split(':').map(Number);
        const startTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;
        
        return currentTime >= startTime && currentTime <= endTime;
      });
      
      if (!inTimeWindow) {
        return false;
      }
    }

    // Check battery optimization
    if (this.config.batteryOptimization.enableBatteryOptimization) {
      if (this.config.batteryOptimization.pauseOnLowBattery && 
          this.batteryLevel < this.config.batteryOptimization.minimumBatteryLevel) {
        return task.priority === 'critical';
      }
      
      if (this.isPowerSaveMode && task.priority !== 'critical') {
        return false;
      }
    }

    return true;
  }

  private async checkPendingTasks(): void {
    const pendingTasks = Array.from(this.backgroundTasks.values())
      .filter(task => task.status === 'pending');

    for (const task of pendingTasks) {
      if (this.canExecuteTask(task)) {
        try {
          await this.executeTaskInternal(task);
        } catch (error) {
          console.error(`Failed to execute pending task: ${task.name}`, error);
        }
      }
    }
  }

  private optimizeForBackground(): void {
    // Reduce task frequency when in background
    if (this.config.batteryOptimization.reduceFrequencyOnBatterySaver) {
      this.reduceTaskFrequency();
    }
    
    // Pause non-critical tasks
    this.pauseNonCriticalTasks();
  }

  private pauseNonCriticalTasks(): void {
    for (const task of this.backgroundTasks.values()) {
      if (task.status === 'pending' && task.priority !== 'critical') {
        task.status = 'pending'; // Keep as pending but don't execute
      }
    }
  }

  private resumeTasks(): void {
    // Tasks will be picked up by the next scheduler run
  }

  private reduceTaskFrequency(): void {
    for (const task of this.backgroundTasks.values()) {
      if (task.interval) {
        task.interval *= 2; // Double the interval
      }
    }
  }

  private restoreTaskFrequency(): void {
    for (const task of this.backgroundTasks.values()) {
      if (task.interval) {
        task.interval /= 2; // Restore original interval
      }
    }
  }

  private handleNetworkDependentTasks(): void {
    for (const task of this.backgroundTasks.values()) {
      if (task.requiresNetwork && task.status === 'pending') {
        if (!this.networkStatus) {
          task.status = 'pending'; // Keep pending
        } else if (this.config.networkOptimization.requireWiFiForLargeTransfers && 
                   !this.isWiFiConnected && 
                   task.priority !== 'critical') {
          task.status = 'pending'; // Keep pending
        }
      }
    }
  }

  private async startBackgroundFetch(): Promise<void> {
    // Register default background tasks
    this.registerTask({
      id: 'sync_data',
      name: 'Background Data Sync',
      type: 'sync',
      priority: 'high',
      interval: 5 * 60 * 1000, // 5 minutes
      requiresNetwork: true,
      callback: async () => {
        // Perform background data sync
        console.log('Performing background data sync');
        // This would integrate with your sync service
      },
    });

    this.registerTask({
      id: 'upload_analytics',
      name: 'Upload Analytics',
      type: 'analytics',
      priority: 'medium',
      interval: 30 * 60 * 1000, // 30 minutes
      requiresNetwork: true,
      callback: async () => {
        // Upload analytics data
        console.log('Uploading analytics data');
        // This would upload analytics to your server
      },
    });

    this.registerTask({
      id: 'cleanup_cache',
      name: 'Cache Cleanup',
      type: 'cleanup',
      priority: 'low',
      interval: 24 * 60 * 60 * 1000, // Daily
      callback: async () => {
        // Perform cache cleanup
        console.log('Performing cache cleanup');
        // This would clean up old cached data
      },
    });

    this.registerTask({
      id: 'check_updates',
      name: 'Check for Updates',
      type: 'update',
      priority: 'medium',
      interval: 24 * 60 * 60 * 1000, // Daily
      requiresNetwork: true,
      callback: async () => {
        // Check for app updates
        await this.checkForUpdates();
      },
    });
  }

  private async checkForUpdates(): Promise<void> {
    try {
      // This would check for app updates from your server
      const updates = await this.fetchAvailableUpdates();
      
      for (const update of updates) {
        if (update.forceUpdate || this.shouldScheduleUpdate(update)) {
          this.scheduleUpdate(update);
        }
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }
  }

  private async fetchAvailableUpdates(): Promise<BackgroundUpdate[]> {
    // This would fetch available updates from your server
    // For now, return empty array
    return [];
  }

  private shouldScheduleUpdate(update: BackgroundUpdate): boolean {
    // Check if update should be scheduled based on type and requirements
    if (update.type === 'critical') {
      return true;
    }
    
    if (update.type === 'recommended') {
      return true;
    }
    
    // For optional updates, check user preferences
    // This would integrate with user preferences service
    return false;
  }

  private async processUpdateQueue(): Promise<void> {
    const pendingUpdates = this.updateQueue.filter(update => update.status === 'pending');
    
    for (const update of pendingUpdates) {
      if (this.canDownloadUpdate(update)) {
        await this.downloadUpdate(update);
      }
    }
  }

  private canDownloadUpdate(update: BackgroundUpdate): boolean {
    // Check network requirements
    if (!this.networkStatus) {
      return false;
    }
    
    // Check WiFi requirement for large updates
    if (this.config.networkOptimization.requireWiFiForLargeTransfers && 
        update.size > 10 * 1024 * 1024 && // 10MB
        !this.isWiFiConnected) {
      return false;
    }
    
    // Check battery level
    if (this.batteryLevel < 20) {
      return update.type === 'critical';
    }
    
    return true;
  }

  private async downloadUpdate(update: BackgroundUpdate): Promise<void> {
    try {
      update.status = 'downloading';
      update.progress = 0;
      
      // Simulate download progress
      const progressInterval = setInterval(() => {
        update.progress = Math.min(update.progress + 10, 90);
        this.saveUpdateQueue();
      }, 1000);
      
      // Simulate download
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      clearInterval(progressInterval);
      update.status = 'completed';
      update.progress = 100;
      update.completedAt = new Date();
      
      this.saveUpdateQueue();
      
      // Send notification about update
      if (this.pushNotificationService) {
        await this.pushNotificationService.sendNotification({
          title: 'Update Available',
          body: `${update.title} is ready to install`,
          data: {
            type: 'update_available',
            updateId: update.id,
            version: update.version,
          },
        });
      }
      
      console.log(`Update downloaded: ${update.title} (${update.id})`);
    } catch (error) {
      update.status = 'failed';
      update.error = error instanceof Error ? error.message : 'Download failed';
      this.saveUpdateQueue();
      
      console.error(`Failed to download update: ${update.title}`, error);
    }
  }

  private async loadBackgroundTasks(): Promise<void> {
    try {
      const savedTasks = await AsyncStorage.getItem('background_tasks');
      if (savedTasks) {
        const tasks = JSON.parse(savedTasks);
        for (const task of tasks) {
          this.backgroundTasks.set(task.id, task);
          this.scheduler.tasks.set(task.id, task);
        }
      }
    } catch (error) {
      console.error('Failed to load background tasks:', error);
    }
  }

  private async saveBackgroundTasks(): Promise<void> {
    try {
      const tasks = Array.from(this.backgroundTasks.values());
      await AsyncStorage.setItem('background_tasks', JSON.stringify(tasks));
    } catch (error) {
      console.error('Failed to save background tasks:', error);
    }
  }

  private async loadUpdateQueue(): Promise<void> {
    try {
      const savedQueue = await AsyncStorage.getItem('update_queue');
      if (savedQueue) {
        this.updateQueue = JSON.parse(savedQueue);
      }
    } catch (error) {
      console.error('Failed to load update queue:', error);
    }
  }

  private async saveUpdateQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem('update_queue', JSON.stringify(this.updateQueue));
    } catch (error) {
      console.error('Failed to save update queue:', error);
    }
  }

  private async startBackgroundFetch(): Promise<void> {
    // This would set up background fetch for iOS and Android
    if (Platform.OS === 'ios') {
      // iOS background fetch setup
      // Would use react-native-background-fetch
    } else if (Platform.OS === 'android') {
      // Android WorkManager setup
      // Would use react-native-background-job
    }
  }
}

// Export singleton instance
let backgroundTaskManager: BackgroundTaskManager | null = null;

export const getBackgroundTaskManager = (
  config: BackgroundSyncConfig,
  pushNotificationService?: PushNotificationService
): BackgroundTaskManager => {
  if (!backgroundTaskManager) {
    backgroundTaskManager = new BackgroundTaskManager(config, pushNotificationService);
  }
  return backgroundTaskManager;
};

// Hook for using background tasks in React components
export const useBackgroundTaskManager = (
  config: BackgroundSyncConfig,
  pushNotificationService?: PushNotificationService
) => {
  return getBackgroundTaskManager(config, pushNotificationService);
};

// Export types for external use
export type { BackgroundTask, BackgroundUpdate, BackgroundSyncConfig, TaskScheduler };
