import { fileLockManager } from './lock-manager';

export async function handleFileOperation(filePath: string, newContent: string) {
  try {
    // Try to lock the file
    if (!fileLockManager.lockFile(filePath)) {
      throw new Error(`File ${filePath} is currently locked`);
    }

    // Calculate diff before making changes
    const fileChange = fileLockManager.calculateDiff(filePath, newContent);

    // If no changes, skip writing
    if (!fileChange) {
      fileLockManager.unlockFile(filePath);
      return null;
    }

    // Apply changes and update stored content
    await writeFile(filePath, newContent);
    fileLockManager.setFileContent(filePath, newContent);

    // Release lock
    fileLockManager.unlockFile(filePath);

    return fileChange;
  } catch (error) {
    // Make sure to release lock even if operation fails
    fileLockManager.unlockFile(filePath);
    throw error;
  }
} 