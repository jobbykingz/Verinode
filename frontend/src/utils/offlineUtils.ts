/**
 * Resolves conflicts between local offline edits and server data.
 * Strategy: Latest update timestamp wins.
 */
export const resolveConflict = <T extends { updatedAt?: string | number }>(
  localData: T,
  serverData: T | null
): T => {
  if (!serverData) return localData;
  if (!localData.updatedAt || !serverData.updatedAt) return localData;

  const localTime = new Date(localData.updatedAt).getTime();
  const serverTime = new Date(serverData.updatedAt).getTime();

  return localTime > serverTime ? localData : serverData;
};

/**
 * Validates data integrity before syncing to ensure no malformed payload is sent.
 */
export const validateIntegrity = (data: any, requiredFields: string[]): boolean => {
  if (!data || typeof data !== 'object') return false;
  
  return requiredFields.every((field) => {
    const value = data[field];
    return value !== null && value !== undefined && value !== '';
  });
};

export const generateTempId = (): string => {
  return `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};