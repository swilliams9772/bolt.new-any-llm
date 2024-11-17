import * as diffLib from 'diff';
import type { FileChange } from '~/types/file';

class FileLockManager {
  private lockedFiles: Set<string> = new Set();
  private fileContents: Map<string, string> = new Map();

  lockFile(filePath: string): boolean {
    if (this.lockedFiles.has(filePath)) {
      return false;
    }
    this.lockedFiles.add(filePath);
    return true;
  }

  unlockFile(filePath: string): void {
    this.lockedFiles.delete(filePath);
  }

  isLocked(filePath: string): boolean {
    return this.lockedFiles.has(filePath);
  }

  setFileContent(filePath: string, content: string): void {
    this.fileContents.set(filePath, content);
  }

  calculateDiff(filePath: string, newContent: string): FileChange | null {
    const currentContent = this.fileContents.get(filePath) || '';
    
    if (currentContent === newContent) {
      return null;
    }

    const changes = diffLib.createPatch(filePath, currentContent, newContent);
    
    return {
      path: filePath,
      diff: changes,
      newContent
    };
  }
}

// Singleton instance
export const fileLockManager = new FileLockManager(); 