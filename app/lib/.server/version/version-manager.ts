import * as diffLib from 'diff';
import type { FileChange } from '~/types/file';

interface Version {
  id: string;
  timestamp: number;
  changes: FileChange[];
  description: string;
}

export class VersionManager {
  private versions: Version[] = [];
  private currentFiles: Map<string, string> = new Map();

  addVersion(changes: FileChange[], description: string = ''): string {
    const version: Version = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      changes,
      description
    };

    // Update current files state
    for (const change of changes) {
      this.currentFiles.set(change.path, change.newContent);
    }

    this.versions.push(version);
    return version.id;
  }

  revertToVersion(versionId: string): FileChange[] {
    const versionIndex = this.versions.findIndex(v => v.id === versionId);
    if (versionIndex === -1) throw new Error('Version not found');

    // Calculate reverse changes to revert to this version
    const revertChanges: FileChange[] = [];
    
    // Get files state at target version
    const targetFiles = new Map(this.currentFiles);
    for (let i = this.versions.length - 1; i > versionIndex; i--) {
      for (const change of this.versions[i].changes) {
        const patch = diffLib.parsePatch(change.diff)[0];
        const revertedContent = diffLib.applyPatch(change.newContent, patch, { reverse: true });
        
        targetFiles.set(change.path, revertedContent);
        revertChanges.push({
          path: change.path,
          newContent: revertedContent,
          diff: diffLib.createPatch(change.path, change.newContent, revertedContent)
        });
      }
    }

    // Update current state
    this.currentFiles = targetFiles;
    // Remove versions after the target version
    this.versions = this.versions.slice(0, versionIndex + 1);

    return revertChanges;
  }

  getVersions(): Version[] {
    return this.versions;
  }

  getCurrentVersion(): Version | undefined {
    return this.versions[this.versions.length - 1];
  }
}

// Singleton instance
export const versionManager = new VersionManager(); 