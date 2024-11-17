import type { FileChange } from '~/types/file';

interface PendingChange {
  path: string;
  content: string;
  timestamp: number;
  staged: boolean;
}

export class VSCodeManager {
  private pendingChanges: Map<string, PendingChange> = new Map();
  private stagedChanges: Set<string> = new Set();

  addChange(path: string, content: string): void {
    this.pendingChanges.set(path, {
      path,
      content,
      timestamp: Date.now(),
      staged: false
    });
  }

  stageChange(path: string): boolean {
    const change = this.pendingChanges.get(path);
    if (!change) return false;

    change.staged = true;
    this.stagedChanges.add(path);
    return true;
  }

  unstageChange(path: string): boolean {
    const change = this.pendingChanges.get(path);
    if (!change) return false;

    change.staged = false;
    this.stagedChanges.delete(path);
    return true;
  }

  getPendingChanges(): PendingChange[] {
    return Array.from(this.pendingChanges.values());
  }

  getStagedChanges(): PendingChange[] {
    return Array.from(this.pendingChanges.values())
      .filter(change => change.staged);
  }

  getUnstagedChanges(): PendingChange[] {
    return Array.from(this.pendingChanges.values())
      .filter(change => !change.staged);
  }

  commitChanges(message: string): FileChange[] {
    const stagedChanges = this.getStagedChanges();
    const changes: FileChange[] = stagedChanges.map(change => ({
      path: change.path,
      newContent: change.content,
      diff: '', // Will be calculated by handle-file-operations
    }));

    // Clear staged changes after commit
    stagedChanges.forEach(change => {
      this.pendingChanges.delete(change.path);
      this.stagedChanges.delete(change.path);
    });

    return changes;
  }

  discardChanges(path: string): void {
    this.pendingChanges.delete(path);
    this.stagedChanges.delete(path);
  }
}

// Singleton instance
export const vscodeManager = new VSCodeManager(); 