import { fileLockManager } from './lock-manager';
import { versionManager } from '../version/version-manager';

export async function handleFileOperation(filePath: string, newContent: string, description?: string) {
  try {
    if (!fileLockManager.lockFile(filePath)) {
      throw new Error(`File ${filePath} is currently locked`);
    }

    const fileChange = fileLockManager.calculateDiff(filePath, newContent);

    if (!fileChange) {
      fileLockManager.unlockFile(filePath);
      return null;
    }

    // Apply changes and update stored content
    await writeFile(filePath, newContent);
    fileLockManager.setFileContent(filePath, newContent);

    // Track version
    if (fileChange) {
      versionManager.addVersion([fileChange], description);
    }

    fileLockManager.unlockFile(filePath);
    return fileChange;
  } catch (error) {
    fileLockManager.unlockFile(filePath);
    throw error;
  }
}

export async function revertToVersion(versionId: string) {
  const changes = versionManager.revertToVersion(versionId);
  
  for (const change of changes) {
    await handleFileOperation(change.path, change.newContent, `Reverted to version ${versionId}`);
  }
  
  return changes;
} 