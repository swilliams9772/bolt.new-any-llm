import { readdir, readFile } from 'node:fs/promises';
import { path } from '~/utils/path';
import { isText } from 'istextorbinary';
import type { ProjectFile } from '~/types/file';

// Add guard to ensure this only runs in SSR context
if (!import.meta.env.SSR) {
  throw new Error('LocalProjectManager can only be used in SSR context');
}

export class LocalProjectManager {
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  async loadProject(): Promise<ProjectFile[]> {
    const files: ProjectFile[] = [];
    await this.scanDirectory(this.projectPath, files);
    return files;
  }

  private async scanDirectory(dirPath: string, files: ProjectFile[]): Promise<void> {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(this.projectPath, fullPath);

      // Skip node_modules and hidden files/directories
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }

      if (entry.isDirectory()) {
        await this.scanDirectory(fullPath, files);
      } else {
        try {
          const content = await readFile(fullPath);
          if (isText(entry.name, content)) {
            files.push({
              path: relativePath,
              content: content.toString(),
              type: 'file'
            });
          }
        } catch (error) {
          console.error(`Error reading file ${fullPath}:`, error);
        }
      }
    }
  }
} 